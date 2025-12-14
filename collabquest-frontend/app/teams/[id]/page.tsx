"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Cookies from "js-cookie";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import GlobalHeader from "@/components/GlobalHeader";
import Link from "next/link";
import { 
  Bot, Calendar, Code2, Layers, LayoutDashboard, Loader2, UserPlus, 
  Sparkles, X, Plus, RefreshCw, Trash2, Check, AlertTriangle, MessageSquare, Mail, ThumbsUp, XCircle, Clock, Send, Edit2, Save, Users
} from "lucide-react";

const PRESET_SKILLS = ["React", "Python", "Node.js", "TypeScript", "Next.js", "Tailwind", "MongoDB", "Firebase", "Flutter", "Java", "C++", "Rust", "Go", "Figma", "UI/UX", "AI/ML", "Docker", "AWS", "Solidity"];
interface Member { id: string; username: string; avatar_url: string; email: string; }
interface DeletionRequest { is_active: boolean; votes: {[key:string]: string}; }
interface Team { 
    id: string; name: string; description: string; leader_id: string; 
    members: Member[]; needed_skills: string[]; project_roadmap?: any; chat_group_id?: string;
    target_members: number; target_completion_date?: string; 
    deletion_request?: DeletionRequest;
}
interface Suggestions { add: string[]; remove: string[]; }
interface Candidate { id: string; name: string; avatar: string; contact: string; role: string; status: string; rejected_by?: string; }

