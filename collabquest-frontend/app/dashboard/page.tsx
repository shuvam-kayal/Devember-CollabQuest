"use client";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Cookies from "js-cookie";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Loader2, Edit2, X, Plus, MessageCircle, UserCheck, Bell, CheckCircle, Briefcase, UserPlus, Send, Code2 } from "lucide-react";
import Link from "next/link";

const PRESET_SKILLS = ["React", "Python", "Node.js", "TypeScript", "Next.js", "Tailwind", "MongoDB", "Firebase", "Flutter", "Java", "C++", "Rust", "Go", "Figma", "UI/UX", "AI/ML", "Docker", "AWS", "Solidity", "Blockchain"];

interface UserProfile {
  username: string;
  avatar_url: string;
  trust_score: number;
  is_verified_student: boolean;
  skills: { name: string; level: string }[]; 
}

interface Match {
    id: string; // User ID
    name: string;
    avatar: string;
    contact: string;
    role: "Team Leader" | "Teammate";
    project_id: string;
    project_name: string;
}

interface GroupedMatch {
    id: string;
    name: string;
    avatar: string;
    contact: string;
    projects: { id: string; name: string }[];
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
  
  // Grouped Matches
  const [talentPool, setTalentPool] = useState<GroupedMatch[]>([]);
  const [projectOpportunities, setProjectOpportunities] = useState<Match[]>([]);
  const [selectedProjectMap, setSelectedProjectMap] = useState<{[key:string]: string}>({});
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [mySkills, setMySkills] = useState<string[]>([]);
  const [dropdownValue, setDropdownValue] = useState("");

  useEffect(() => {
    const urlToken = searchParams.get("token");
    let activeToken = urlToken;

    if (urlToken) {
      Cookies.set("token", urlToken, { expires: 7 });
      router.replace("/dashboard");
    } else {
      activeToken = Cookies.get("token") || null;
      if (!activeToken) {
        router.push("/");
        return;
      }
    }

    if (activeToken) {
        fetchUserProfile(activeToken);
        fetchMatches(activeToken);
        fetchNotifications(activeToken);
    }
  }, [searchParams, router]);

  const fetchUserProfile = async (jwt: string) => {
    try {
      const response = await axios.get("http://localhost:8000/users/me", { headers: { Authorization: `Bearer ${jwt}` } });
      setUser(response.data);
      const rawSkills = response.data.skills.map((s: any) => s.name);
      setMySkills(Array.from(new Set(rawSkills)) as string[]); 
    } catch (error) { Cookies.remove("token"); router.push("/"); }
  };

  const fetchMatches = async (jwt: string) => {
      try {
          const res = await axios.get("http://localhost:8000/matches/mine", { headers: { Authorization: `Bearer ${jwt}` } });
          const allMatches: Match[] = res.data;
          
          setProjectOpportunities(allMatches.filter(m => m.role === "Team Leader"));

          // GROUP TEAMMATE MATCHES BY USER
          const teammates = allMatches.filter(m => m.role === "Teammate");
          const grouped: {[key: string]: GroupedMatch} = {};
          
          teammates.forEach(m => {
              if (!grouped[m.id]) {
                  grouped[m.id] = {
                      id: m.id,
                      name: m.name,
                      avatar: m.avatar,
                      contact: m.contact,
                      projects: []
                  };
              }
              grouped[m.id].projects.push({ id: m.project_id, name: m.project_name });
          });
          
          setTalentPool(Object.values(grouped));
          
      } catch (e) { console.error("Failed to fetch matches"); }
  }

  const fetchNotifications = async (jwt: string) => {
      try {
          const res = await axios.get("http://localhost:8000/notifications/", { headers: { Authorization: `Bearer ${jwt}` } });
          setNotifications(res.data);
      } catch (e) { console.error("Failed to fetch notifications"); }
  }

  // --- ACTIONS ---
  
