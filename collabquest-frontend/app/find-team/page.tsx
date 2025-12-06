"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Users, Code2, ArrowRight } from "lucide-react";
import Link from "next/link"; // <--- Ensure this is imported

interface Team {
  _id: string;
  name: string;
  description: string;
  members: string[];
}

export default function FindTeam() {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newTeam, setNewTeam] = useState({ name: "", description: "", needed_skills: [] });

  // 1. Fetch Teams on Load
  useEffect(() => {
    const token = Cookies.get("token");
    if (!token) return router.push("/");
    
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
        const res = await axios.get("http://localhost:8000/teams/");
        setTeams(res.data);
    } catch (error) {
        console.error("Failed to fetch teams");
    }
  };

  // 2. Handle Create Project
  const handleCreate = async () => {
    const token = Cookies.get("token");
    try {
      await axios.post("http://localhost:8000/teams/", newTeam, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowModal(false);
      fetchTeams(); // Refresh list
    } catch (err) {
      alert("Failed to create team");
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
              Project Marketplace
            </h1>
            <p className="text-gray-400 mt-1">Find a team or lead your own.</p>
          </div>
          <button 
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded-full font-bold transition-all"
          >
            <Plus className="w-5 h-5" /> Post Idea
          </button>
        </div>

        {/* Project Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map((team, i) => (
            <motion.div
              key={team._id || i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-gray-900 border border-gray-800 p-6 rounded-2xl hover:border-purple-500/50 transition-colors group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-gray-800 rounded-lg group-hover:bg-purple-500/20 transition-colors">
                    <Code2 className="w-6 h-6 text-purple-400" />
                </div>
                <span className="text-xs font-mono text-gray-500 flex items-center gap-1">
                    <Users className="w-3 h-3" /> {team.members.length} Members
                </span>
              </div>
              
              <h3 className="text-xl font-bold mb-2">{team.name}</h3>
              <p className="text-gray-400 text-sm line-clamp-3 mb-6">
                {team.description}
              </p>

              {/* --- UPDATED BUTTON SECTION --- */}
              <Link href={`/teams/${team._id}`}>
                  <button className="w-full py-2 border border-gray-700 rounded-lg hover:bg-white hover:text-black transition-all flex items-center justify-center gap-2 font-medium">
                    View Details <ArrowRight className="w-4 h-4" />
                  </button>
              </Link>
              {/* ------------------------------- */}

            </motion.div>
          ))}
        </div>
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-gray-900 border border-gray-800 p-8 rounded-2xl w-full max-w-md relative"
            >
                <h2 className="text-2xl font-bold mb-6">Launch a Project 🚀</h2>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Project Name</label>
                        <input 
                            className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 focus:border-purple-500 outline-none transition-colors"
                            placeholder="e.g. AI Study Buddy"
                            value={newTeam.name}
                            onChange={e => setNewTeam({...newTeam, name: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Description</label>
                        <textarea 
                            className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 h-32 focus:border-purple-500 outline-none transition-colors resize-none"
                            placeholder="What are you building? Who do you need?"
                            value={newTeam.description}
                            onChange={e => setNewTeam({...newTeam, description: e.target.value})}
                        />
                    </div>
                    
                    <button 
                        onClick={handleCreate}
                        className="w-full bg-white text-black font-bold py-3 rounded-lg hover:bg-gray-200 mt-2"
                    >
                        Publish Project
                    </button>
                    <button 
                        onClick={() => setShowModal(false)}
                        className="w-full text-gray-500 py-3 text-sm hover:text-white"
                    >
                        Cancel
                    </button>
                </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}