"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import api from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Users, Code2, ArrowRight, Sparkles, UserPlus, X } from "lucide-react";
import Link from "next/link";
import GlobalHeader from "@/components/GlobalHeader"; // <--- ADDED

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

export default function FindTeam() {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [userId, setUserId] = useState("");
  const [showModal, setShowModal] = useState(false);

  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [neededSkills, setNeededSkills] = useState<string[]>([]);
  const [dropdownValue, setDropdownValue] = useState("");

  useEffect(() => {
    const token = Cookies.get("token");
    if (!token) return router.push("/");

    api.get("/users/me")
      .then(res => setUserId(res.data._id || res.data.id));

    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      const res = await api.get("/teams/");
      setTeams(res.data);
    } catch (error) { console.error(error); }
  };

  const handleCreate = async () => {
    const token = Cookies.get("token");
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

  const myProjects = teams.filter(t => t.members.includes(userId));
  const otherProjects = teams.filter(t => !t.members.includes(userId));

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <GlobalHeader /> {/* <--- ADDED */}

      <div className="max-w-6xl mx-auto p-8">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">Marketplace</h1>
            <p className="text-gray-400 mt-1">Manage your teams or find a new one.</p>
          </div>
          <div className="flex gap-4">
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
        {myProjects.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xl font-bold mb-4 text-purple-300 border-b border-purple-500/30 pb-2 inline-block">My Projects</h2>
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

        {/* --- SECTION 2: JOIN PROJECTS --- */}
        <div>
          <h2 className="text-xl font-bold mb-4 text-blue-300 border-b border-blue-500/30 pb-2 inline-block">Join a Team</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {otherProjects.map(team => (
              <ProjectCard key={team._id} team={team} isLeader={false} />
            ))}
          </div>
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
                        {s}<button onClick={() => removeSkill(s)} className="hover:text-white"><X className="w-3 h-3" /></button>
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

function ProjectCard({ team, isLeader }: any) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-gray-900 border border-gray-800 p-6 rounded-2xl flex flex-col hover:border-purple-500/50 transition-all">
      <h3 className="text-xl font-bold mb-2">{team.name}</h3>
      <p className="text-gray-400 text-sm line-clamp-2 mb-4 flex-grow">{team.description}</p>

      <div className="flex flex-wrap gap-2 mb-4">
        {team.needed_skills?.slice(0, 3).map((skill: string, k: number) => (
          <span key={k} className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-300 border border-gray-700">{skill}</span>
        ))}
      </div>

      {isLeader ? (
        <div className="flex gap-2">
          <Link href={`/teams/${team._id}`} className="flex-1">
            <button className="w-full py-2 bg-gray-800 rounded-lg text-sm border border-gray-700 hover:bg-gray-700">Manage</button>
          </Link>
          <Link href={`/matches?type=users&projectId=${team._id}`} className="flex-1">
            <button className="w-full py-2 bg-purple-600 rounded-lg text-sm font-bold hover:bg-purple-500 flex items-center justify-center gap-1">
              <UserPlus className="w-3 h-3" /> Recruit
            </button>
          </Link>
        </div>
      ) : (
        <Link href={`/teams/${team._id}`}>
          <button className="w-full py-2 border border-gray-700 rounded-lg hover:bg-white hover:text-black transition text-sm flex items-center justify-center gap-2">
            View Details <ArrowRight className="w-3 h-3" />
          </button>
        </Link>
      )}
    </motion.div>
  )
}