  const sendInvite = async (userId: string) => {
      const projectId = selectedProjectMap[userId];
      if (!projectId) {
          alert("Please select a project to invite them to.");
          return;
      }
      
      const token = Cookies.get("token");
      try {
          await axios.post(`http://localhost:8000/teams/${projectId}/invite`, 
            { target_user_id: userId },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          alert(`Invite sent!`);
      } catch (err) { alert("Failed to send invite"); }
  }

  const requestJoin = async (match: Match) => {
      const token = Cookies.get("token");
      try {
          await axios.post(`http://localhost:8000/teams/${match.project_id}/invite`, 
            { target_user_id: "LEADER" },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          alert(`Request sent to join ${match.project_name}!`);
      } catch (err) { alert("Failed to send request"); }
  }

  const acceptInvite = async (notif: Notification) => {
      const token = Cookies.get("token");
      try {
          if(!notif.related_id) return;
          
          let target = "";
          if (notif.type === "team_invite") target = await getCurrentUserId(token!); 
          if (notif.type === "join_request") target = notif.sender_id; 
          
          await axios.post(`http://localhost:8000/teams/${notif.related_id}/members`, 
            { target_user_id: target },
            { headers: { Authorization: `Bearer ${token}` } }
          );

          alert("Joined successfully!");
          await axios.put(`http://localhost:8000/notifications/${notif._id}/read`, {}, { headers: { Authorization: `Bearer ${token}` } });
          fetchNotifications(token!);
      } catch (err) { alert("Action failed"); }
  };
  
  const getCurrentUserId = async (token: string) => {
      const res = await axios.get("http://localhost:8000/users/me", { headers: { Authorization: `Bearer ${token}` } });
      return res.data._id || res.data.id;
  }

  const saveSkills = async () => {
    const token = Cookies.get("token");
    try {
      await axios.put("http://localhost:8000/users/skills", { skills: mySkills }, { headers: { Authorization: `Bearer ${token}` } });
      setShowProfileModal(false);
      if (user) setUser({ ...user, skills: mySkills.map(s => ({ name: s, level: "Intermediate" })) });
    } catch (err) { alert("Failed to save skills"); }
  };
  const addSkill = (skill: string) => { if (!skill || mySkills.includes(skill)) return; setMySkills([...mySkills, skill]); setDropdownValue(""); };
  const removeSkill = (skill: string) => { setMySkills(mySkills.filter(s => s !== skill)); };
  const getScoreColor = (score: number) => { if (score >= 8) return "text-green-400"; if (score >= 5) return "text-yellow-400"; return "text-red-400"; };

  if (!user) return <div className="flex h-screen items-center justify-center bg-gray-950 text-white"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-10">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto">
        <header className="flex items-center justify-between mb-12">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">CollabQuest</h1>
          <div className="flex items-center gap-3 bg-gray-900 px-5 py-2 rounded-full border border-gray-800 shadow-lg">
            <ShieldCheck className="text-green-400 h-6 w-6" />
            <div className="flex flex-col"><span className="text-xs text-gray-400 font-mono uppercase">Trust Score</span><span className="font-bold text-lg leading-none">{user.trust_score.toFixed(1)} / 10.0</span></div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <motion.div whileHover={{ scale: 1.02 }} onClick={() => setShowProfileModal(true)} className="p-6 rounded-2xl bg-gray-900 border border-gray-800 shadow-xl flex items-center gap-4 cursor-pointer group hover:border-purple-500/50 transition-all relative">
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"><Edit2 className="w-4 h-4 text-purple-400" /></div>
            <img src={user.avatar_url} alt="Avatar" className="w-16 h-16 rounded-full border-2 border-purple-500" />
            <div>
                <h2 className="text-xl font-semibold">Welcome, {user.username}!</h2>
                <div className="flex flex-wrap gap-2 mt-2">
                    {user.skills.length > 0 ? (
                        user.skills.slice(0, 3).map((s, i) => <span key={i} className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-300 border border-gray-700">{s.name}</span>)
                    ) : <span className="text-xs text-yellow-500 italic">Tap to add skills +</span>}
                </div>
            </div>
          </motion.div>
          <motion.div whileHover={{ scale: 1.02 }} className="p-6 rounded-2xl bg-gradient-to-br from-purple-900/50 to-blue-900/50 border border-purple-500/20">
            <h2 className="text-xl font-semibold mb-4">Start a Project</h2>
            <Link href="/find-team"><button className="w-full py-3 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition shadow-lg">Go to Marketplace</button></Link>
          </motion.div>
        </div>

        {/* --- NOTIFICATIONS --- */}
        {notifications.length > 0 && (
            <div className="mb-8">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Bell className="text-yellow-400 w-5 h-5"/> Notifications</h3>
                <div className="space-y-3">
                    {notifications.map((n) => (
                        <div key={n._id} className={`bg-gray-900 border ${n.is_read ? 'border-gray-800' : 'border-purple-500/50'} p-4 rounded-xl flex justify-between items-center`}>
                            <span className={`text-sm ${n.is_read ? 'text-gray-500' : 'text-gray-200'}`}>{n.message}</span>
                            <div className="flex gap-2">
                                {(n.type === 'team_invite' || n.type === 'join_request') && !n.is_read && (
                                    <button onClick={() => acceptInvite(n)} className="text-xs bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded-full font-bold flex items-center gap-1">
                                        <CheckCircle className="w-3 h-3"/> Accept
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* --- TALENT POOL (Matches for Leaders) --- */}
            <div>
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-blue-300">
                    <UserPlus className="w-5 h-5"/> Talent Pool
                </h3>
                {talentPool.length === 0 ? <p className="text-gray-500 text-sm">No matches yet.</p> : (
                    <div className="space-y-4">
                        {talentPool.map((m) => (
                            <div key={m.id} className="bg-gray-900 border border-gray-800 p-4 rounded-xl">
                                <div className="flex items-center gap-3 mb-3">
                                    <img src={m.avatar || "https://github.com/shadcn.png"} className="w-8 h-8 rounded-full" />
                                    <div>
                                        <h4 className="font-bold text-sm">{m.name}</h4>
                                        <p className="text-xs text-gray-400">Matched for {m.projects.length} project(s)</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    {/* DROPDOWN FOR PROJECTS */}
                                    <select 
                                        className="flex-1 bg-gray-800 text-xs text-gray-300 rounded px-2 outline-none border border-gray-700"
                                        onChange={(e) => setSelectedProjectMap({...selectedProjectMap, [m.id]: e.target.value})}
                                        value={selectedProjectMap[m.id] || ""}
                                    >
                                        <option value="" disabled>Select Project...</option>
                                        {m.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                    
                                    <button onClick={() => sendInvite(m.id)} className="bg-blue-600 hover:bg-blue-500 text-white py-1 px-3 rounded text-xs flex items-center gap-1">
                                        <Plus className="w-3 h-3"/> Invite
                                    </button>
                                    <a href={`mailto:${m.contact}`} className="bg-gray-800 p-1.5 rounded hover:text-green-400"><MessageCircle className="w-4 h-4"/></a>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* --- PROJECT OPPORTUNITIES (Matches for Candidates) --- */}
            <div>
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-purple-300">
                    <Briefcase className="w-5 h-5"/> Project Matches
                </h3>
                {projectOpportunities.length === 0 ? <p className="text-gray-500 text-sm">No project matches yet.</p> : (
                    <div className="space-y-4">
                        {projectOpportunities.map((m) => (
                            <div key={m.id + m.project_id} className="bg-gray-900 border border-gray-800 p-4 rounded-xl">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-8 h-8 bg-purple-900/50 rounded-full flex items-center justify-center border border-purple-500/30">
                                        <Code2 className="w-4 h-4 text-purple-400"/>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-sm">{m.project_name}</h4>
                                        <p className="text-xs text-gray-400">Leader: {m.name}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => requestJoin(m)} className="flex-1 bg-purple-600 hover:bg-purple-500 text-white py-1 rounded text-xs flex items-center justify-center gap-1">
                                        <Send className="w-3 h-3"/> Request Join
                                    </button>
                                    <a href={`mailto:${m.contact}`} className="bg-gray-800 p-1.5 rounded hover:text-green-400"><MessageCircle className="w-4 h-4"/></a>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>

      </motion.div>
      {/* ... (Edit Modal - Keep existing) ... */}
      <AnimatePresence>
        {showProfileModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-gray-900 border border-gray-800 p-8 rounded-2xl w-full max-w-md relative">
                <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-bold">Your Hacker Profile 🛠️</h2><button onClick={() => setShowProfileModal(false)}><X className="text-gray-500 hover:text-white"/></button></div>
                <div className="mb-6">
                    <label className="block text-sm text-gray-400 mb-2">My Skills</label>
                    <div className="flex flex-wrap gap-2 mb-4 bg-black/30 p-3 rounded-xl min-h-[50px]">
                        {mySkills.map((skill, index) => (
                            <span key={`${skill}-${index}`} className="bg-purple-900/40 border border-purple-500/30 text-purple-200 px-3 py-1 rounded-full text-sm flex items-center gap-1">
                                {skill}<button onClick={() => removeSkill(skill)}><X className="w-3 h-3 hover:text-white" /></button>
                            </span>
                        ))}
                        {mySkills.length === 0 && <span className="text-gray-600 text-sm italic">No skills added yet.</span>}
                    </div>
                    <div className="relative">
                        <select className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 outline-none focus:border-purple-500 appearance-none cursor-pointer" value={dropdownValue} onChange={(e) => addSkill(e.target.value)}>
                            <option value="" disabled>+ Select Skill to Add</option>
                            {PRESET_SKILLS.filter(s => !mySkills.includes(s)).map(skill => <option key={skill} value={skill}>{skill}</option>)}
                        </select>
                        <Plus className="w-3 h-3 absolute right-3 top-3.5 pointer-events-none text-gray-500"/>
                    </div>
                </div>
                <button onClick={saveSkills} className="w-full bg-white text-black font-bold py-3 rounded-lg hover:bg-gray-200 transition">Save Profile</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}