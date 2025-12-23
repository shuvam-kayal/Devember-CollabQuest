"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Cookies from "js-cookie";
import api from "@/lib/api"; // Using your custom api utility
import Link from "next/link"; 
import {
  ChevronLeft, ChevronRight, ShieldCheck, Loader2, MessageSquare, Bell, Briefcase, Users,
  Star, Clock, LayoutDashboard, Settings, Plus, Code2, Trash2, ArrowRight, Sparkles, UserPlus, X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const PRESET_SKILLS = [
  "React", "Python", "Node.js", "TypeScript", "Next.js", 
  "Tailwind", "MongoDB", "Firebase", "Flutter", "Java",
  "C++", "Rust", "Go", "Figma", "UI/UX", "AI/ML", 
  "Docker", "AWS", "Solidity", "Blockchain"
];

interface Team {
  _id: string;
  name: string;
  description: string;
  members: string[];
  needed_skills: string[];
}

/* -------------------- SIDEBAR LINK -------------------- */
const SidebarLink = ({ icon: Icon, label, active, onClick, isCollapsed }: any) => (
  <div
    onClick={onClick}
    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
      active ? "bg-purple-600/10 text-purple-400" : "text-gray-400 hover:bg-white/5 hover:text-white"
    }`}
  >
    <Icon size={20} />
    {!isCollapsed && <span className="text-sm font-medium">{label}</span>}
  </div>
);

export default function FindTeam() {
  const router = useRouter();
  const pathname = usePathname();
  
  // UI States
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showModal, setShowModal] = useState(false);
  
  // Data States
  const [teams, setTeams] = useState<Team[]>([]);
  const [userId, setUserId] = useState("");
  const [user, setUser] = useState<any>(null); 
  
  // Form States
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [neededSkills, setNeededSkills] = useState<string[]>([]);
  const [dropdownValue, setDropdownValue] = useState("");

  /* -------------------- INITIALIZATION -------------------- */
  useEffect(() => {
    const token = Cookies.get("token");
    if (!token) return router.push("/");
    
    // Fetch User Data
    api.get("/users/me")
      .then(res => {
        setUserId(res.data._id || res.data.id);
        setUser(res.data);
      })
      .catch(() => {
        Cookies.remove("token");
        router.push("/");
      });

    fetchTeams();
  }, [router]);

  const fetchTeams = async () => {
    try {
        const res = await api.get("/teams/");
        setTeams(res.data);
    } catch (error) { console.error("Error fetching teams:", error); }
  };

  /* -------------------- HANDLERS -------------------- */
  const handleCreate = async () => {
    try {
      await api.post("/teams/", {
        name: name,
        description: desc,
        needed_skills: neededSkills
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

  const removeSkill = (skillToRemove: string) => {
    setNeededSkills(neededSkills.filter(s => s !== skillToRemove));
  };

  // Filter Projects
  const myProjects = teams.filter(t => t.members.includes(userId));
  const otherProjects = teams.filter(t => !t.members.includes(userId));

  if (!user) return <div className="flex h-screen items-center justify-center bg-black"><Loader2 className="animate-spin text-purple-500" /></div>;

  return (
    <div className="flex min-h-screen bg-[#0A0A0A] text-white">
      {/* -------------------- SIDEBAR -------------------- */}
      <aside className={`${isCollapsed ? "w-20" : "w-64"} transition-all duration-300 fixed h-screen border-r border-white/5 bg-[#0F0F0F] flex flex-col z-50`}>
        <div className="p-6 flex items-center justify-between">
          {!isCollapsed && <h1 className="text-xl font-black tracking-tighter bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">COLLABQUEST</h1>}
          <button onClick={() => setIsCollapsed(!isCollapsed)} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 transition-colors">
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-2 overflow-hidden">
          <SidebarLink icon={LayoutDashboard} label="Dashboard" isCollapsed={isCollapsed} active={pathname === "/dashboard"} onClick={() => router.push("/dashboard")} />
          <SidebarLink icon={Users} label="Projects" isCollapsed={isCollapsed} active={pathname === "/find-team"} onClick={() => router.push("/find-team")} />
          <SidebarLink icon={Briefcase} label="Mission" isCollapsed={isCollapsed} active={pathname.includes("projects")} onClick={() => router.push("/dashboard/projects")} />
          
          {!isCollapsed && <p className="text-[10px] text-gray-500 uppercase px-2 pt-4 mb-2 font-bold tracking-widest">Personal</p>}
          <SidebarLink icon={Star} label="Saved" isCollapsed={isCollapsed} active={pathname.includes("saved")} onClick={() => router.push("/dashboard/saved")} />
          <SidebarLink icon={Clock} label="History" isCollapsed={isCollapsed} active={pathname.includes("history")} onClick={() => router.push("/dashboard/history")} />
        </nav>

        <div onClick={() => router.push("/profile")} className="p-4 border-t border-white/5 bg-black/20 cursor-pointer hover:bg-white/5 transition-all">
          <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
            <img src={user.avatar_url} className="w-8 h-8 rounded-lg border border-purple-500/50 object-cover" />
            {!isCollapsed && (
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-bold truncate">{user.username}</p>
                <p className="text-[10px] text-green-400 font-mono">TRUST {user.trust_score?.toFixed(1)}</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* -------------------- MAIN CONTENT -------------------- */}
      <main className={`flex-1 transition-all duration-300 ${isCollapsed ? "ml-20" : "ml-64"}`}>
        {/* Header Navigation */}
        <header className="sticky top-0 z-40 bg-black/80 backdrop-blur border-b border-white/5 px-8 py-4 flex justify-between items-center">
        <div className="text-sm text-gray-400 flex items-center gap-2">
            <span>Workspace</span> <span className="text-gray-600">/</span> <span className="text-white capitalize">Dashboard</span>
        </div>

        <div className="flex items-center gap-4">
            <button onClick={() => router.push("/chat")} className="p-2 hover:bg-white/5 rounded-xl transition-all">
                <MessageSquare className="w-5 h-5 text-gray-400" />
            </button>
            <button className="p-2 hover:bg-white/5 rounded-xl transition-all">
                <Bell className="w-5 h-5 text-gray-400" />
            </button>
            <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">
                <ShieldCheck className="w-4 h-4 text-green-500" />
                <span className="text-xs font-mono font-bold text-green-400">{user.trust_score.toFixed(1)}</span>
            </div>
            {/* Added Profile Picture to Header */}
            <Link href="/profile">
                <img src={user.avatar_url} className="w-8 h-8 rounded-full border border-purple-500/50 hover:scale-110 transition-transform cursor-pointer" alt="Profile" />
            </Link>
        </div>
    </header>

        <div className="p-8 max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
            <div>
              <h1 className="text-3xl font-black tracking-tight">Quests</h1>
              <p className="text-gray-500 font-medium">Coordinate with existing squads or launch a new initiative.</p>
            </div>
            <div className="flex gap-3">
              <Link href="/matches?type=projects">
                  <button className="flex items-center gap-2 bg-white/5 border border-white/10 px-5 py-2.5 rounded-2xl font-bold hover:bg-white/10 transition-all text-xs uppercase tracking-widest">
                      <Sparkles className="w-4 h-4 text-yellow-400" /> Smart Match
                  </button>
              </Link>
              <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2.5 rounded-2xl font-bold hover:scale-[1.02] active:scale-[0.98] transition-all text-xs uppercase tracking-widest shadow-lg shadow-purple-500/20">
                  <Plus className="w-4 h-4" /> Post Idea
              </button>
            </div>
          </div>

          {/* --- SECTION 1: MY PROJECTS --- */}
          {myProjects.length > 0 && (
              <div className="mb-12">
                  <h2 className="text-xs font-black text-purple-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                    <div className="h-[1px] w-8 bg-purple-500/50"></div> My Command
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {myProjects.map(team => (
                          <ProjectCard 
                              key={team._id} 
                              team={team} 
                              isLeader={team.members[0] === userId} 
                          />
                      ))}
                  </div>
              </div>
          )}

          {/* --- SECTION 2: DISCOVER --- */}
          <div>
              <h2 className="text-xs font-black text-blue-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                <div className="h-[1px] w-8 bg-blue-500/50"></div> Open Missions
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {otherProjects.map(team => (
                      <ProjectCard key={team._id} team={team} isLeader={false} />
                  ))}
              </div>
          </div>
        </div>
      </main>

      {/* -------------------- CREATE MODAL -------------------- */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-[#111] border border-white/10 p-8 rounded-3xl w-full max-w-md shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold italic tracking-tight text-purple-400">Launch a Project 🚀</h2>
                    <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white transition-colors"><X /></button>
                </div>
                
                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Codename</label>
                        <input className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm outline-none focus:border-purple-500 transition-all" placeholder="e.g. Project X" value={name} onChange={e => setName(e.target.value)} />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Mission Brief</label>
                        <textarea className="w-full bg-black border border-white/10 rounded-xl p-3 h-28 text-sm outline-none focus:border-purple-500 transition-all resize-none" placeholder="What are you building?" value={desc} onChange={e => setDesc(e.target.value)} />
                    </div>
                    
                    <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 block mb-2">Required Arsenal</label>
                        <div className="flex flex-wrap gap-2 mb-3">
                            {neededSkills.map(s => (
                                <span key={s} className="bg-purple-500/10 border border-purple-500/20 text-purple-300 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-2">
                                    {s}<button onClick={() => removeSkill(s)} className="hover:text-white transition-colors"><X className="w-3 h-3" /></button>
                                </span>
                            ))}
                        </div>
                        <div className="relative">
                            <select className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm outline-none focus:border-purple-500 appearance-none cursor-pointer" value={dropdownValue} onChange={(e) => addSkill(e.target.value)}>
                                <option value="" disabled>+ Deploy Tech Stack</option>
                                {PRESET_SKILLS.filter(s => !neededSkills.includes(s)).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <Plus className="w-3 h-3 absolute right-4 top-4 pointer-events-none text-gray-500"/>
                        </div>
                    </div>
                    
                    <button onClick={handleCreate} className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-black text-xs uppercase tracking-widest py-4 rounded-2xl hover:scale-[1.02] transition-all mt-4">Publish Mission</button>
                </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* -------------------- PROJECT CARD COMPONENT -------------------- */
function ProjectCard({ team, isLeader }: any) {
    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-[#161616] border border-white/5 p-6 rounded-2xl flex flex-col group hover:border-purple-500/30 transition-all shadow-xl">
            <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${isLeader ? 'bg-purple-600/10 text-purple-400' : 'bg-blue-600/10 text-blue-400'}`}>
                    {team.name[0].toUpperCase()}
                </div>
                <h3 className="text-base font-bold truncate">{team.name}</h3>
            </div>
            
            <p className="text-gray-500 text-xs line-clamp-3 mb-6 font-medium leading-relaxed">{team.description}</p>
            
            <div className="flex flex-wrap gap-1.5 mb-6 mt-auto">
                {team.needed_skills?.slice(0, 3).map((skill: string, k: number) => (
                    <span key={k} className="text-[9px] font-bold uppercase tracking-wider bg-white/5 px-2 py-1 rounded-md text-gray-400 border border-white/5">{skill}</span>
                ))}
            </div>

            {isLeader ? (
                <div className="grid grid-cols-2 gap-2">
                    <Link href={`/teams/${team._id}`}>
                        <button className="w-full py-2.5 bg-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/5 hover:bg-white/10 transition-all">Manage</button>
                    </Link>
                    <Link href={`/matches?type=users&projectId=${team._id}`}>
                        <button className="w-full py-2.5 bg-purple-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-purple-500 transition-all flex items-center justify-center gap-2">
                            <UserPlus className="w-3 h-3"/> Recruit
                        </button>
                    </Link>
                </div>
            ) : (
                <Link href={`/teams/${team._id}`}>
                    <button className="w-full py-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white hover:text-black transition-all text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                        View Brief <ArrowRight className="w-3 h-3"/>
                    </button>
                </Link>
            )}
        </motion.div>
    )
}