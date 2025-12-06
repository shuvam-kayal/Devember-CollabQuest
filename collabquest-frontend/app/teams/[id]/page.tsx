"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Cookies from "js-cookie";
import axios from "axios";
import { motion } from "framer-motion";
import { Bot, Calendar, Code2, LayoutDashboard, Layers, Loader2 } from "lucide-react";

// Types for the Roadmap JSON
interface Task {
  role: string;
  task: string;
}
interface Phase {
  week: number;
  goal: string;
  tasks: Task[];
}
interface Roadmap {
  title: string;
  phases: Phase[];
}
interface Team {
  _id?: string;
  id?: string;
  name: string;
  description: string;
  members: string[];
  project_roadmap?: Roadmap;
}

export default function TeamDetails() {
  const params = useParams();
  const router = useRouter();
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [techStack, setTechStack] = useState("");

  const teamId = params.id as string;

  // 1. Fetch Team Data
  useEffect(() => {
    const fetchTeamData = async () => {
      const token = Cookies.get("token");
      if (!token) return router.push("/");

      try {
        const res = await axios.get("http://localhost:8000/teams/");
        // Find the specific team from the list
        const found = res.data.find((t: any) => (t._id === teamId) || (t.id === teamId));
        setTeam(found);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchTeamData();
  }, [teamId, router]);

  // 2. AI Roadmap Generation
  const generateRoadmap = async () => {
    if (!techStack) return alert("Please enter your Tech Stack!");
    setIsGenerating(true);
    const token = Cookies.get("token");

    try {
      const res = await axios.post(
        `http://localhost:8000/teams/${teamId}/roadmap`,
        {
          project_idea: team?.description || "A cool web app",
          tech_stack: techStack.split(",").map(s => s.trim())
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTeam(res.data); // Update with the new roadmap
    } catch (err) {
      alert("AI Generation failed. Check backend console.");
    } finally {
      setIsGenerating(false);
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center bg-gray-950 text-white"><Loader2 className="animate-spin" /></div>;
  if (!team) return <div className="flex h-screen items-center justify-center bg-gray-950 text-white">Team not found</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-5xl mx-auto">
        
        {/* Title Header */}
        <header className="mb-12 border-b border-gray-800 pb-8">
            <h1 className="text-4xl font-extrabold bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent mb-2">
            {team.name}
            </h1>
            <p className="text-gray-400 max-w-2xl text-lg">{team.description}</p>
        </header>

        {/* --- ROADMAP LOGIC --- */}
        
        {!team.project_roadmap || !team.project_roadmap.phases ? (
          /* SHOW THIS IF NO ROADMAP EXISTS */
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 p-10 rounded-3xl text-center"
          >
            <Bot className="w-16 h-16 mx-auto text-purple-500 mb-6" />
            <h2 className="text-2xl font-bold mb-2">AI Project Architect</h2>
            <p className="text-gray-400 mb-8 max-w-md mx-auto">
              Tell our AI your tech stack (e.g. React, Python), and we will generate a 4-week execution roadmap.
            </p>
            
            <div className="max-w-md mx-auto space-y-4">
                <input 
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg p-4 focus:border-purple-500 outline-none text-center"
                    placeholder="e.g. React, Python, MongoDB"
                    value={techStack}
                    onChange={(e) => setTechStack(e.target.value)}
                />
                <button 
                    onClick={generateRoadmap}
                    disabled={isGenerating}
                    className="w-full bg-white text-black font-bold py-4 rounded-lg hover:bg-gray-200 transition flex items-center justify-center gap-2"
                >
                    {isGenerating ? <Loader2 className="animate-spin" /> : <Bot className="w-5 h-5" />}
                    {isGenerating ? "Consulting AI..." : "Generate 4-Week Plan"}
                </button>
            </div>
          </motion.div>

        ) : (
          /* SHOW THIS IF ROADMAP EXISTS */
          <div className="space-y-8">
            <h2 className="text-2xl font-bold flex items-center gap-3">
                <Calendar className="text-purple-500" /> Execution Roadmap
            </h2>

            <div className="relative border-l-2 border-gray-800 ml-4 space-y-12 pb-12">
                {team.project_roadmap.phases.map((phase, i) => (
                    <motion.div 
                        key={i}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.2 }}
                        className="relative pl-10"
                    >
                        <div className="absolute -left-[9px] top-0 w-4 h-4 bg-purple-500 rounded-full border-4 border-gray-950"></div>
                        <div className="mb-2 flex items-center gap-3">
                            <span className="text-purple-400 font-bold font-mono text-lg">Week {phase.week}</span>
                            <h3 className="text-xl font-semibold text-white">{phase.goal}</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            {phase.tasks.map((task, j) => (
                                <div key={j} className="bg-gray-900 border border-gray-800 p-4 rounded-xl flex gap-4">
                                    <div className="mt-1">
                                        {task.role.includes('Frontend') ? <LayoutDashboard className="text-blue-400" /> : <Code2 className="text-green-400" />}
                                    </div>
                                    <div>
                                        <span className="text-xs font-mono text-gray-500 uppercase">{task.role}</span>
                                        <p className="text-gray-300 text-sm">{task.task}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}