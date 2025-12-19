"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Cookies from "js-cookie";
import api from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import GlobalHeader from "@/components/GlobalHeader";
import { ArrowLeft, Save, Sparkles, Loader2, X, Check, Plus, Trash2, Code2, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";

const PRESET_SKILLS = ["React", "Python", "Node.js", "TypeScript", "Next.js", "Tailwind", "MongoDB", "Firebase", "Flutter", "Java", "C++", "Rust", "Go", "Figma", "UI/UX", "AI/ML", "Docker", "AWS", "Solidity"];

interface Suggestions { add: string[]; remove: string[]; }

export default function EditTeamPage() {
    const params = useParams();
    const router = useRouter();
    const teamId = params.id as string;
    const [loading, setLoading] = useState(true);
    const [team, setTeam] = useState<any>(null); // Store full team object

    // Form State
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [targetMembers, setTargetMembers] = useState(4);
    const [targetDate, setTargetDate] = useState("");
    const [activeSkills, setActiveSkills] = useState<string[]>([]);
    const [activeSkillInput, setActiveSkillInput] = useState("");
    const [techStack, setTechStack] = useState<string[]>([]);
    const [stackDropdown, setStackDropdown] = useState("");
    const [isRecruiting, setIsRecruiting] = useState(true);

    // AI State
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [suggestions, setSuggestions] = useState<Suggestions | null>(null);

    // Action States
    const [deletionProcessing, setDeletionProcessing] = useState(false);
    const [completionProcessing, setCompletionProcessing] = useState(false);

    useEffect(() => {
        const token = Cookies.get("token");
        if (!token) return router.push("/");

        api.get(`/teams/${teamId}`)
            .then(res => {
                const t = res.data;
                setTeam(t);
                setName(t.name);
                setDescription(t.description);
                setTargetMembers(t.target_members);
                if (t.target_completion_date) setTargetDate(new Date(t.target_completion_date).toISOString().split('T')[0]);
                setActiveSkills(t.active_needed_skills || []);
                setTechStack(t.needed_skills || []);
                setIsRecruiting(t.is_looking_for_members);
            })
            .catch(() => alert("Failed to load team"))
            .finally(() => setLoading(false));
    }, [teamId]);

    const handleSave = async () => {
        const token = Cookies.get("token");
        try {
            await api.put(`/teams/${teamId}`, {
                name,
                description,
                target_members: targetMembers,
                target_completion_date: targetDate ? new Date(targetDate).toISOString() : null,
                active_needed_skills: activeSkills,
                is_looking_for_members: isRecruiting
            });

            await api.put(`/teams/${teamId}/skills`, { needed_skills: techStack });

            alert("Team Updated!");
            router.push(`/teams/${teamId}`);
        } catch (e) { alert("Failed to update"); }
    };

    // --- BUTTON ACTIONS ---
    const toggleRecruiting = () => setIsRecruiting(!isRecruiting);

    const handleInitiateDelete = async () => {
        if (!confirm("Start a vote to DELETE this project?")) return;
        const token = Cookies.get("token");
        try {
            setDeletionProcessing(true);
            await api.post(`/teams/${teamId}/delete/initiate`, {});
            alert("Deletion Vote Initiated!");
            router.push(`/teams/${teamId}`);
        } catch (e) { alert("Failed"); } finally { setDeletionProcessing(false); }
    };

    const handleInitiateComplete = async () => {
        if (!confirm("Start a vote to mark project as COMPLETED?")) return;
        const token = Cookies.get("token");
        try {
            setCompletionProcessing(true);
            await api.post(`/teams/${teamId}/complete/initiate`, {});
            alert("Completion Vote Initiated!");
            router.push(`/teams/${teamId}`);
        } catch (e) { alert("Failed"); } finally { setCompletionProcessing(false); }
    };

    // --- HELPER FUNCTIONS ---
    const addActiveSkill = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && activeSkillInput.trim()) { if (!activeSkills.includes(activeSkillInput.trim())) setActiveSkills([...activeSkills, activeSkillInput.trim()]); setActiveSkillInput(""); } };
    const removeActiveSkill = (s: string) => setActiveSkills(activeSkills.filter(x => x !== s));

    const addStackSkill = (s: string) => { if (!techStack.includes(s)) setTechStack([...techStack, s]); setStackDropdown(""); };
    const removeStackSkill = (s: string) => setTechStack(techStack.filter(x => x !== s));

    // --- AI LOGIC ---
    const askAi = async () => {
        setIsSuggesting(true); setSuggestions(null);
        const token = Cookies.get("token");
        try {
            const res = await api.post("/teams/suggest-stack", { description, current_skills: techStack });
            if (res.data && (res.data.add.length > 0 || res.data.remove.length > 0)) setSuggestions(res.data); else alert("No AI suggestions found.");
        } catch (e) { alert("AI Failed"); } finally { setIsSuggesting(false); }
    };
    const acceptSuggestion = (type: 'add' | 'remove', s: string) => { if (type === 'add') addStackSkill(s); else removeStackSkill(s); setSuggestions(prev => prev ? ({ ...prev, [type]: prev[type].filter(x => x !== s) }) : null); };

    if (loading) return <div className="h-screen bg-black text-white flex items-center justify-center">Loading...</div>;

    const isFull = team && team.members.length >= targetMembers;

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            <GlobalHeader />
            <div className="max-w-3xl mx-auto p-8">
                <div className="flex items-center gap-4 mb-8">
                    <Link href={`/teams/${teamId}`} className="p-2 bg-gray-800 rounded-full hover:bg-gray-700"><ArrowLeft /></Link>
                    <h1 className="text-3xl font-bold">Edit Team Settings</h1>
                </div>

                <div className="space-y-8">
                    {/* General Info */}
                    <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl space-y-4">
                        <h3 className="text-xl font-bold text-gray-300 border-b border-gray-800 pb-2">General Info</h3>
                        <div><label className="block text-sm text-gray-500 mb-1">Team Name</label><input className="w-full bg-gray-950 border border-gray-700 rounded p-3" value={name} onChange={e => setName(e.target.value)} /></div>
                        <div><label className="block text-sm text-gray-500 mb-1">Description</label><textarea className="w-full bg-gray-950 border border-gray-700 rounded p-3 h-32" value={description} onChange={e => setDescription(e.target.value)} /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-sm text-gray-500 mb-1">Target Members</label><input type="number" className="w-full bg-gray-950 border border-gray-700 rounded p-3" value={targetMembers} onChange={e => setTargetMembers(parseInt(e.target.value))} /></div>
                            <div><label className="block text-sm text-gray-500 mb-1">Target Date</label><input type="date" className="w-full bg-gray-950 border border-gray-700 rounded p-3" style={{ colorScheme: "dark" }} value={targetDate} onChange={e => setTargetDate(e.target.value)} /></div>
                        </div>
                    </div>

                    {/* Tech Stack */}
                    <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl space-y-4">
                        <div className="flex justify-between items-center border-b border-gray-800 pb-2"><h3 className="text-xl font-bold text-gray-300">Tech Stack</h3><button onClick={askAi} disabled={isSuggesting} className="text-xs bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded flex items-center gap-2">{isSuggesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Ask AI</button></div>
                        <AnimatePresence>{suggestions && (<motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="bg-black/30 p-4 rounded-xl border border-purple-500/30"><p className="text-xs text-purple-400 font-bold uppercase mb-2">AI Suggestions</p><div className="flex flex-wrap gap-2">{suggestions.add.map(s => <div key={s} className="flex items-center gap-1 bg-blue-900/20 text-blue-300 px-2 py-1 rounded text-xs border border-blue-500/30">{s} <button onClick={() => acceptSuggestion('add', s)}><Check className="w-3 h-3" /></button></div>)}{suggestions.remove.map(s => <div key={s} className="flex items-center gap-1 bg-red-900/20 text-red-300 px-2 py-1 rounded text-xs border border-red-500/30">{s} <button onClick={() => acceptSuggestion('remove', s)}><Trash2 className="w-3 h-3" /></button></div>)}</div></motion.div>)}</AnimatePresence>
                        <div className="flex flex-wrap gap-2 p-2 bg-gray-950 rounded-xl min-h-[50px]">{techStack.map(s => (<span key={s} className="bg-gray-800 border border-gray-700 px-3 py-1 rounded-full text-sm flex items-center gap-2">{s} <button onClick={() => removeStackSkill(s)}><X className="w-3 h-3 hover:text-red-400" /></button></span>))}</div><select className="w-full bg-gray-950 border border-gray-700 rounded p-2 text-sm" value={stackDropdown} onChange={e => addStackSkill(e.target.value)}><option value="" disabled>+ Add Tech</option>{PRESET_SKILLS.filter(s => !techStack.includes(s)).map(s => <option key={s} value={s}>{s}</option>)}</select>
                    </div>

                    {/* Active Roles */}
                    <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl space-y-4">
                        <h3 className="text-xl font-bold text-gray-300 border-b border-gray-800 pb-2">Active Open Roles</h3>
                        <p className="text-sm text-gray-500">Specific roles you are actively recruiting for right now (e.g. "Backend Lead", "UI Designer"). Used for matching.</p>
                        <div className="flex flex-wrap gap-2">{activeSkills.map(s => (<span key={s} className="bg-blue-900/20 text-blue-300 border border-blue-500/30 px-3 py-1 rounded-full text-sm flex items-center gap-2">{s} <button onClick={() => removeActiveSkill(s)}><X className="w-3 h-3 hover:text-white" /></button></span>))}</div>
                        <div className="flex gap-2"><input className="flex-1 bg-gray-950 border border-gray-700 rounded p-2 text-sm" placeholder="Add Role (Press Enter)..." value={activeSkillInput} onChange={e => setActiveSkillInput(e.target.value)} onKeyDown={addActiveSkill} /><button onClick={() => { if (activeSkillInput) addActiveSkill({ key: 'Enter' } as any); }} className="bg-gray-800 px-4 rounded hover:bg-gray-700"><Plus className="w-5 h-5" /></button></div>
                    </div>

                    {/* MANAGEMENT ACTIONS */}
                    <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl space-y-4">
                        <h3 className="text-xl font-bold text-gray-300 border-b border-gray-800 pb-2">Management</h3>

                        {/* Recruitment Toggle */}
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="font-bold">Recruitment Status</h4>
                                <p className="text-xs text-gray-500">{isFull ? "Target member count reached." : "Toggle visibility in search."}</p>
                            </div>
                            <button
                                onClick={!isFull ? toggleRecruiting : undefined}
                                disabled={isFull}
                                className={`px-4 py-2 rounded-full font-bold flex items-center gap-2 text-sm transition-all border ${isFull ? 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed' :
                                        isRecruiting ? 'bg-green-900/20 border-green-500/50 text-green-400 hover:bg-green-900/30' :
                                            'bg-red-900/20 border-red-500/50 text-red-400 hover:bg-red-900/30'
                                    }`}
                            >
                                {isFull ? <XCircle className="w-4 h-4" /> : (isRecruiting ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />)}
                                {isFull ? "Team Full" : (isRecruiting ? "Recruiting: ON" : "Recruiting: OFF")}
                            </button>
                        </div>

                        {/* Complete Project (Only if Active) */}
                        {team && team.status === 'active' && (
                            <div className="flex items-center justify-between border-t border-gray-800 pt-4">
                                <div><h4 className="font-bold text-green-400">Complete Project</h4><p className="text-xs text-gray-500">Finish development and rate teammates.</p></div>
                                <button onClick={handleInitiateComplete} disabled={completionProcessing} className="px-4 py-2 bg-green-900/20 hover:bg-green-900/40 text-green-400 border border-green-500/50 rounded-lg text-sm font-bold flex gap-2"><Check className="w-4 h-4" /> Complete</button>
                            </div>
                        )}

                        {/* Delete Project */}
                        <div className="flex items-center justify-between border-t border-gray-800 pt-4">
                            <div><h4 className="font-bold text-red-400">Danger Zone</h4><p className="text-xs text-gray-500">Permanently delete this project.</p></div>
                            <button onClick={handleInitiateDelete} disabled={deletionProcessing} className="px-4 py-2 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-500/50 rounded-lg text-sm font-bold flex gap-2"><Trash2 className="w-4 h-4" /> Delete Project</button>
                        </div>
                    </div>

                    <div className="flex gap-4 pt-4 pb-12">
                        <button onClick={handleSave} className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg"><Save className="w-5 h-5" /> Save Changes</button>
                        <Link href={`/teams/${teamId}`} className="flex-1"><button className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-3 rounded-xl">Cancel</button></Link>
                    </div>
                </div>
            </div>
        </div>
    );
}