export default function TeamDetails() {
  const params = useParams();
  const router = useRouter();
  const [team, setTeam] = useState<Team | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  // Editing State
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editTargetMembers, setEditTargetMembers] = useState(4);
  const [editTargetDate, setEditTargetDate] = useState("");
  const [deletionProcessing, setDeletionProcessing] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null); 
  const [isEditingSkills, setIsEditingSkills] = useState(false);
  const [localSkills, setLocalSkills] = useState<string[]>([]);
  const [dropdownValue, setDropdownValue] = useState("");
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState<{id: string, name: string} | null>(null);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  const teamId = params.id as string;

  useEffect(() => {
    const token = Cookies.get("token");
    if (!token) return router.push("/");
    axios.get("http://localhost:8000/users/me", { headers: { Authorization: `Bearer ${token}` } })
         .then(res => setCurrentUserId(res.data._id || res.data.id));
    fetchTeamData(token);
    
    const handleRefresh = () => { if(token) { fetchTeamData(token); fetchCandidates(token, teamId); } };
    window.addEventListener("dashboardUpdate", handleRefresh);
    return () => window.removeEventListener("dashboardUpdate", handleRefresh);
  }, [teamId]);

  const fetchTeamData = async (token: string) => {
    try {
      const res = await axios.get(`http://localhost:8000/teams/${teamId}`);
      setTeam(res.data);
      setLocalSkills(res.data.needed_skills || []);
      
      // Init Edit Form
      setEditName(res.data.name);
      setEditDesc(res.data.description);
      setEditTargetMembers(res.data.target_members || 4);
      if(res.data.target_completion_date) {
          setEditTargetDate(new Date(res.data.target_completion_date).toISOString().split('T')[0]);
      }

      if (res.data.leader_id) fetchCandidates(token, res.data.id); 
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const fetchCandidates = async (token: string, tid: string) => {
      try {
          const res = await axios.get(`http://localhost:8000/matches/team/${tid}`, { headers: { Authorization: `Bearer ${token}` } });
          setCandidates(res.data.filter((c: Candidate) => c.status !== "joined"));
      } catch (e) { }
  }

  const isLeader = team && currentUserId === team.leader_id;
  const isMember = team && team.members.some(m => m.id === currentUserId);

  const saveDetails = async () => {
      const token = Cookies.get("token");
      try {
          await axios.put(`http://localhost:8000/teams/${teamId}`, {
              name: editName,
              description: editDesc,
              target_members: parseInt(editTargetMembers.toString()),
              target_completion_date: editTargetDate ? new Date(editTargetDate).toISOString() : null
          }, { headers: { Authorization: `Bearer ${token}` } });
          setIsEditing(false);
          fetchTeamData(token!);
      } catch(e) { alert("Failed to update"); }
  };

  const handleInitiateDelete = async () => {
      if(!confirm("Start a vote to delete this project? Requires 70% consensus.")) return;
      const token = Cookies.get("token");
      try {
          setDeletionProcessing(true);
          const res = await axios.post(`http://localhost:8000/teams/${teamId}/delete/initiate`, {}, { headers: { Authorization: `Bearer ${token}` } });
          
          // FIX: Check for immediate deletion status (Single Member case)
          if (res.data.status === "deleted") {
              alert("Team deleted successfully!");
              router.push("/dashboard");
              return; // Stop execution so we don't fetch deleted data
          }

          alert("Vote initiated!");
          fetchTeamData(token!);
          window.dispatchEvent(new Event("triggerNotificationRefresh"));
      } catch(e) { alert("Failed"); } finally { setDeletionProcessing(false); }
  };

  const handleVoteDelete = async (decision: 'approve' | 'reject') => {
      const token = Cookies.get("token");
      try {
          setDeletionProcessing(true);
          const res = await axios.post(`http://localhost:8000/teams/${teamId}/delete/vote`, { decision }, { headers: { Authorization: `Bearer ${token}` } });
          if (res.data.status === "deleted") {
              alert("Team deleted!");
              router.push("/dashboard");
          } else {
              alert("Vote recorded.");
              fetchTeamData(token!);
              window.dispatchEvent(new Event("triggerNotificationRefresh"));
          }
      } catch(e) { alert("Failed"); } finally { setDeletionProcessing(false); }
  };

  // --- ACTIONS ---
  const sendInvite = async (c: Candidate) => { const token = Cookies.get("token"); try { setCandidates(prev => prev.map(m => m.id === c.id ? { ...m, status: "invited" } : m)); await axios.post(`http://localhost:8000/teams/${teamId}/invite`, { target_user_id: c.id }, { headers: { Authorization: `Bearer ${token}` } }); } catch (err) { alert("Failed"); fetchCandidates(token!, teamId); } }
  
  const acceptRequest = async (c: Candidate) => { 
      const token = Cookies.get("token"); 
      try { 
          await axios.post(`http://localhost:8000/teams/${teamId}/members`, { target_user_id: c.id }, { headers: { Authorization: `Bearer ${token}` } }); 
          window.dispatchEvent(new Event("triggerNotificationRefresh")); 
          fetchTeamData(token!); 
          fetchCandidates(token!, teamId); 
      } catch (err) { alert("Failed"); } 
  }
  
  const rejectRequest = async (c: Candidate) => { 
      if(!confirm("Reject?")) return; 
      const token = Cookies.get("token"); 
      try { 
          await axios.post(`http://localhost:8000/teams/${teamId}/reject`, { target_user_id: c.id }, { headers: { Authorization: `Bearer ${token}` } }); 
          window.dispatchEvent(new Event("triggerNotificationRefresh")); 
          fetchCandidates(token!, teamId); 
      } catch (err) { alert("Failed"); } 
  }
  
  const deleteCandidate = async (c: Candidate) => { 
      if(!confirm("Remove from list?")) return; 
      const token = Cookies.get("token"); 
      try { 
          await axios.delete(`http://localhost:8000/matches/delete/${teamId}/${c.id}`, { headers: { Authorization: `Bearer ${token}` } }); 
          fetchCandidates(token!, teamId); 
      } catch (err) { alert("Failed"); } 
  }

  const createTeamChat = async () => { const token = Cookies.get("token"); try { const res = await axios.post(`http://localhost:8000/chat/groups/team/${teamId}`, {}, { headers: { Authorization: `Bearer ${token}` } }); router.push(`/chat?targetId=${res.data._id || res.data.id}`); } catch (err) { alert("Failed to create group"); } };
  const removeMember = async (memberId: string) => { if(!confirm("Remove?")) return; const token = Cookies.get("token"); try { await axios.delete(`http://localhost:8000/teams/${teamId}/members/${memberId}`, { headers: { Authorization: `Bearer ${token}` } }); if (token) fetchTeamData(token); } catch (err) { alert("Failed to remove"); } };
  
  const likeProject = async () => { 
      const token = Cookies.get("token"); 
      try { 
          const res = await axios.post("http://localhost:8000/matches/swipe", { target_id: teamId, direction: "right", type: "project", related_id: teamId }, { headers: { Authorization: `Bearer ${token}` } }); 
          if(res.data.status === "cooldown") alert("Wait a few days!"); 
          else if (res.data.is_match) { 
              alert("It's a Match! You have joined the team."); 
              fetchTeamData(token!); 
          } else alert("Interest sent!"); 
      } catch (err) { alert("Failed"); } 
  }
  
  const openEmailComposer = (u: any) => { setEmailRecipient({ id: u.id, name: u.username || u.name }); setShowEmailModal(true); }
  const handleSendEmail = async () => { const token = Cookies.get("token"); if (!emailRecipient) return; try { await axios.post("http://localhost:8000/communication/send-email", { recipient_id: emailRecipient.id, subject: emailSubject, body: emailBody }, { headers: { Authorization: `Bearer ${token}` } }); alert("Email sent!"); setShowEmailModal(false); } catch (err) { alert("Failed"); } }
  const addSkill = (skill: string) => { if (!localSkills.includes(skill)) setLocalSkills([...localSkills, skill]); setDropdownValue(""); };
  const removeSkill = (skill: string) => { setLocalSkills(localSkills.filter(s => s !== skill)); };
  const saveSkills = async () => { const token = Cookies.get("token"); try { await axios.put(`http://localhost:8000/teams/${teamId}/skills`, { needed_skills: localSkills }, { headers: { Authorization: `Bearer ${token}` } }); if (token) fetchTeamData(token); setIsEditingSkills(false); setSuggestions(null); } catch (err) { alert("Failed"); } };
  const askAiForStack = async () => { setIsSuggesting(true); const token = Cookies.get("token"); try { const res = await axios.post("http://localhost:8000/teams/suggest-stack", { description: team?.description, current_skills: localSkills }, { headers: { Authorization: `Bearer ${token}` } }); setSuggestions(res.data); } catch (err) { alert("AI Failed"); } finally { setIsSuggesting(false); } };
  const acceptSuggestion = (type: 'add' | 'remove', skill: string) => { if (type === 'add') addSkill(skill); if (type === 'remove') removeSkill(skill); if (suggestions) setSuggestions({ ...suggestions, [type]: suggestions[type].filter(s => s !== skill) }); };
  const rejectSuggestion = (type: 'add' | 'remove', skill: string) => { if (suggestions) setSuggestions({ ...suggestions, [type]: suggestions[type].filter(s => s !== skill) }); };
  const generateRoadmap = async () => { setIsGenerating(true); const token = Cookies.get("token"); try { await axios.post(`http://localhost:8000/teams/${teamId}/roadmap`, {}, { headers: { Authorization: `Bearer ${token}` } }); if (token) fetchTeamData(token); } catch (err) { alert("Failed"); } finally { setIsGenerating(false); } };

  if (loading || !team) return <div className="flex h-screen items-center justify-center bg-gray-950 text-white"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <GlobalHeader />
      
      <div className="max-w-6xl mx-auto p-8">
        
        {/* --- DELETION CONSENSUS PANEL --- */}
        {team?.deletion_request?.is_active && (
            <div className="mb-8 bg-red-900/20 border border-red-500/50 p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-red-500/20 rounded-full text-red-400"><AlertTriangle className="w-6 h-6"/></div>
                    <div>
                        <h3 className="text-lg font-bold text-red-400">Project Deletion Vote in Progress</h3>
                        <p className="text-sm text-gray-400">
                            {Object.values(team.deletion_request.votes).filter(v => v === 'approve').length} / {Math.ceil(team.members.length * 0.7)} votes needed to delete.
                        </p>
                    </div>
                </div>
                
                {team.deletion_request.votes[currentUserId] ? (
                    <div className="text-gray-400 text-sm font-bold bg-gray-800 px-4 py-2 rounded-lg">
                        You voted: <span className={team.deletion_request.votes[currentUserId] === 'approve' ? "text-red-400" : "text-green-400"}>{team.deletion_request.votes[currentUserId].toUpperCase()}</span>
                    </div>
                ) : (
                    <div className="flex gap-3">
                        <button onClick={() => handleVoteDelete('approve')} disabled={deletionProcessing} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-bold text-sm flex items-center gap-2">
                            {deletionProcessing ? <Loader2 className="animate-spin w-4 h-4"/> : <Trash2 className="w-4 h-4"/>} Vote Delete
                        </button>
                        <button onClick={() => handleVoteDelete('reject')} disabled={deletionProcessing} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold text-sm">
                            Keep Project
                        </button>
                    </div>
                )}
            </div>
        )}

        <header className="mb-8 border-b border-gray-800 pb-8">
          <div className="flex justify-between items-start mb-6">
            <div className="flex-1">
                {isEditing ? (
                    <div className="space-y-4 mb-4 max-w-2xl">
                        <input className="text-4xl font-extrabold bg-gray-900 border border-gray-700 rounded px-2 w-full text-white" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Project Name" />
                        <textarea className="text-lg bg-gray-900 border border-gray-700 rounded px-2 w-full h-24 text-gray-300" value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Description" />
                        <div className="flex gap-4">
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">Target Members</label>
                                <input type="number" className="bg-gray-900 border border-gray-700 rounded px-2 py-1 w-20" value={editTargetMembers} onChange={e => setEditTargetMembers(parseInt(e.target.value))} />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">Target Date</label>
                                <input type="date" className="bg-gray-900 border border-gray-700 rounded px-2 py-1" value={editTargetDate} onChange={e => setEditTargetDate(e.target.value)} />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={saveDetails} className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-2"><Save className="w-4 h-4"/> Save</button>
                            <button onClick={() => setIsEditing(false)} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm">Cancel</button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center gap-3 mb-2">
                            <h1 className="text-4xl font-extrabold bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent">{team.name}</h1>
                            {isLeader && <button onClick={() => setIsEditing(true)} className="text-gray-500 hover:text-purple-400"><Edit2 className="w-5 h-5"/></button>}
                        </div>
                        <p className="text-gray-400 max-w-2xl text-lg mb-4">{team.description}</p>
                        
                        <div className="flex gap-6 text-sm text-gray-500 mb-4">
                            <div className="flex items-center gap-2"><Users className="w-4 h-4 text-purple-400"/> {team.members.length} / {team.target_members} Members</div>
                            {team.target_completion_date && <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-blue-400"/> Target: {new Date(team.target_completion_date).toLocaleDateString()}</div>}
                        </div>
                    </>
                )}
            </div>

            <div className="flex flex-col gap-2 items-end">
                {isLeader && (<><Link href={`/matches?type=users&projectId=${team.id}`}><button className="w-full px-6 py-3 bg-white text-black rounded-lg font-bold hover:bg-gray-200 transition flex items-center justify-center gap-2 shadow-lg"><UserPlus className="w-5 h-5 text-purple-600" /> Recruit</button></Link><button onClick={team.chat_group_id ? () => router.push(`/chat?targetId=${team.chat_group_id}`) : createTeamChat} className="w-full px-6 py-3 bg-gray-800 text-blue-400 border border-blue-900 rounded-lg font-bold hover:bg-gray-700 transition flex items-center justify-center gap-2"><MessageSquare className="w-5 h-5" /> {team.chat_group_id ? "Open Team Chat" : "Create Team Chat"}</button></>)}
                {!isMember && <button onClick={likeProject} className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-500 transition flex items-center justify-center gap-2 shadow-lg"><ThumbsUp className="w-5 h-5" /> I'm Interested</button>}
                {isMember && !isLeader && team.chat_group_id && <button onClick={() => router.push(`/chat?targetId=${team.chat_group_id}`)} className="w-full px-6 py-3 bg-gray-800 text-blue-400 border border-blue-900 rounded-lg font-bold hover:bg-gray-700 transition flex items-center justify-center gap-2"><MessageSquare className="w-5 h-5" /> Team Chat</button>}
                
                {isLeader && !team?.deletion_request?.is_active && (
                    <button onClick={handleInitiateDelete} className="text-xs text-red-500 hover:text-red-400 flex items-center gap-1 mt-4 px-3 py-1 border border-red-900/50 rounded bg-red-900/10">
                        <Trash2 className="w-3 h-3"/> Delete Project
                    </button>
                )}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 bg-gray-900/50 p-6 rounded-2xl border border-gray-800">
                <div className="flex justify-between items-center mb-4"><h3 className="font-bold flex items-center gap-2"><Code2 className="text-purple-400 w-5 h-5" /> Tech Stack</h3>{isLeader && !isEditingSkills && <button onClick={() => setIsEditingSkills(true)} className="text-xs text-purple-400 hover:text-purple-300 font-mono border border-purple-500/30 px-3 py-1 rounded">Edit Stack</button>}{isEditingSkills && <div className="flex gap-2"><button onClick={askAiForStack} disabled={isSuggesting} className="text-xs bg-blue-600 text-white px-3 py-1 rounded flex gap-1">{isSuggesting ? <Loader2 className="w-3 h-3 animate-spin"/> : <Sparkles className="w-3 h-3"/>} AI</button><button onClick={saveSkills} className="text-xs bg-green-600 text-white px-3 py-1 rounded">Save</button></div>}</div>
                {isEditingSkills && suggestions && (suggestions.add.length > 0 || suggestions.remove.length > 0) && (<motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mb-4 bg-black/40 border border-blue-500/30 rounded-xl p-3"><h4 className="text-[10px] font-bold text-blue-400 mb-2 uppercase">AI Suggestions</h4><div className="flex flex-wrap gap-2">{suggestions.add.map(s => <div key={s} className="flex items-center gap-1 bg-blue-900/20 border border-blue-500/50 px-2 py-1 rounded text-xs text-blue-200">{s} <button onClick={() => acceptSuggestion('add', s)}><Check className="w-3 h-3 text-green-400"/></button></div>)}{suggestions.remove.map(s => <div key={s} className="flex items-center gap-1 bg-red-900/20 border border-red-500/50 px-2 py-1 rounded text-xs text-red-200">{s} <button onClick={() => acceptSuggestion('remove', s)}><Check className="w-3 h-3 text-red-400"/></button></div>)}</div></motion.div>)}
                <div className="flex flex-wrap gap-2">{(isEditingSkills ? localSkills : team.needed_skills).map((skill, k) => <span key={k} className="bg-gray-800 px-3 py-1 rounded-full text-sm border border-gray-700 flex items-center gap-2">{skill}{isEditingSkills && <button onClick={() => removeSkill(skill)}><X className="w-3 h-3 hover:text-red-400"/></button>}</span>)}{isEditingSkills && <div className="relative"><select className="bg-gray-950 border border-gray-700 text-sm rounded-full px-3 py-1 outline-none" value={dropdownValue} onChange={(e) => addSkill(e.target.value)}><option value="" disabled>+ Add</option>{PRESET_SKILLS.filter(s => !localSkills.includes(s)).map(s => <option key={s} value={s}>{s}</option>)}</select></div>}</div>
              </div>
              <div className="bg-gray-900/50 p-6 rounded-2xl border border-gray-800">
                  <h3 className="font-bold flex items-center gap-2 mb-4"><UserPlus className="text-green-400 w-5 h-5" /> Team ({team.members.length})</h3>
                  <div className="space-y-3">{team.members.map((m: any, i: number) => {if (typeof m === 'string') return null; return (<div key={m.id || i} className="flex items-center justify-between group"><div className="flex items-center gap-2"><img src={m.avatar_url || "https://github.com/shadcn.png"} className="w-8 h-8 rounded-full bg-gray-800"/><div><p className="text-sm font-bold leading-none">{m.username}</p>{m.id === team.leader_id && <span className="text-[10px] text-yellow-500 font-mono">LEADER</span>}</div></div><div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">{(isMember && m.id !== currentUserId) || (!isMember && m.id === team.leader_id) ? <><Link href={`/chat?targetId=${m.id}`} title="Chat"><button className="text-gray-500 hover:text-blue-400 p-1"><MessageSquare className="w-4 h-4"/></button></Link><button onClick={() => openEmailComposer(m)} title="Email" className="text-gray-500 hover:text-green-400 p-1"><Mail className="w-4 h-4"/></button></> : null}{isLeader && m.id !== team.leader_id && <button onClick={() => removeMember(m.id)} title="Remove" className="text-gray-500 hover:text-red-500 p-1"><Trash2 className="w-4 h-4"/></button>}</div></div>);})}</div>
              </div>
          </div>
        </header>

        {/* --- INTERESTED CANDIDATES SECTION --- */}
        {isLeader && candidates.length > 0 && (
            <div className="mb-12 bg-gray-900 border border-blue-900/30 p-8 rounded-2xl">
                 <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-blue-300"><UserPlus className="w-5 h-5"/> Interested Candidates</h3>
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                     {candidates.map(c => (
                         <div key={c.id} className="bg-gray-800 p-6 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between border border-gray-700 gap-4">
                             <div className="flex items-center gap-4">
                                 <img src={c.avatar} className="w-12 h-12 rounded-full"/>
                                 <div><h4 className="font-bold text-base">{c.name}</h4><p className="text-xs text-gray-400">Match Score</p></div>
                             </div>
                             <div className="flex gap-2 flex-wrap justify-end w-full sm:w-auto">
                                 {c.status === "matched" && (
                                     <>
                                        <button onClick={() => sendInvite(c)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm flex items-center gap-2 font-bold"><Plus className="w-4 h-4"/> Invite</button>
                                        <button onClick={() => deleteCandidate(c)} className="bg-gray-700 hover:bg-red-900 px-3 rounded text-red-400"><Trash2 className="w-4 h-4"/></button>
                                     </>
                                 )}
                                 {c.status === "requested" && (
                                     <>
                                        <button onClick={() => acceptRequest(c)} className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded text-sm flex items-center gap-2 font-bold"><Check className="w-4 h-4"/> Accept</button>
                                        <button onClick={() => rejectRequest(c)} className="bg-red-900 hover:bg-red-800 text-red-200 px-3 py-2 rounded text-sm"><X className="w-4 h-4"/></button>
                                     </>
                                 )}
                                 {c.status === "invited" && <span className="text-sm text-gray-500 flex items-center gap-1 px-2"><Clock className="w-4 h-4"/> Pending</span>}
                                 
                                 {c.status === "rejected" && <span className="text-sm text-red-400 bg-red-900/20 px-3 py-1 rounded font-bold">Rejected</span>}

                                 <Link href={`/chat?targetId=${c.id}`}><button className="bg-gray-700 p-2 rounded hover:text-blue-300"><MessageSquare className="w-4 h-4"/></button></Link>
                                 <button onClick={() => openEmailComposer(c)} className="bg-gray-700 p-2 rounded hover:text-green-300"><Mail className="w-4 h-4"/></button>
                                 
                                 {c.status !== "matched" && c.status !== "requested" && (
                                     <button onClick={() => deleteCandidate(c)} className="bg-gray-700 p-2 rounded hover:text-red-400"><Trash2 className="w-4 h-4"/></button>
                                 )}
                             </div>
                         </div>
                     ))}
                 </div>
            </div>
        )}

        <div className="space-y-6">
            <div className="flex items-center justify-between"><h2 className="text-2xl font-bold flex items-center gap-3"><Calendar className="text-purple-500" /> Execution Roadmap</h2>{isLeader && team.project_roadmap && team.project_roadmap.phases && <button onClick={generateRoadmap} disabled={isGenerating} className="text-xs flex items-center gap-2 text-gray-400 hover:text-white transition">{isGenerating ? <Loader2 className="w-3 h-3 animate-spin"/> : <RefreshCw className="w-3 h-3"/>} Regenerate</button>}</div>
            {!team.project_roadmap || !team.project_roadmap.phases ? <div className="text-center py-20 bg-gray-900/30 rounded-3xl border border-gray-800/50"><Bot className="w-16 h-16 mx-auto text-gray-700 mb-4" /><p className="text-gray-500 mb-6">No roadmap yet.</p>{isLeader ? <button onClick={generateRoadmap} disabled={isGenerating} className="px-8 py-4 bg-purple-600 hover:bg-purple-700 rounded-full font-bold transition flex items-center gap-2 mx-auto">{isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles className="w-5 h-5" />} Generate Plan</button> : <p className="text-sm text-gray-600">Waiting for team leader to generate plan.</p>}</div> : <div className="relative border-l-2 border-gray-800 ml-4 space-y-12 pb-12">{team.project_roadmap.phases.map((phase: any, i: number) => <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.2 }} className="relative pl-10"><div className="absolute -left-[9px] top-0 w-4 h-4 bg-purple-500 rounded-full border-4 border-gray-950 shadow-[0_0_10px_rgba(168,85,247,0.5)]"></div><div className="mb-2 flex items-center gap-3"><span className="text-purple-400 font-bold font-mono text-lg">Week {phase.week}</span><span className="text-gray-600">|</span><h3 className="text-xl font-semibold text-white">{phase.goal}</h3></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">{phase.tasks.map((task: any, j: number) => <div key={j} className="bg-gray-900 border border-gray-800 p-4 rounded-xl flex gap-4 hover:border-gray-700 transition"><div className="mt-1">{task.role.toLowerCase().includes('front') ? <LayoutDashboard className="w-5 h-5 text-blue-400" /> : task.role.toLowerCase().includes('back') ? <Code2 className="w-5 h-5 text-green-400" /> : <Layers className="w-5 h-5 text-orange-400" />}</div><div><span className="text-xs font-mono text-gray-500 uppercase tracking-wider block mb-1">{task.role}</span><p className="text-gray-300 text-sm leading-relaxed">{task.task}</p></div></div>)}</div></motion.div>)}</div>}
        </div>
      </div>
      
      {/* Email Modal */}
      <AnimatePresence>{showEmailModal && emailRecipient && (<div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"><motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-gray-900 border border-gray-800 p-8 rounded-2xl w-full max-w-md relative"><div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold flex items-center gap-2"><Mail className="w-5 h-5"/> Send Secure Message</h2><button onClick={() => setShowEmailModal(false)}><X className="text-gray-500 hover:text-white"/></button></div><div className="space-y-4 mt-4"><div className="bg-gray-800/50 p-3 rounded-lg text-sm text-gray-400">To: <span className="text-white font-bold">{emailRecipient.name}</span> (Email Hidden)</div><input className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 outline-none focus:border-green-500" placeholder="Subject" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} /><textarea className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 h-32 outline-none focus:border-green-500 resize-none" placeholder="Message" value={emailBody} onChange={e => setEmailBody(e.target.value)} /><button onClick={handleSendEmail} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2"><Send className="w-4 h-4"/> Send Message</button></div></motion.div></div>)}</AnimatePresence>
    </div>
  );
}