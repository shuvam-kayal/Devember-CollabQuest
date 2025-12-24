"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import api from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, Users, Code2, ArrowRight, Sparkles, UserPlus, X, 
  Search, SlidersHorizontal, Filter, Briefcase, Star, Heart, Activity 
} from "lucide-react";
import Link from "next/link";
import GlobalHeader from "@/components/GlobalHeader";

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

  // Search & Filter States (Separate for each section)
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

  useEffect(() => {
    const token = Cookies.get("token");
    if (!token) return router.push("/");

    api.get("/users/me").then(res => {
        setUserId(res.data._id || res.data.id);
        setUserFavorites(res.data.favorites || []);
    });

    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      const res = await api.get("/teams/");
      setTeams(res.data);
    } catch (error) { console.error(error); }
  };

  const toggleFavorite = async (teamId: string) => {
      try {
          const res = await api.post(`/users/favorites/${teamId}`);
          setUserFavorites(res.data.favorites);
      } catch (e) { console.error("Fav failed", e); }
  };

  const handleCreate = async () => {
    try {
      await api.post("/teams/", {
        name: name,
        description: desc,
        needed_skills: neededSkills,
        active_needed_skills: neededSkills 
      });
      setShowModal(false);
      setName(""); setDesc(""); setNeededSkills([]);
      fetchTeams();
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
    <div className="min-h-screen bg-gray-950 text-white">
      <GlobalHeader />

      <div className="max-w-6xl mx-auto p-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">Marketplace</h1>
            <p className="text-gray-400 mt-1">Manage your teams or find a new one.</p>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link href="/matches?type=projects">
              <button className="flex items-center gap-2 bg-gray-800 border border-gray-700 px-4 py-2 rounded-full font-bold hover:bg-gray-700 transition">
                <Sparkles className="w-4 h-4 text-yellow-400" /> Smart Match
              </button>
            </Link>
            <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-purple-600 px-4 py-2 rounded-full font-bold hover:bg-purple-700 transition">
              <Plus className="w-4 h-4" /> Post Idea
            </button>
          </div>
        </div>

        {/* --- SECTION 1: MY PROJECTS --- */}
        {teams.some(t => t.members.includes(userId)) && (
          <div className="mb-12">
            <div className="flex justify-between items-end mb-4 border-b border-purple-500/30 pb-2">
                 <h2 className="text-xl font-bold text-purple-300">My Projects</h2>
                 <div className="flex gap-2 w-full max-w-md">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                        <input value={mySearch} onChange={(e) => setMySearch(e.target.value)} placeholder="Search my projects..." className="w-full bg-gray-900 border border-gray-800 rounded-lg py-1.5 pl-9 pr-3 text-xs focus:border-purple-500 outline-none transition-all" />
                    </div>
                    <button onClick={() => setShowMyFilters(!showMyFilters)} className={`p-1.5 rounded-lg border ${showMyFilters ? 'bg-purple-600 border-purple-500' : 'bg-gray-900 border-gray-800 hover:border-gray-700'}`}>
                        <SlidersHorizontal className="w-4 h-4" />
                    </button>
                 </div>
            </div>

            {/* My Project Filters */}
            <AnimatePresence>
                {showMyFilters && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mb-4 overflow-hidden">
                        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                             <div>
                                <label className="text-[10px] uppercase text-gray-500 font-bold mb-1 block">Tech Stack</label>
                                <select className="w-full bg-black border border-gray-700 rounded-lg p-2 text-xs outline-none" onChange={(e) => { if(e.target.value && !myFilters.techStack.includes(e.target.value)) setMyFilters({...myFilters, techStack: [...myFilters.techStack, e.target.value]}) }}>
                                    <option value="">Select Tech</option>
                                    {PRESET_SKILLS.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <div className="flex flex-wrap gap-1 mt-1">{myFilters.techStack.map(s => <span key={s} onClick={() => setMyFilters({...myFilters, techStack: myFilters.techStack.filter(x => x!==s)})} className="text-[10px] bg-purple-900/30 text-purple-300 px-1 rounded cursor-pointer">{s} x</span>)}</div>
                             </div>
                             <div>
                                <label className="text-[10px] uppercase text-gray-500 font-bold mb-1 block">Project Status</label>
                                <select value={myFilters.status} onChange={(e) => setMyFilters({...myFilters, status: e.target.value})} className="w-full bg-black border border-gray-700 rounded-lg p-2 text-xs outline-none">
                                    <option value="">All Statuses</option>
                                    {PROJECT_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                                </select>
                             </div>
                             <div>
                                <label className="text-[10px] uppercase text-gray-500 font-bold mb-1 block">Open Roles (Keyword)</label>
                                <input value={myFilters.roles} onChange={(e) => setMyFilters({...myFilters, roles: e.target.value})} placeholder="e.g. Designer" className="w-full bg-black border border-gray-700 rounded-lg p-2 text-xs outline-none" />
                             </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {myFilteredProjects.map(team => (
                    <ProjectCard key={team._id} team={team} isLeader={team.members[0] === userId} isFavorite={userFavorites.includes(team._id)} onToggleFav={toggleFavorite} />
                ))}
            </div>
          </div>
        )}

        {/* --- SECTION 2: JOIN PROJECTS --- */}
        <div>
          <h2 className="text-xl font-bold mb-4 text-blue-300 border-b border-blue-500/30 pb-2 inline-block">Join a Team</h2>
          
           {/* Join Project Search & Filter */}
            <div className="mb-6 flex gap-2 relative z-20">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input value={joinSearch} onChange={(e) => setJoinSearch(e.target.value)} placeholder="Search open projects by name..." className="w-full bg-gray-900 border border-gray-800 rounded-xl py-3 pl-10 pr-4 text-sm focus:border-blue-500 outline-none transition-all" />
                </div>
                <button onClick={() => setShowJoinFilters(!showJoinFilters)} className={`p-3 rounded-xl border transition-all flex items-center gap-2 font-bold text-sm ${showJoinFilters ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white'}`}>
                    <SlidersHorizontal className="w-4 h-4" /> Filters
                </button>
            </div>

             {/* Join Filters Panel */}
            <AnimatePresence>
                {showJoinFilters && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mb-8 overflow-hidden">
                        <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-4 gap-4 backdrop-blur-md">
                             <div>
                                <label className="text-[10px] uppercase text-gray-500 font-bold mb-1 block">Tech Stack</label>
                                <select className="w-full bg-black border border-gray-700 rounded-lg p-2 text-xs outline-none" onChange={(e) => { if(e.target.value && !joinFilters.techStack.includes(e.target.value)) setJoinFilters({...joinFilters, techStack: [...joinFilters.techStack, e.target.value]}) }}>
                                    <option value="">Select Tech</option>
                                    {PRESET_SKILLS.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <div className="flex flex-wrap gap-1 mt-1">{joinFilters.techStack.map(s => <span key={s} onClick={() => setJoinFilters({...joinFilters, techStack: joinFilters.techStack.filter(x => x!==s)})} className="text-[10px] bg-blue-900/30 text-blue-300 px-1 rounded cursor-pointer">{s} x</span>)}</div>
                             </div>
                             <div>
                                <label className="text-[10px] uppercase text-gray-500 font-bold mb-1 block">Status</label>
                                <select value={joinFilters.status} onChange={(e) => setJoinFilters({...joinFilters, status: e.target.value})} className="w-full bg-black border border-gray-700 rounded-lg p-2 text-xs outline-none">
                                    <option value="">All Statuses</option>
                                    {PROJECT_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                                </select>
                             </div>
                             <div>
                                <label className="text-[10px] uppercase text-gray-500 font-bold mb-1 block">Open Roles (Keyword)</label>
                                <input value={joinFilters.roles} onChange={(e) => setJoinFilters({...joinFilters, roles: e.target.value})} placeholder="e.g. Frontend" className="w-full bg-black border border-gray-700 rounded-lg p-2 text-xs outline-none" />
                             </div>
                             <div>
                                 <label className="text-[10px] uppercase text-gray-500 font-bold mb-1 block">Filters</label>
                                 <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs text-gray-300">Recruiting Only</label>
                                    <input type="checkbox" checked={joinFilters.recruitingOnly} onChange={(e) => setJoinFilters({...joinFilters, recruitingOnly: e.target.checked})} className="accent-blue-500 w-4 h-4" />
                                 </div>
                                 <input type="number" value={joinFilters.minMembers} onChange={(e) => setJoinFilters({...joinFilters, minMembers: e.target.value})} placeholder="Min Members" className="w-full bg-black border border-gray-700 rounded-lg p-2 text-xs outline-none" />
                             </div>
                             <div className="col-span-full border-t border-gray-800 pt-2 flex justify-end">
                                <button onClick={() => setJoinFilters({ techStack: [], status: "", roles: "", minMembers: "", recruitingOnly: false })} className="text-xs text-gray-500 hover:text-white mr-4">Reset</button>
                             </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

          {joinFilteredProjects.length === 0 ? (
            <div className="text-center py-20 bg-gray-900/30 rounded-2xl border border-gray-800 border-dashed">
                <Search className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-400">No projects found.</h3>
                <p className="text-gray-500">Try adjusting your filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {joinFilteredProjects.map(team => (
                    <ProjectCard key={team._id} team={team} isLeader={false} isFavorite={userFavorites.includes(team._id)} onToggleFav={toggleFavorite} />
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-gray-900 border border-gray-800 p-8 rounded-2xl w-full max-w-md relative">
              <h2 className="text-2xl font-bold mb-6">Launch a Project 🚀</h2>
              <div className="space-y-4">
                <input className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 outline-none focus:border-purple-500" placeholder="Project Name" value={name} onChange={e => setName(e.target.value)} />
                <textarea className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 h-24 outline-none focus:border-purple-500 resize-none" placeholder="Description" value={desc} onChange={e => setDesc(e.target.value)} />

                <div>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {neededSkills.map(s => (
                      <span key={s} className="bg-purple-900/50 border border-purple-500/30 text-purple-200 px-3 py-1 rounded-full text-sm flex items-center gap-1">
                        {s}<button onClick={() => setNeededSkills(neededSkills.filter(x => x!==s))} className="hover:text-white"><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                  <div className="relative">
                    <select className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 outline-none focus:border-purple-500 appearance-none cursor-pointer" value={dropdownValue} onChange={(e) => addSkill(e.target.value)}>
                      <option value="" disabled>+ Add Skill</option>
                      {PRESET_SKILLS.filter(s => !neededSkills.includes(s)).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <Plus className="w-3 h-3 absolute right-3 top-3.5 pointer-events-none text-gray-500" />
                  </div>
                </div>

                <button onClick={handleCreate} className="w-full bg-white text-black font-bold py-3 rounded-lg hover:bg-gray-200 mt-2">Publish Project</button>
                <button onClick={() => setShowModal(false)} className="w-full text-gray-500 py-3 text-sm hover:text-white">Cancel</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ProjectCard({ team, isLeader, isFavorite, onToggleFav }: any) {
  const isOpen = team.is_looking_for_members !== false;
  const activeRoles = team.active_needed_skills && team.active_needed_skills.length > 0 
                      ? team.active_needed_skills 
                      : (team.needed_skills || []);
  
  let statusColor = "text-gray-400 bg-gray-800";
  if (team.status === "completed") statusColor = "text-yellow-400 bg-yellow-900/30 border-yellow-500/30";
  else if (team.status === "active") statusColor = "text-green-400 bg-green-900/30 border-green-500/30";
  else statusColor = "text-blue-400 bg-blue-900/30 border-blue-500/30"; 

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-gray-900 border border-gray-800 p-6 rounded-2xl flex flex-col hover:border-purple-500/50 transition-all relative overflow-hidden group">
      
      {/* FAVORITE BUTTON */}
      <button onClick={() => onToggleFav(team._id)} className="absolute top-4 right-4 z-10 p-2 bg-gray-950/50 rounded-full hover:bg-gray-800 transition">
        <Star className={`w-4 h-4 ${isFavorite ? 'text-yellow-400 fill-yellow-400' : 'text-gray-500'}`} />
      </button>

      {/* HEADER */}
      <div className="flex justify-between items-start mb-3 pr-10">
        <h3 className="text-xl font-bold line-clamp-1">{team.name}</h3>
      </div>
      
      <div className="flex gap-2 mb-3">
        <span className={`text-[10px] px-2 py-0.5 rounded border uppercase font-bold tracking-wider ${statusColor}`}>
            {team.status || "Planning"}
        </span>
        {isOpen ? (
            <span className="inline-flex items-center gap-1 text-[10px] bg-green-500/10 text-green-400 px-2 py-1 rounded-full border border-green-500/20 font-bold uppercase tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> Recruiting
            </span>
        ) : (
            <span className="inline-flex items-center gap-1 text-[10px] bg-red-500/10 text-red-400 px-2 py-1 rounded-full border border-red-500/20 font-bold uppercase tracking-wide">
                Closed
            </span>
        )}
      </div>

      <p className="text-gray-400 text-sm line-clamp-2 mb-4 flex-grow">{team.description}</p>

      {/* OPEN ROLES */}
      <div className="mb-4">
        <p className="text-[10px] text-gray-500 uppercase font-bold mb-2 flex items-center gap-1">
            <Briefcase className="w-3 h-3" /> Open Roles
        </p>
        <div className="flex flex-wrap gap-2">
            {activeRoles.length > 0 ? activeRoles.slice(0, 3).map((skill: string, k: number) => (
                <span key={k} className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-300 border border-gray-700">{skill}</span>
            )) : <span className="text-xs text-gray-600 italic">No specific roles listed</span>}
            {activeRoles.length > 3 && <span className="text-xs text-gray-500 px-1">+{activeRoles.length - 3}</span>}
        </div>
      </div>

      {/* FOOTER */}
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-4 border-t border-gray-800 pt-3">
         <Users className="w-3.5 h-3.5" />
         <span>{team.members?.length || 1} Members</span>
      </div>

      {isLeader ? (
        <div className="flex gap-2 mt-auto">
          <Link href={`/teams/${team._id}`} className="flex-1">
            <button className="w-full py-2.5 bg-gray-800 rounded-xl text-sm border border-gray-700 hover:bg-gray-700 font-medium transition">Manage</button>
          </Link>
          <Link href={`/matches?type=users&projectId=${team._id}`} className="flex-1">
            <button className="w-full py-2.5 bg-purple-600 rounded-xl text-sm font-bold hover:bg-purple-500 flex items-center justify-center gap-1 transition">
              <UserPlus className="w-3.5 h-3.5" /> Recruit
            </button>
          </Link>
        </div>
      ) : (
        <Link href={`/teams/${team._id}`} className="mt-auto">
          <button className="w-full py-2.5 border border-gray-700 rounded-xl hover:bg-white hover:text-black transition text-sm flex items-center justify-center gap-2 font-medium">
            View Project <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </Link>
      )}
    </motion.div>
  )
}