"use client";
import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Cookies from "js-cookie";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { 
    ShieldCheck, Loader2, Edit2, X, Plus, 
    MessageSquare, UserCheck, Bell, CheckCircle, 
    Briefcase, UserPlus, Send, Code2, Mail, Clock, Search 
} from "lucide-react";
import Link from "next/link";

const PRESET_SKILLS = ["React", "Python", "Node.js", "TypeScript", "Next.js", "Tailwind", "MongoDB", "Firebase", "Flutter", "Java", "C++", "Rust", "Go", "Figma", "UI/UX", "AI/ML", "Docker", "AWS", "Solidity", "Blockchain"];

interface UserProfile {
  username: string;
  avatar_url: string;
  trust_score: number;
  is_verified_student: boolean;
  skills: { name: string; level: string }[]; 
  _id?: string;
  id?: string;
}

interface Match {
    id: string;
    name: string;
    avatar: string;
    contact: string;
    role: "Team Leader" | "Teammate";
    project_id: string;
    project_name: string;
    status: "matched" | "invited" | "requested" | "joined";
}

interface Notification {
    _id: string;
    message: string;
    type: string;
    related_id?: string;
    sender_id: string;
    is_read: boolean;
}

export default function Dashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  
  const [talentPool, setTalentPool] = useState<Match[]>([]);
  const [projectOpportunities, setProjectOpportunities] = useState<Match[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0); 
  
  // Loading States for Actions
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);

  const [searchTalent, setSearchTalent] = useState("");
  const [searchProjects, setSearchProjects] = useState("");
  
  const [emailRecipient, setEmailRecipient] = useState<{id: string, name: string} | null>(null);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  
  const [mySkills, setMySkills] = useState<string[]>([]);
  const [dropdownValue, setDropdownValue] = useState("");

  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const urlToken = searchParams.get("token");
    let activeToken = urlToken;

    if (urlToken) {
      Cookies.set("token", urlToken, { expires: 7 });
      router.replace("/dashboard");
    } else {
      activeToken = Cookies.get("token") || null;
      if (!activeToken) { router.push("/"); return; }
    }

    if (activeToken) {
        fetchUserProfile(activeToken);
        fetchMatches(activeToken);
        fetchNotifications(activeToken);
        fetchUnreadCount(activeToken);
    }

    const handleClickOutside = (event: MouseEvent) => {
        if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
            setShowNotifDropdown(false);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);

  }, [searchParams, router]);

  useEffect(() => {
      if (!user) return;
      const userId = user._id || user.id;
      if (!userId) return;
      const ws = new WebSocket(`ws://localhost:8000/chat/ws/${userId}`);
      ws.onmessage = () => { 
          setUnreadCount(prev => prev + 1); 
          const token = Cookies.get("token"); 
          if(token) fetchNotifications(token); 
      };
      return () => ws.close();
  }, [user]);

  const fetchUserProfile = async (jwt: string) => { try { const response = await axios.get("http://localhost:8000/users/me", { headers: { Authorization: `Bearer ${jwt}` } }); setUser(response.data); const rawSkills = response.data.skills.map((s: any) => s.name); setMySkills(Array.from(new Set(rawSkills)) as string[]); } catch (error) { Cookies.remove("token"); router.push("/"); } };
  const fetchMatches = async (jwt: string) => { try { const res = await axios.get("http://localhost:8000/matches/mine", { headers: { Authorization: `Bearer ${jwt}` } }); const allMatches: Match[] = res.data; setTalentPool(allMatches.filter(m => m.role === "Teammate").reverse()); setProjectOpportunities(allMatches.filter(m => m.role === "Team Leader").reverse()); } catch (e) { console.error("Failed to fetch matches"); } }
  const fetchNotifications = async (jwt: string) => { try { const res = await axios.get("http://localhost:8000/notifications/", { headers: { Authorization: `Bearer ${jwt}` } }); setNotifications(res.data); } catch (e) { console.error("Failed to fetch notifications"); } }
  const fetchUnreadCount = async (jwt: string) => { try { const res = await axios.get("http://localhost:8000/chat/unread-count", { headers: { Authorization: `Bearer ${jwt}` } }); setUnreadCount(res.data.count); } catch (e) { console.error("Failed unread count"); } }

  // --- ACTIONS ---
  
  const toggleNotifications = async () => {
      const newState = !showNotifDropdown;
      setShowNotifDropdown(newState);
      if (newState) {
          const token = Cookies.get("token");
          // Keep actionable items unread in UI
          setNotifications(prev => prev.map(n => (n.type === "team_invite" || n.type === "join_request") ? n : { ...n, is_read: true }));
          try { await axios.post("http://localhost:8000/notifications/read-all", {}, { headers: { Authorization: `Bearer ${token}` } }); } catch(e) {}
      }
  }

  const sendInvite = async (match: Match) => {
      const token = Cookies.get("token");
      setProcessingId(match.id + match.project_id); // Lock button
      try {
          // Optimistic
          setTalentPool(prev => prev.map(m => m.id === match.id && m.project_id === match.project_id ? { ...m, status: "invited" } : m));
          await axios.post(`http://localhost:8000/teams/${match.project_id}/invite`, { target_user_id: match.id }, { headers: { Authorization: `Bearer ${token}` } });
          
          setTimeout(() => fetchMatches(token!), 500); // Small delay to allow DB sync
      } catch (err: any) { alert("Failed"); fetchMatches(token!); }
      finally { setProcessingId(null); }
  }

  const requestJoin = async (match: Match) => {
      const token = Cookies.get("token");
      setProcessingId(match.id + match.project_id);
      try {
          // Optimistic
          setProjectOpportunities(prev => prev.map(m => m.id === match.id && m.project_id === match.project_id ? { ...m, status: "requested" } : m));
          await axios.post(`http://localhost:8000/teams/${match.project_id}/invite`, { target_user_id: "LEADER" }, { headers: { Authorization: `Bearer ${token}` } });
          
          setTimeout(() => fetchMatches(token!), 500);
      } catch (err: any) { alert("Failed"); fetchMatches(token!); }
      finally { setProcessingId(null); }
  }

  const handleConnectionAction = async (match: Match) => {
      const token = Cookies.get("token");
      setProcessingId(match.id + match.project_id);
      try {
          let target = "";
          if (match.role === "Teammate") target = match.id;
          if (match.role === "Team Leader") target = await getCurrentUserId(token!);

          // Optimistic Update
          if (match.role === "Teammate") setTalentPool(prev => prev.map(m => m.id === match.id && m.project_id === match.project_id ? { ...m, status: "joined" } : m));
          else setProjectOpportunities(prev => prev.map(m => m.id === match.id && m.project_id === match.project_id ? { ...m, status: "joined" } : m));
          
          await axios.post(`http://localhost:8000/teams/${match.project_id}/members`, 
            { target_user_id: target }, { headers: { Authorization: `Bearer ${token}` } }
          );

          // Clear Notification
          const relatedNotif = notifications.find(n => n.related_id === match.project_id && !n.is_read);
          if (relatedNotif) {
             await axios.put(`http://localhost:8000/notifications/${relatedNotif._id}/read`, {}, { headers: { Authorization: `Bearer ${token}` } });
             setNotifications(prev => prev.map(n => n._id === relatedNotif._id ? { ...n, is_read: true } : n));
          }

          alert("Success! Team updated.");
          setTimeout(() => fetchMatches(token!), 500);
      } catch (err) { alert("Action failed"); fetchMatches(token!); }
      finally { setProcessingId(null); }
  }

  const handleNotificationAction = async (notif: Notification) => {
      if(!notif.related_id) return;
      const token = Cookies.get("token");
      try {
          let target = "";
          if (notif.type === "team_invite") target = await getCurrentUserId(token!); 
          if (notif.type === "join_request") target = notif.sender_id; 
          
          await axios.post(`http://localhost:8000/teams/${notif.related_id}/members`, { target_user_id: target }, { headers: { Authorization: `Bearer ${token}` } });
          await axios.put(`http://localhost:8000/notifications/${notif._id}/read`, {}, { headers: { Authorization: `Bearer ${token}` } });
          
          setNotifications(prev => prev.map(n => n._id === notif._id ? { ...n, is_read: true } : n));
          setTimeout(() => fetchMatches(token!), 500);
      } catch (err) { alert("Action failed"); }
  };
  
  const openEmailComposer = (match: Match) => { setEmailRecipient({ id: match.id, name: match.name }); setShowEmailModal(true); }
  const handleSendEmail = async () => { const token = Cookies.get("token"); if (!emailRecipient) return; try { await axios.post("http://localhost:8000/communication/send-email", { recipient_id: emailRecipient.id, subject: emailSubject, body: emailBody }, { headers: { Authorization: `Bearer ${token}` } }); alert("Email sent!"); setShowEmailModal(false); setEmailSubject(""); setEmailBody(""); } catch (err) { alert("Failed"); } }
  const getCurrentUserId = async (token: string) => { const res = await axios.get("http://localhost:8000/users/me", { headers: { Authorization: `Bearer ${token}` } }); return res.data._id || res.data.id; }
  const saveSkills = async () => { const token = Cookies.get("token"); try { await axios.put("http://localhost:8000/users/skills", { skills: mySkills }, { headers: { Authorization: `Bearer ${token}` } }); setShowProfileModal(false); if (user) setUser({ ...user, skills: mySkills.map(s => ({ name: s, level: "Intermediate" })) }); } catch (err) { alert("Failed"); } };
  const addSkill = (skill: string) => { if (!skill || mySkills.includes(skill)) return; setMySkills([...mySkills, skill]); setDropdownValue(""); };
  const removeSkill = (skill: string) => { setMySkills(mySkills.filter(s => s !== skill)); };
  const getScoreColor = (score: number) => { if (score >= 8) return "text-green-400"; if (score >= 5) return "text-yellow-400"; return "text-red-400"; };

  const getUnreadNotifCount = () => notifications.filter(n => !n.is_read).length;

  const renderMatchButton = (match: Match) => {
      const isProcessing = processingId === (match.id + match.project_id);
      
      // 1. I am Leader
      if (match.role === "Teammate") {
          if (match.status === "matched") return <button disabled={isProcessing} onClick={() => sendInvite(match)} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1">{isProcessing ? <Loader2 className="w-3 h-3 animate-spin"/> : <><Plus className="w-3 h-3"/> Invite</>}</button>;
          if (match.status === "invited") return <div className="flex-1 bg-gray-700 text-gray-400 py-1.5 rounded text-xs flex items-center justify-center gap-1"><Clock className="w-3 h-3"/> Pending</div>;
          if (match.status === "requested") return <button disabled={isProcessing} onClick={() => handleConnectionAction(match)} className="flex-1 bg-green-600 hover:bg-green-500 text-white py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1">{isProcessing ? <Loader2 className="w-3 h-3 animate-spin"/> : <><CheckCircle className="w-3 h-3"/> Accept Request</>}</button>;
          if (match.status === "joined") return <div className="flex-1 bg-gray-800 text-green-400 border border-green-900 py-1.5 rounded text-xs font-bold text-center">Member</div>;
      }
      // 2. I am Candidate
      else {
          if (match.status === "matched") return <button disabled={isProcessing} onClick={() => requestJoin(match)} className="flex-1 bg-purple-600 hover:bg-purple-500 text-white py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1">{isProcessing ? <Loader2 className="w-3 h-3 animate-spin"/> : <><Send className="w-3 h-3"/> Request Join</>}</button>;
          if (match.status === "requested") return <div className="flex-1 bg-gray-700 text-gray-400 py-1.5 rounded text-xs flex items-center justify-center gap-1"><Clock className="w-3 h-3"/> Pending</div>;
          if (match.status === "invited") return <button disabled={isProcessing} onClick={() => handleConnectionAction(match)} className="flex-1 bg-green-600 hover:bg-green-500 text-white py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1">{isProcessing ? <Loader2 className="w-3 h-3 animate-spin"/> : <><CheckCircle className="w-3 h-3"/> Join Team</>}</button>;
          if (match.status === "joined") return <div className="flex-1 bg-gray-800 text-green-400 border border-green-900 py-1.5 rounded text-xs font-bold text-center">Joined</div>;
      }
  };

  if (!user) return <div className="flex h-screen items-center justify-center bg-gray-950 text-white"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-10">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-12">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">CollabQuest</h1>
          <div className="flex items-center gap-4">
            <div className="relative" ref={notifRef}>
                <button onClick={toggleNotifications} className="p-3 bg-gray-800 hover:bg-gray-700 rounded-full border border-gray-700 transition relative">
                    <Bell className="w-5 h-5 text-yellow-400"/>
                    {getUnreadNotifCount() > 0 && <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">{getUnreadNotifCount()}</span>}
                </button>
                <AnimatePresence>
                    {showNotifDropdown && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute right-0 mt-2 w-80 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl z-50 overflow-hidden">
                            <div className="p-3 border-b border-gray-800 font-bold text-sm bg-gray-950">Notifications</div>
                            <div className="max-h-64 overflow-y-auto">
                                {notifications.length === 0 ? <p className="p-4 text-gray-500 text-sm text-center">No notifications</p> : (
                                    notifications.map(n => (
                                        <div key={n._id} className={`p-3 border-b border-gray-800 hover:bg-gray-800/50 transition ${n.is_read ? 'opacity-50' : ''}`}>
                                            <p className="text-xs text-gray-300 mb-2">{n.message}</p>
                                            {(n.type === 'team_invite' || n.type === 'join_request') && (
                                                <button onClick={() => handleNotificationAction(n)} disabled={n.is_read} className={`w-full text-xs py-1.5 rounded font-bold flex items-center justify-center gap-1 ${n.is_read ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500 text-white'}`}>
                                                    <CheckCircle className="w-3 h-3"/> {n.is_read ? 'Handled' : 'Accept'}
                                                </button>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
            <Link href="/chat"><button className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-full border border-gray-700 transition relative"><MessageSquare className="w-5 h-5 text-blue-400"/> Messages{unreadCount > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">{unreadCount}</span>}</button></Link>
            <div className="flex items-center gap-3 bg-gray-900 px-5 py-2 rounded-full border border-gray-800 shadow-lg"><ShieldCheck className={getScoreColor(user.trust_score) + " h-6 w-6"} /><div className="flex flex-col"><span className="text-xs text-gray-400 font-mono uppercase">Trust Score</span><span className="font-bold text-lg leading-none">{user.trust_score.toFixed(1)}</span></div></div>
          </div>
        </header>

        {/* ... (Rest is same as before: Grid, Searchable Lists, Modals) ... */}
        {/* Paste the rest of the return block here (Grid, Talent Pool, Project Matches, Modals) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <motion.div whileHover={{ scale: 1.02 }} onClick={() => setShowProfileModal(true)} className="p-6 rounded-2xl bg-gray-900 border border-gray-800 shadow-xl flex items-center gap-4 cursor-pointer group hover:border-purple-500/50 transition-all relative">
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"><Edit2 className="w-4 h-4 text-purple-400" /></div>
                <img src={user.avatar_url} alt="Avatar" className="w-16 h-16 rounded-full border-2 border-purple-500" />
                <div><h2 className="text-xl font-semibold">Welcome, {user.username}!</h2><div className="flex flex-wrap gap-2 mt-2">{user.skills.length > 0 ? user.skills.slice(0, 3).map((s, i) => <span key={i} className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-300 border border-gray-700">{s.name}</span>) : <span className="text-xs text-yellow-500 italic">Tap to add skills +</span>}</div></div>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} className="p-6 rounded-2xl bg-gradient-to-br from-purple-900/50 to-blue-900/50 border border-purple-500/20">
                <h2 className="text-xl font-semibold mb-4">Start a Project</h2>
                <Link href="/find-team"><button className="w-full py-3 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition shadow-lg">Go to Marketplace</button></Link>
            </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-gray-900/30 p-6 rounded-3xl border border-gray-800">
                <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold flex items-center gap-2 text-blue-300"><UserPlus className="w-5 h-5"/> Talent Pool</h3><div className="relative"><input className="bg-gray-900 border border-gray-700 rounded-full px-4 py-1 text-xs outline-none focus:border-blue-500 w-40" placeholder="Search..." value={searchTalent} onChange={e => setSearchTalent(e.target.value)} /><Search className="w-3 h-3 text-gray-500 absolute right-3 top-2" /></div></div>
                <div className="max-h-96 overflow-y-auto space-y-4 pr-2 scrollbar-thin scrollbar-thumb-gray-700">
                    {talentPool.filter(m => m.name.toLowerCase().includes(searchTalent.toLowerCase())).length === 0 ? <p className="text-gray-500 text-sm text-center py-8">No candidates yet.</p> : talentPool.filter(m => m.name.toLowerCase().includes(searchTalent.toLowerCase())).map((m) => (
                        <div key={m.id + m.project_id} className="bg-gray-900 border border-gray-800 p-4 rounded-xl">
                            <div className="flex items-center gap-3 mb-3"><img src={m.avatar || "https://github.com/shadcn.png"} className="w-8 h-8 rounded-full" /><div><h4 className="font-bold text-sm">{m.name}</h4><p className="text-xs text-gray-400">Match for: <span className="text-blue-400 font-mono">{m.project_name}</span></p></div></div>
                            <div className="flex gap-2">{renderMatchButton(m)}<Link href={`/chat?targetId=${m.id}`} className="bg-gray-800 p-1.5 rounded hover:text-blue-400 flex items-center justify-center" title="Chat"><MessageSquare className="w-4 h-4"/></Link><button onClick={() => openEmailComposer(m)} className="bg-gray-800 p-1.5 rounded hover:text-green-400" title="Email"><Mail className="w-4 h-4"/></button></div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="bg-gray-900/30 p-6 rounded-3xl border border-gray-800">
                <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold flex items-center gap-2 text-purple-300"><Briefcase className="w-5 h-5"/> Project Matches</h3><div className="relative"><input className="bg-gray-900 border border-gray-700 rounded-full px-4 py-1 text-xs outline-none focus:border-purple-500 w-40" placeholder="Search..." value={searchProjects} onChange={e => setSearchProjects(e.target.value)} /><Search className="w-3 h-3 text-gray-500 absolute right-3 top-2" /></div></div>
                <div className="max-h-96 overflow-y-auto space-y-4 pr-2 scrollbar-thin scrollbar-thumb-gray-700">
                    {projectOpportunities.filter(m => m.project_name.toLowerCase().includes(searchProjects.toLowerCase())).length === 0 ? <p className="text-gray-500 text-sm text-center py-8">No project matches yet.</p> : projectOpportunities.filter(m => m.project_name.toLowerCase().includes(searchProjects.toLowerCase())).map((m) => (
                        <div key={m.id + m.project_id} className="bg-gray-900 border border-gray-800 p-4 rounded-xl">
                            <div className="flex items-center gap-3 mb-3"><div className="w-8 h-8 bg-purple-900/50 rounded-full flex items-center justify-center border border-purple-500/30"><Code2 className="w-4 h-4 text-purple-400"/></div><div><h4 className="font-bold text-sm">{m.project_name}</h4><p className="text-xs text-gray-400">Leader: {m.name}</p></div></div>
                            <div className="flex gap-2">{renderMatchButton(m)}<Link href={`/chat?targetId=${m.id}`} className="bg-gray-800 p-1.5 rounded hover:text-blue-400 flex items-center justify-center" title="Chat"><MessageSquare className="w-4 h-4"/></Link><button onClick={() => openEmailComposer(m)} className="bg-gray-800 p-1.5 rounded hover:text-green-400" title="Email"><Mail className="w-4 h-4"/></button></div>
                        </div>
                    ))}
                </div>
            </div>
        </div>

      </motion.div>
      <AnimatePresence>{showEmailModal && emailRecipient && (<div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"><motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-gray-900 border border-gray-800 p-8 rounded-2xl w-full max-w-md relative"><div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold flex items-center gap-2"><Mail className="w-5 h-5"/> Send Secure Message</h2><button onClick={() => setShowEmailModal(false)}><X className="text-gray-500 hover:text-white"/></button></div><div className="space-y-4 mt-4"><div className="bg-gray-800/50 p-3 rounded-lg text-sm text-gray-400">To: <span className="text-white font-bold">{emailRecipient.name}</span> (Email Hidden)</div><input className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 outline-none focus:border-green-500" placeholder="Subject" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} /><textarea className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 h-32 outline-none focus:border-green-500 resize-none" placeholder="Message" value={emailBody} onChange={e => setEmailBody(e.target.value)} /><button onClick={handleSendEmail} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2"><Send className="w-4 h-4"/> Send Message</button></div></motion.div></div>)}</AnimatePresence>
      <AnimatePresence>{showProfileModal && (<div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"><motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-gray-900 border border-gray-800 p-8 rounded-2xl w-full max-w-md relative"><div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-bold">Your Hacker Profile 🛠️</h2><button onClick={() => setShowProfileModal(false)}><X className="text-gray-500 hover:text-white"/></button></div><div className="mb-6"><label className="block text-sm text-gray-400 mb-2">My Skills</label><div className="flex flex-wrap gap-2 mb-4 bg-black/30 p-3 rounded-xl min-h-[50px]">{mySkills.map((skill, index) => <span key={index} className="bg-purple-900/40 border border-purple-500/30 text-purple-200 px-3 py-1 rounded-full text-sm flex items-center gap-1">{skill}<button onClick={() => removeSkill(skill)}><X className="w-3 h-3 hover:text-white" /></button></span>)}</div><div className="relative"><select className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 outline-none" value={dropdownValue} onChange={(e) => addSkill(e.target.value)}><option value="" disabled>+ Select Skill</option>{PRESET_SKILLS.filter(s => !mySkills.includes(s)).map(skill => <option key={skill} value={skill}>{skill}</option>)}</select><Plus className="w-3 h-3 absolute right-3 top-3.5 pointer-events-none text-gray-500"/></div></div><button onClick={saveSkills} className="w-full bg-white text-black font-bold py-3 rounded-lg hover:bg-gray-200 transition">Save Profile</button></motion.div></div>)}</AnimatePresence>
    </div>
  );
}