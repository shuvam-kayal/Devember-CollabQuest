"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Cookies from "js-cookie";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { 
  Bot, Calendar, Code2, Layers, LayoutDashboard, Loader2, UserPlus, 
  Sparkles, X, Plus, RefreshCw, Trash2, Shield, Check, AlertTriangle 
} from "lucide-react";

const PRESET_SKILLS = [
  "React", "Python", "Node.js", "TypeScript", "Next.js", "Tailwind", 
  "MongoDB", "Firebase", "Flutter", "Java", "C++", "Rust", "Go", 
  "Figma", "UI/UX", "AI/ML", "Docker", "AWS", "Solidity"
];

interface Member {
    id: string;
    username: string;
    avatar_url: string;
    email: string;
}

interface Team {
  id: string;
  name: string;
  description: string;
  leader_id: string;
  members: Member[];
  needed_skills: string[];
  project_roadmap?: any;
}

interface Suggestions {
    add: string[];
    remove: string[];
}

export default function TeamDetails() {
  const params = useParams();
  const router = useRouter();
  const [team, setTeam] = useState<Team | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);
  
  // AI State
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null); 
  
  // Editing State
  const [isEditingSkills, setIsEditingSkills] = useState(false);
  const [localSkills, setLocalSkills] = useState<string[]>([]);
  const [dropdownValue, setDropdownValue] = useState("");

  const teamId = params.id as string;

  useEffect(() => {
    const token = Cookies.get("token");
    if (!token) return router.push("/");
    
    // Get Me
    axios.get("http://localhost:8000/users/me", { headers: { Authorization: `Bearer ${token}` } })
         .then(res => setCurrentUserId(res.data._id || res.data.id));

    fetchTeamData(token);
  }, [teamId]);

  const fetchTeamData = async (token: string) => {
    try {
      const res = await axios.get(`http://localhost:8000/teams/${teamId}`);
      setTeam(res.data);
      setLocalSkills(res.data.needed_skills || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const isLeader = team && currentUserId === team.leader_id;

  // --- ACTIONS ---
  
  const removeMember = async (memberId: string) => {
      if(!confirm("Are you sure you want to remove this member?")) return;
      const token = Cookies.get("token");
      try {
          await axios.delete(`http://localhost:8000/teams/${teamId}/members/${memberId}`, {
              headers: { Authorization: `Bearer ${token}` }
          });
          if (token) fetchTeamData(token);
      } catch (err) { alert("Failed to remove member"); }
  };

  const addSkill = (skill: string) => {
    if (!localSkills.includes(skill)) setLocalSkills([...localSkills, skill]);
    setDropdownValue("");
  };

  const removeSkill = (skill: string) => {
    setLocalSkills(localSkills.filter(s => s !== skill));
  };

  const saveSkills = async () => {
    const token = Cookies.get("token");
    try {
        await axios.put(`http://localhost:8000/teams/${teamId}/skills`, {
            needed_skills: localSkills
        }, { headers: { Authorization: `Bearer ${token}` } });
        
        if (token) fetchTeamData(token);
        setIsEditingSkills(false);
        setSuggestions(null); 
    } catch (err) {
        alert("Failed to save skills");
    }
  };

  const askAiForStack = async () => {
    setIsSuggesting(true);
    const token = Cookies.get("token");
    try {
        const res = await axios.post("http://localhost:8000/teams/suggest-stack", {
            description: team?.description,
            current_skills: localSkills 
        }, { headers: { Authorization: `Bearer ${token}` } });
        setSuggestions(res.data); 
    } catch (err) { alert("AI Suggestion failed."); } 
    finally { setIsSuggesting(false); }
  };

  const acceptSuggestion = (type: 'add' | 'remove', skill: string) => {
    if (type === 'add') addSkill(skill);
    if (type === 'remove') removeSkill(skill);
    if (suggestions) setSuggestions({ ...suggestions, [type]: suggestions[type].filter(s => s !== skill) });
  };

  const rejectSuggestion = (type: 'add' | 'remove', skill: string) => {
    if (suggestions) setSuggestions({ ...suggestions, [type]: suggestions[type].filter(s => s !== skill) });
  };

  const generateRoadmap = async () => {
    setIsGenerating(true);
    const token = Cookies.get("token");
    try {
      await axios.post(`http://localhost:8000/teams/${teamId}/roadmap`, {}, { headers: { Authorization: `Bearer ${token}` } });
      if (token) fetchTeamData(token);
    } catch (err) { alert("AI Generation failed."); } 
    finally { setIsGenerating(false); }
  };

  if (loading || !team) return <div className="flex h-screen items-center justify-center bg-gray-950 text-white"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-5xl mx-auto">
        
        <header className="mb-8 border-b border-gray-800 pb-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-4xl font-extrabold bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent mb-2">
                {team.name}
              </h1>
              <p className="text-gray-400 max-w-2xl text-lg">{team.description}</p>
            </div>
            
            {/* ONLY SHOW RECRUIT BUTTON TO LEADER */}
            {isLeader && (
                // --- FIX: Include Project ID in the URL ---
                <Link href={`/matches?type=users&projectId=${team.id}`}>
                    <button className="px-6 py-3 bg-white text-black rounded-lg font-bold hover:bg-gray-200 transition flex items-center gap-2 shadow-lg">
                        <UserPlus className="w-5 h-5 text-purple-600" /> Recruit Teammates
                    </button>
                </Link>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* --- SKILLS MANAGER --- */}
              <div className="md:col-span-2 bg-gray-900/50 p-6 rounded-2xl border border-gray-800">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold flex items-center gap-2">
                        <Code2 className="text-purple-400 w-5 h-5" /> Tech Stack
                    </h3>
                    {isLeader && !isEditingSkills && (
                        <button onClick={() => setIsEditingSkills(true)} className="text-xs text-purple-400 hover:text-purple-300 font-mono border border-purple-500/30 px-3 py-1 rounded">Edit Stack</button>
                    )}
                    {isEditingSkills && (
                        <div className="flex gap-2">
                            <button onClick={askAiForStack} disabled={isSuggesting} className="text-xs bg-blue-600 text-white px-3 py-1 rounded flex gap-1">{isSuggesting ? <Loader2 className="w-3 h-3 animate-spin"/> : <Sparkles className="w-3 h-3"/>} AI</button>
                            <button onClick={saveSkills} className="text-xs bg-green-600 text-white px-3 py-1 rounded">Save</button>
                        </div>
                    )}
                </div>

                {/* AI Suggestions Panel */}
                {isEditingSkills && suggestions && (suggestions.add.length > 0 || suggestions.remove.length > 0) && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mb-4 bg-black/40 border border-blue-500/30 rounded-xl p-3">
                        <h4 className="text-[10px] font-bold text-blue-400 mb-2 uppercase">AI Suggestions</h4>
                        <div className="flex flex-wrap gap-2">
                            {suggestions.add.map(s => (
                                <div key={s} className="flex items-center gap-1 bg-blue-900/20 border border-blue-500/50 px-2 py-1 rounded text-xs text-blue-200">
                                    {s} <button onClick={() => acceptSuggestion('add', s)}><Check className="w-3 h-3 text-green-400"/></button>
                                </div>
                            ))}
                            {suggestions.remove.map(s => (
                                <div key={s} className="flex items-center gap-1 bg-red-900/20 border border-red-500/50 px-2 py-1 rounded text-xs text-red-200">
                                    {s} <button onClick={() => acceptSuggestion('remove', s)}><Check className="w-3 h-3 text-red-400"/></button>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}

                <div className="flex flex-wrap gap-2">
                    {(isEditingSkills ? localSkills : team.needed_skills).map((skill, k) => (
                        <span key={k} className="bg-gray-800 px-3 py-1 rounded-full text-sm border border-gray-700 flex items-center gap-2">
                            {skill}
                            {isEditingSkills && <button onClick={() => removeSkill(skill)}><X className="w-3 h-3 hover:text-red-400"/></button>}
                        </span>
                    ))}
                    {isEditingSkills && (
                        <div className="relative">
                            <select className="bg-gray-950 border border-gray-700 text-sm rounded-full px-3 py-1 outline-none" value={dropdownValue} onChange={(e) => addSkill(e.target.value)}>
                                <option value="" disabled>+ Add</option>
                                {PRESET_SKILLS.filter(s => !localSkills.includes(s)).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    )}
                </div>
              </div>

              {/* --- MEMBERS LIST --- */}
              <div className="bg-gray-900/50 p-6 rounded-2xl border border-gray-800">
                  <h3 className="font-bold flex items-center gap-2 mb-4">
                      <UserPlus className="text-green-400 w-5 h-5" /> Team ({team.members.length})
                  </h3>
                  <div className="space-y-3">
                      {team.members.map((m: any, i: number) => {
                          if (typeof m === 'string') return null;
                          return (
                            <div key={m.id || i} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <img src={m.avatar_url || "https://github.com/shadcn.png"} className="w-8 h-8 rounded-full bg-gray-800"/>
                                    <div>
                                        <p className="text-sm font-bold leading-none">{m.username}</p>
                                        {m.id === team.leader_id && <span className="text-[10px] text-yellow-500 font-mono">LEADER</span>}
                                    </div>
                                </div>
                                {isLeader && m.id !== team.leader_id && (
                                    <button onClick={() => removeMember(m.id)} className="text-gray-600 hover:text-red-500">
                                        <Trash2 className="w-4 h-4"/>
                                    </button>
                                )}
                            </div>
                          );
                      })}
                  </div>
              </div>
          </div>
        </header>

        {/* --- ROADMAP SECTION --- */}
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center gap-3">
                    <Calendar className="text-purple-500" /> Execution Roadmap
                </h2>
                {isLeader && team.project_roadmap && team.project_roadmap.phases && (
                    <button onClick={generateRoadmap} disabled={isGenerating} className="text-xs flex items-center gap-2 text-gray-400 hover:text-white transition">
                        {isGenerating ? <Loader2 className="w-3 h-3 animate-spin"/> : <RefreshCw className="w-3 h-3"/>} Regenerate
                    </button>
                )}
            </div>

            {!team.project_roadmap || !team.project_roadmap.phases ? (
                <div className="text-center py-20 bg-gray-900/30 rounded-3xl border border-gray-800/50">
                    <Bot className="w-16 h-16 mx-auto text-gray-700 mb-4" />
                    <p className="text-gray-500 mb-6">No roadmap yet.</p>
                    {isLeader ? (
                        <button onClick={generateRoadmap} disabled={isGenerating} className="px-8 py-4 bg-purple-600 hover:bg-purple-700 rounded-full font-bold transition flex items-center gap-2 mx-auto">
                            {isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles className="w-5 h-5" />} Generate Plan
                        </button>
                    ) : (
                        <p className="text-sm text-gray-600">Waiting for team leader to generate plan.</p>
                    )}
                </div>
            ) : (
                <div className="relative border-l-2 border-gray-800 ml-4 space-y-12 pb-12">
                    {team.project_roadmap.phases.map((phase: any, i: number) => (
                        <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.2 }} className="relative pl-10">
                            <div className="absolute -left-[9px] top-0 w-4 h-4 bg-purple-500 rounded-full border-4 border-gray-950 shadow-[0_0_10px_rgba(168,85,247,0.5)]"></div>
                            <div className="mb-2 flex items-center gap-3">
                                <span className="text-purple-400 font-bold font-mono text-lg">Week {phase.week}</span>
                                <span className="text-gray-600">|</span>
                                <h3 className="text-xl font-semibold text-white">{phase.goal}</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                {phase.tasks.map((task: any, j: number) => (
                                    <div key={j} className="bg-gray-900 border border-gray-800 p-4 rounded-xl flex gap-4 hover:border-gray-700 transition">
                                        <div className="mt-1">
                                            {task.role.toLowerCase().includes('front') ? <LayoutDashboard className="w-5 h-5 text-blue-400" /> : 
                                             task.role.toLowerCase().includes('back') ? <Code2 className="w-5 h-5 text-green-400" /> : 
                                             <Layers className="w-5 h-5 text-orange-400" />}
                                        </div>
                                        <div>
                                            <span className="text-xs font-mono text-gray-500 uppercase tracking-wider block mb-1">{task.role}</span>
                                            <p className="text-gray-300 text-sm leading-relaxed">{task.task}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
      </div>
    </div>
  );
}