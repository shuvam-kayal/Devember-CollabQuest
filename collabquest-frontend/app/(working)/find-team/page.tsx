"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import api from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, Users, Code2, ArrowRight, Sparkles, UserPlus, X, 
  Search, SlidersHorizontal, Filter, Briefcase, Star, Heart, Activity,
  CheckCircle2, AlertCircle
} from "lucide-react";
import Link from "next/link";

const PRESET_SKILLS = [
  "React", "Python", "Node.js", "TypeScript", "Next.js",
  "Tailwind", "MongoDB", "Firebase", "Flutter", "Java",
  "C++", "Rust", "Go", "Figma", "UI/UX", "AI/ML",
  "Docker", "AWS", "Solidity", "Blockchain"
];

const PROJECT_STATUSES = ["planning", "active", "completed"];

interface Team {
  _id: string;
  name: string;
  description: string;
  members: string[];
  needed_skills: string[];
  active_needed_skills?: string[];
  is_looking_for_members?: boolean;
  status?: string;
  leader_id?: string;
}

export default function FindTeam() {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [userId, setUserId] = useState("");
  const [userFavorites, setUserFavorites] = useState<string[]>([]);
  const [showModal, setShowModal] = useState(false);

  // Creation State
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [neededSkills, setNeededSkills] = useState<string[]>([]);
  const [dropdownValue, setDropdownValue] = useState("");

  // Search & Filter States
  const [mySearch, setMySearch] = useState("");
  const [myFilters, setMyFilters] = useState({ techStack: [] as string[], status: "", roles: "" });
  const [showMyFilters, setShowMyFilters] = useState(false);

  const [joinSearch, setJoinSearch] = useState("");
  const [joinFilters, setJoinFilters] = useState({ 
    techStack: [] as string[], 
    status: "", 
    roles: "", 
    minMembers: "", 
    recruitingOnly: false 
  });
  const [showJoinFilters, setShowJoinFilters] = useState(false);

  // --- 1. MOUSE STATE FOR GLOW ---
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // --- 2. MOUSE EFFECT HOOK ---
  useEffect(() => {
    const updateMousePosition = (ev: MouseEvent) => {
      setMousePosition({ x: ev.clientX, y: ev.clientY });
    };
    window.addEventListener("mousemove", updateMousePosition);
    return () => {
      window.removeEventListener("mousemove", updateMousePosition);
    };
  }, []);

  useEffect(() => {
    const token = Cookies.get("token");
    if (!token) return router.push("/");

    const init = async () => {
        try {
            const userRes = await api.get("/users/me");
            setUserId(userRes.data._id || userRes.data.id);
            setUserFavorites(userRes.data.favorites || []);
            
            const teamRes = await api.get("/teams/");
            setTeams(teamRes.data);
        } catch (e) { console.error(e); }
    };
    init();
  }, []);

  const toggleFavorite = async (teamId: string) => {
      try {
          const res = await api.post(`/users/favorites/${teamId}`);
          setUserFavorites(res.data.favorites);
      } catch (e) { console.error("Fav failed", e); }
  };

  const handleCreate = async () => {
    if(!name || !desc) return alert("Name and description required");
    try {
      await api.post("/teams/", {
        name: name,
        description: desc,
        needed_skills: neededSkills,
        active_needed_skills: neededSkills 
      });
      setShowModal(false);
      setName(""); setDesc(""); setNeededSkills([]);
      
      // Refresh teams
      const res = await api.get("/teams/");
      setTeams(res.data);
    } catch (err) { alert("Failed to create team"); }
  };

  const addSkill = (skill: string) => {
    if (!skill || neededSkills.includes(skill)) return;
    setNeededSkills([...neededSkills, skill]);
    setDropdownValue("");
  };

  // Generic Filter Function
  const filterTeams = (list: Team[], search: string, filters: any, excludeUser: boolean) => {
      return list.filter(t => {
          if (excludeUser && t.members.includes(userId)) return false;
          if (!excludeUser && !t.members.includes(userId)) return false;

          // Search Name
          if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
          
          // Status
          if (filters.status && (t.status || "planning") !== filters.status) return false;

          // Tech Stack (Match Any)
          if (filters.techStack && filters.techStack.length > 0) {
             const teamStack = (t.needed_skills || []).concat(t.active_needed_skills || []);
             if (!filters.techStack.some((s: string) => teamStack.includes(s))) return false;
          }

          // Open Roles (Text Search)
          if (filters.roles) {
             const roles = (t.active_needed_skills || t.needed_skills || []).join(" ").toLowerCase();
             if (!roles.includes(filters.roles.toLowerCase())) return false;
          }

          // Join Specific Filters
          if (filters.recruitingOnly && t.is_looking_for_members === false) return false;
          if (filters.minMembers && t.members.length < parseInt(filters.minMembers)) return false;

          return true;
      });
  };

  const myFilteredProjects = filterTeams(teams, mySearch, myFilters, false);
  const joinFilteredProjects = filterTeams(teams, joinSearch, joinFilters, true);

  return (
    <div className="min-h-screen w-full bg-transparent text-zinc-100 font-sans selection:bg-purple-500/30 relative overflow-hidden">
            
      
      <div 
        className="pointer-events-none fixed inset-0 z-30 transition-opacity duration-300"
        style={{
          background: `radial-gradient(800px at ${mousePosition.x}px ${mousePosition.y}px, rgba(168, 85, 247, 0.1), transparent 80%)`,
        }}
      />

      {/* --- 5. STATIC BACKGROUND AMBIENCE --- */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[60%] bg-purple-900/10 blur-[100px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[50%] bg-blue-900/10 blur-[120px] rounded-full mix-blend-screen" />
      </div>

      {/* --- 6. CONTENT WRAPPER (z-40 sits on top of glow) --- */}
      <div className="relative z-40 max-w-7xl mx-auto p-4 md:p-8">
        
        {/* --- HEADER --- */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-white mb-2">
                Project <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">Marketplace</span>
            </h1>
            <p className="text-gray-400">Manage your squads or find your next mission.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/matches?type=projects">
              <button className="flex items-center gap-2 bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border border-yellow-500/30 text-yellow-400 px-5 py-3 rounded-xl font-bold hover:bg-yellow-600/20 transition shadow-lg shadow-yellow-900/10">
                <Sparkles className="w-4 h-4" /> Smart Match
              </button>
            </Link>
            <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-white text-black px-6 py-3 rounded-xl font-bold hover:bg-gray-200 transition shadow-lg shadow-white/10">
              <Plus className="w-4 h-4" /> Post Idea
            </button>
          </div>
        </div>

        {/* --- SECTION 1: MY PROJECTS --- */}
        {teams.some(t => t.members.includes(userId)) && (
          <div className="mb-16">
            <div className="flex justify-between items-end mb-6 border-b border-white/5 pb-4">
                 <h2 className="text-xl font-bold flex items-center gap-2"><Code2 className="text-purple-400" /> My Projects</h2>
                 <div className="flex gap-2 w-full max-w-md">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input value={mySearch} onChange={(e) => setMySearch(e.target.value)} placeholder="Search my projects..." className="w-full bg-[#13161C] border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:border-purple-500 outline-none transition-all" />
                    </div>
                    <button onClick={() => setShowMyFilters(!showMyFilters)} className={`p-2.5 rounded-xl border transition-all ${showMyFilters ? 'bg-purple-600 border-purple-500 text-white' : 'bg-[#13161C] border-white/10 text-gray-400 hover:text-white'}`}>
                        <SlidersHorizontal className="w-4 h-4" />
                    </button>
                 </div>
            </div>

            {/* My Project Filters */}
            <AnimatePresence>
                {showMyFilters && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mb-6 overflow-hidden">
                        <div className="bg-[#13161C] border border-white/10 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                             <div>
                                <label className="text-[10px] uppercase text-gray-500 font-bold mb-2 block">Tech Stack</label>
                                <select className="w-full bg-black/30 border border-white/10 rounded-xl p-2.5 text-sm outline-none text-gray-300" onChange={(e) => { if(e.target.value && !myFilters.techStack.includes(e.target.value)) setMyFilters({...myFilters, techStack: [...myFilters.techStack, e.target.value]}) }}>
                                    <option value="">Select Tech</option>
                                    {PRESET_SKILLS.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <div className="flex flex-wrap gap-2 mt-2">{myFilters.techStack.map(s => <span key={s} onClick={() => setMyFilters({...myFilters, techStack: myFilters.techStack.filter(x => x!==s)})} className="text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-1 rounded cursor-pointer hover:bg-purple-500/20">{s} x</span>)}</div>
                             </div>
                             {/* Add other My filters here if needed similar to Join Filters */}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {myFilteredProjects.map(team => (
                    <ProjectCard key={team._id} team={team} isLeader={true} isFavorite={userFavorites.includes(team._id)} onToggleFav={toggleFavorite} userId={userId} />
                ))}
            </div>
          </div>
        )}

        {/* --- SECTION 2: JOIN PROJECTS --- */}
        <div>
          <div className="flex items-center gap-3 mb-6">
             <h2 className="text-xl font-bold flex items-center gap-2"><Users className="text-blue-400" /> Join a Team</h2>
             <span className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded text-xs font-bold border border-blue-500/20">{joinFilteredProjects.length} Available</span>
          </div>
          
           {/* Join Project Search & Filter */}
            <div className="mb-8 flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input value={joinSearch} onChange={(e) => setJoinSearch(e.target.value)} placeholder="Search for your next mission..." className="w-full bg-[#13161C] border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-base focus:border-blue-500 outline-none transition-all shadow-xl" />
                </div>
                <button onClick={() => setShowJoinFilters(!showJoinFilters)} className={`px-6 rounded-2xl border transition-all flex items-center gap-2 font-bold text-sm ${showJoinFilters ? 'bg-blue-600 border-blue-500 text-white' : 'bg-[#13161C] border-white/10 text-gray-400 hover:text-white'}`}>
                    <SlidersHorizontal className="w-4 h-4" /> Filters
                </button>
            </div>

             {/* Join Filters Panel */}
            <AnimatePresence>
                {showJoinFilters && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mb-8 overflow-hidden">
                        <div className="bg-[#13161C] border border-white/10 rounded-3xl p-6 grid grid-cols-1 md:grid-cols-4 gap-6 relative overflow-hidden">
                             {/* Background noise texture could go here */}
                             <div>
                                <label className="text-[10px] uppercase text-gray-500 font-bold mb-2 block">Tech Stack</label>
                                <select className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-sm outline-none text-gray-300 focus:border-blue-500 transition" onChange={(e) => { if(e.target.value && !joinFilters.techStack.includes(e.target.value)) setJoinFilters({...joinFilters, techStack: [...joinFilters.techStack, e.target.value]}) }}>
                                    <option value="">Select Tech</option>
                                    {PRESET_SKILLS.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <div className="flex flex-wrap gap-2 mt-3">{joinFilters.techStack.map(s => <span key={s} onClick={() => setJoinFilters({...joinFilters, techStack: joinFilters.techStack.filter(x => x!==s)})} className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-1 rounded cursor-pointer hover:bg-blue-500/20 transition">{s} x</span>)}</div>
                             </div>
                             <div>
                                <label className="text-[10px] uppercase text-gray-500 font-bold mb-2 block">Project Status</label>
                                <select value={joinFilters.status} onChange={(e) => setJoinFilters({...joinFilters, status: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-sm outline-none text-gray-300 focus:border-blue-500 transition">
                                    <option value="">All Statuses</option>
                                    {PROJECT_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                                </select>
                             </div>
                             <div>
                                <label className="text-[10px] uppercase text-gray-500 font-bold mb-2 block">Role Keywords</label>
                                <input value={joinFilters.roles} onChange={(e) => setJoinFilters({...joinFilters, roles: e.target.value})} placeholder="e.g. Frontend" className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-sm outline-none text-gray-300 focus:border-blue-500 transition" />
                             </div>
                             <div>
                                 <label className="text-[10px] uppercase text-gray-500 font-bold mb-2 block">Advanced</label>
                                 <div className="flex items-center justify-between mb-3 bg-black/30 p-2 rounded-lg border border-white/5">
                                    <label className="text-xs text-gray-300 cursor-pointer" htmlFor="recruiting">Recruiting Only</label>
                                    <input id="recruiting" type="checkbox" checked={joinFilters.recruitingOnly} onChange={(e) => setJoinFilters({...joinFilters, recruitingOnly: e.target.checked})} className="accent-blue-500 w-4 h-4" />
                                 </div>
                                 <input type="number" value={joinFilters.minMembers} onChange={(e) => setJoinFilters({...joinFilters, minMembers: e.target.value})} placeholder="Min Members" className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-sm outline-none text-gray-300 focus:border-blue-500 transition" />
                             </div>
                             <div className="col-span-full flex justify-end">
                                <button onClick={() => setJoinFilters({ techStack: [], status: "", roles: "", minMembers: "", recruitingOnly: false })} className="text-xs text-gray-500 hover:text-white flex items-center gap-1 transition"><X className="w-3 h-3" /> Clear Filters</button>
                             </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

          {joinFilteredProjects.length === 0 ? (
            <div className="text-center py-24 bg-[#13161C] rounded-3xl border border-white/5 border-dashed">
                <div className="bg-white/5 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Search className="w-8 h-8 text-gray-500" />
                </div>
                <h3 className="text-xl font-bold text-gray-300 mb-2">No projects found.</h3>
                <p className="text-gray-500">Try adjusting your filters to broaden your search.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {joinFilteredProjects.map(team => (
                    <ProjectCard key={team._id} team={team} isLeader={false} isFavorite={userFavorites.includes(team._id)} onToggleFav={toggleFavorite} userId={userId} />
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-[#13161C] border border-white/10 p-8 rounded-3xl w-full max-w-lg relative shadow-2xl">
              <div className="flex justify-between items-center mb-8">
                  <h2 className="text-2xl font-black tracking-tight text-white">Launch Project 🚀</h2>
                  <button onClick={() => setShowModal(false)} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition"><X className="w-5 h-5 text-gray-400" /></button>
              </div>
              
              <div className="space-y-5">
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Project Name</label>
                    <input className="w-full bg-black/30 border border-white/10 rounded-xl p-4 outline-none focus:border-purple-500 transition text-white" placeholder="e.g. Orbital AI" value={name} onChange={e => setName(e.target.value)} />
                </div>
                
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Mission Description</label>
                    <textarea className="w-full bg-black/30 border border-white/10 rounded-xl p-4 h-32 outline-none focus:border-purple-500 resize-none text-white" placeholder="What are you building?" value={desc} onChange={e => setDesc(e.target.value)} />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Needed Skills</label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {neededSkills.map(s => (
                      <span key={s} className="bg-purple-500/10 border border-purple-500/20 text-purple-300 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2">
                        {s}<button onClick={() => setNeededSkills(neededSkills.filter(x => x!==s))} className="hover:text-white"><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                  <div className="relative">
                    <select className="w-full bg-black/30 border border-white/10 rounded-xl p-4 outline-none focus:border-purple-500 appearance-none cursor-pointer text-gray-400" value={dropdownValue} onChange={(e) => addSkill(e.target.value)}>
                      <option value="" disabled>+ Add Skill Stack</option>
                      {PRESET_SKILLS.filter(s => !neededSkills.includes(s)).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <Plus className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500" />
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                    <button onClick={handleCreate} className="flex-1 bg-white text-black font-bold py-4 rounded-xl hover:bg-gray-200 transition">Publish Project</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- PROJECT CARD COMPONENT ---
function ProjectCard({ team, isLeader, isFavorite, onToggleFav, userId }: any) {
  const isOpen = team.is_looking_for_members !== false;
  // Fallback to determine if user is just a member or the leader for logic
  const actualIsLeader = team.leader_id === userId || team.members[0] === userId; 
  
  const activeRoles = team.active_needed_skills && team.active_needed_skills.length > 0 
                      ? team.active_needed_skills 
                      : (team.needed_skills || []);
  
  let statusColor = "text-gray-400 bg-gray-800 border-gray-700";
  if (team.status === "completed") statusColor = "text-emerald-400 bg-emerald-900/20 border-emerald-500/30";
  else if (team.status === "active") statusColor = "text-indigo-400 bg-indigo-900/20 border-indigo-500/30";
  else statusColor = "text-blue-400 bg-blue-900/20 border-blue-500/30"; 

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-[#13161C] border border-white/5 p-6 rounded-3xl flex flex-col hover:border-white/10 transition-all relative group shadow-lg shadow-black/20">
      
      {/* HEADER */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-800 to-black border border-white/10 flex items-center justify-center font-bold text-gray-500">
                {team.name.charAt(0).toUpperCase()}
            </div>
            <div>
                <h3 className="text-lg font-bold text-gray-100 line-clamp-1 leading-tight">{team.name}</h3>
                <p className="text-[10px] text-gray-500 font-mono mt-0.5">ID: {team._id.slice(-4).toUpperCase()}</p>
            </div>
        </div>
        <button onClick={() => onToggleFav(team._id)} className="text-gray-600 hover:text-yellow-400 transition">
            <Star className={`w-5 h-5 ${isFavorite ? 'text-yellow-400 fill-yellow-400' : ''}`} />
        </button>
      </div>
      
      <div className="flex items-center gap-2 mb-4">
        <span className={`text-[10px] px-2 py-0.5 rounded border uppercase font-bold tracking-wider ${statusColor}`}>
            {team.status || "Planning"}
        </span>
        {isOpen && (
            <span className="inline-flex items-center gap-1 text-[10px] bg-green-500/10 text-green-400 px-2 py-0.5 rounded border border-green-500/20 font-bold uppercase tracking-wide">
                <Activity className="w-3 h-3" /> Recruiting
            </span>
        )}
      </div>

      <p className="text-gray-400 text-sm line-clamp-2 mb-6 flex-grow leading-relaxed">{team.description}</p>

      {/* ROLES */}
      <div className="mb-6 bg-black/20 p-3 rounded-xl border border-white/5">
        <p className="text-[10px] text-gray-500 uppercase font-bold mb-2 flex items-center gap-1">
            <Briefcase className="w-3 h-3" /> Open Roles
        </p>
        <div className="flex flex-wrap gap-1.5">
            {activeRoles.length > 0 ? activeRoles.slice(0, 3).map((skill: string, k: number) => (
                <span key={k} className="text-[10px] bg-white/5 px-2 py-1 rounded-md text-gray-300 border border-white/5">{skill}</span>
            )) : <span className="text-[10px] text-gray-600 italic">No specific roles listed</span>}
            {activeRoles.length > 3 && <span className="text-[10px] text-gray-500 px-1 pt-1">+{activeRoles.length - 3}</span>}
        </div>
      </div>

      {/* ACTION AREA */}
      <div className="mt-auto border-t border-white/5 pt-4 flex gap-3">
        {actualIsLeader ? (
            <>
                <Link href={`/teams/${team._id}`} className="flex-1">
                    <button className="w-full py-2 bg-white/5 rounded-xl text-xs font-bold border border-white/10 hover:bg-white/10 hover:text-white text-gray-300 transition">Manage</button>
                </Link>
                <Link href={`/matches?type=users&projectId=${team._id}`} className="flex-1">
                    <button className="w-full py-2 bg-purple-600/10 rounded-xl text-xs font-bold border border-purple-500/20 hover:bg-purple-600 hover:text-white text-purple-400 transition flex items-center justify-center gap-1">
                        <UserPlus className="w-3 h-3" /> Recruit
                    </button>
                </Link>
            </>
        ) : (
            <Link href={`/teams/${team._id}`} className="w-full">
                <button className="w-full py-2.5 bg-white text-black rounded-xl text-xs font-bold hover:bg-gray-200 transition flex items-center justify-center gap-2">
                    View Project <ArrowRight className="w-3 h-3" />
                </button>
            </Link>
        )}
      </div>
    </motion.div>
  )
}