"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Cookies from "js-cookie";
import api from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import GlobalHeader from "@/components/GlobalHeader";
import {
    Bot, Calendar, Code2, Layers, LayoutDashboard, Loader2, UserPlus, ClipboardList, CheckCircle2, RotateCcw,
    Sparkles, X, Plus, RefreshCw, Trash2, Check, AlertTriangle, MessageSquare, Mail, ThumbsUp, Clock, Send, Edit2, Users, Trophy, Megaphone, Play, LogOut, UserMinus, Timer, CalendarClock, ChevronRight
} from "lucide-react";

const PRESET_SKILLS = ["React", "Python", "Node.js", "TypeScript", "Next.js", "Tailwind", "MongoDB", "Firebase", "Flutter", "Java", "C++", "Rust", "Go", "Figma", "UI/UX", "AI/ML", "Docker", "AWS", "Solidity"];

interface Member { id: string; username: string; avatar_url: string; email: string; role?: string; _id?: string }
interface DeletionRequest { is_active: boolean; votes: { [key: string]: string }; }
interface CompletionRequest { is_active: boolean; votes: { [key: string]: string }; }
interface MemberRequest { id: string; target_user_id: string; type: "leave" | "remove"; explanation: string; is_active: boolean; votes: { [key: string]: string }; }

interface Team {
    id: string; name: string; description: string; leader_id: string;
    members: Member[]; needed_skills: string[]; active_needed_skills: string[];
    is_looking_for_members: boolean;
    project_roadmap?: any; chat_group_id?: string;
    target_members: number; target_completion_date?: string;
    deletion_request?: DeletionRequest;
    completion_request?: CompletionRequest;
    member_requests: MemberRequest[];
    status: string;
    has_liked?: boolean;
}

interface TaskItem {
    id: string; description: string; assignee_id: string; assignee_name: string; assignee_avatar: string; deadline: string;
    status: "pending" | "review" | "completed" | "rework";
    verification_votes: number; required_votes: number; rework_votes: number; required_rework: number; is_overdue: boolean;
    extension_active: boolean; extension_votes: number; extension_required: number; was_extended: boolean;
    extension_requested_date?: string;
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

    const [isRecruiting, setIsRecruiting] = useState(true);
    const [deletionProcessing, setDeletionProcessing] = useState(false);
    const [completionProcessing, setCompletionProcessing] = useState(false);
    const [ratingProcessing, setRatingProcessing] = useState<string | null>(null);
    const [ratedMembers, setRatedMembers] = useState<string[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);

    const [showEmailModal, setShowEmailModal] = useState(false);
    const [emailRecipient, setEmailRecipient] = useState<{ id: string, name: string } | null>(null);
    const [emailSubject, setEmailSubject] = useState("");
    const [emailBody, setEmailBody] = useState("");

    const [showExplainModal, setShowExplainModal] = useState(false);
    const [actionType, setActionType] = useState<"leave" | "remove" | null>(null);
    const [actionTargetId, setActionTargetId] = useState<string | null>(null);
    const [explanation, setExplanation] = useState("");

    const [ratingExplanation, setRatingExplanation] = useState("");

    const [showExtensionModal, setShowExtensionModal] = useState(false);
    const [extensionTaskId, setExtensionTaskId] = useState<string | null>(null);
    const [extensionDate, setExtensionDate] = useState("");

    const [isSuggesting, setIsSuggesting] = useState(false);
    const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
    const [isEditingSkills, setIsEditingSkills] = useState(false);
    const [localSkills, setLocalSkills] = useState<string[]>([]);
    const [dropdownValue, setDropdownValue] = useState("");

    const teamId = params.id as string;

    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

    const [tasks, setTasks] = useState<TaskItem[]>([]);
    const [newTaskDesc, setNewTaskDesc] = useState("");
    const [newTaskAssignee, setNewTaskAssignee] = useState("");
    const [newTaskDeadline, setNewTaskDeadline] = useState("");
    const [isTaskLoading, setIsTaskLoading] = useState(false);

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
        api.get("/users/me").then(res => setCurrentUserId(res.data._id || res.data.id));
        fetchTeamData();

        const handleRefresh = () => { fetchTeamData(); };
        window.addEventListener("dashboardUpdate", handleRefresh);
        return () => window.removeEventListener("dashboardUpdate", handleRefresh);
    }, [teamId]);

    const fetchTeamData = async () => {
        try {
            const res = await api.get(`/teams/${teamId}`);
            setTeam(res.data);
            setLocalSkills(res.data.needed_skills || []);
            setIsRecruiting(res.data.is_looking_for_members);
            if (res.data.leader_id) fetchCandidates(res.data.id);
            fetchTasks();
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const fetchTasks = async () => {
        try {
            const res = await api.get(`/teams/${teamId}/tasks`);
            setTasks(res.data);
        } catch (e) { }
    }

    const isLeader = team && currentUserId === team.leader_id;
    const isMember = team && team.members.some(m => (m.id || m._id) === currentUserId);

    const fetchCandidates = async (tid: string) => {
        try {
            const res = await api.get(`/matches/team/${tid}`);
            const mapped = res.data.map((c: any) => ({
                id: c.id || c.user_id || c._id,
                name: c.name || c.username || "Candidate",
                avatar: c.avatar || c.avatar_url || "https://github.com/shadcn.png",
                contact: c.contact || "",
                role: c.role || "Developer",
                status: c.status,
                rejected_by: c.rejected_by
            }));
            setCandidates(mapped.filter((c: Candidate) => c.status !== "joined"));
        } catch (e) { }
    }

    const toggleRecruiting = async () => { const newState = !isRecruiting; setIsRecruiting(newState); try { await api.put(`/teams/${teamId}`, { is_looking_for_members: newState }); } catch (e) { setIsRecruiting(!newState); } }
    const handleStartProject = async () => { if (!confirm("Start the project? This enables task management.")) return; try { await api.put(`/teams/${teamId}`, { status: "active" }); fetchTeamData(); } catch (e) { } }
    const handleLeave = () => { setActionType("leave"); setExplanation(""); setShowExplainModal(true); };
    const handleRemove = (memberId: string) => { setActionType("remove"); setActionTargetId(memberId); setExplanation(""); setShowExplainModal(true); };

    const handleConfirmAction = async () => {
        if (!explanation.trim()) return alert("Explanation required.");
        try {
            if (actionType === "leave") {
                const res = await api.post(`/teams/${teamId}/leave`, { explanation });
                if (res.data.status === "left") router.push("/dashboard");
                else fetchTeamData();
            } else if (actionType === "remove" && actionTargetId) {
                await api.post(`/teams/${teamId}/members/${actionTargetId}/remove`, { explanation });
                fetchTeamData();
            }
            setShowExplainModal(false);
        } catch (e) { alert("Action failed"); }
    };

    const handleVoteRequest = async (reqId: string, decision: 'approve' | 'reject') => { try { await api.post(`/teams/${teamId}/member-request/${reqId}/vote`, { decision }); fetchTeamData(); } catch (e) { } };

    const handleAssignTask = async () => {
        if (!newTaskDesc || !newTaskAssignee || !newTaskDeadline) return alert("Fill all fields");
        setIsTaskLoading(true);
        try {
            await api.post(`/teams/${teamId}/tasks`, { description: newTaskDesc, assignee_id: newTaskAssignee, deadline: newTaskDeadline });
            setNewTaskDesc(""); setNewTaskDeadline(""); fetchTasks();
        } catch (e) { } finally { setIsTaskLoading(false); }
    };

    const handleDeleteTask = async (taskId: string) => { if (!confirm("Delete this task?")) return; try { await api.delete(`/teams/${teamId}/tasks/${taskId}`); fetchTasks(); } catch (e) { } }
    const handleVerifyTask = async (taskId: string) => { try { await api.post(`/teams/${teamId}/tasks/${taskId}/verify`, {}); fetchTasks(); } catch (e) { } };
    const handleReworkTask = async (taskId: string) => { try { await api.post(`/teams/${teamId}/tasks/${taskId}/rework`, {}); fetchTasks(); } catch (e) { } };
    const handleSubmitTask = async (taskId: string) => { try { await api.post(`/teams/${teamId}/tasks/${taskId}/submit`, {}); fetchTasks(); } catch (e) { } };

    const openExtensionModal = (taskId: string) => { setExtensionTaskId(taskId); setExtensionDate(""); setShowExtensionModal(true); };
    const confirmExtensionRequest = async () => {
        if (!extensionDate || !extensionTaskId) return alert("Select a date.");
        try {
            await api.post(`/teams/${teamId}/tasks/${extensionTaskId}/extend/initiate`, { new_deadline: extensionDate });
            setShowExtensionModal(false); fetchTasks();
        } catch (e) { }
    };

    const handleVoteExtension = async (taskId: string, decision: 'approve' | 'reject') => { try { await api.post(`/teams/${teamId}/tasks/${taskId}/extend/vote`, { decision }); fetchTasks(); } catch (e) { } }

    const handleInitiateDelete = async () => {
        if (!confirm("Start vote?")) return;
        setDeletionProcessing(true);
        try {
            const res = await api.post(`/teams/${teamId}/delete/initiate`, {});
            if (res.data.status === "deleted") router.push("/dashboard");
            else fetchTeamData();
        } catch (e) { } finally { setDeletionProcessing(false); }
    };

    const handleVoteDelete = async (decision: 'approve' | 'reject') => {
        setDeletionProcessing(true);
        try {
            const res = await api.post(`/teams/${teamId}/delete/vote`, { decision });
            if (res.data.status === "deleted") router.push("/dashboard");
            else fetchTeamData();
        } catch (e) { } finally { setDeletionProcessing(false); }
    };

    const handleInitiateComplete = async () => {
        if (!confirm("Mark project completed?")) return;
        setCompletionProcessing(true);
        try {
            await api.post(`/teams/${teamId}/complete/initiate`, {});
            fetchTeamData();
        } catch (e) { } finally { setCompletionProcessing(false); }
    }

    const handleVoteComplete = async (decision: 'approve' | 'reject') => {
        setCompletionProcessing(true);
        try {
            await api.post(`/teams/${teamId}/complete/vote`, { decision });
            fetchTeamData();
        } catch (e) { } finally { setCompletionProcessing(false); }
    };

    const handleRateMember = async (targetId: string, score: number) => {
        setRatingProcessing(targetId);
        try {
            await api.post(`/teams/${teamId}/rate`, { target_user_id: targetId, score, explanation: ratingExplanation });
            setRatedMembers([...ratedMembers, targetId]);
            setRatingExplanation(""); // Clear for next member
            alert("Rating submitted!");
        } catch (e) { } finally { setRatingProcessing(null); }
    }

    const sendInvite = async (c: Candidate) => { try { setCandidates(prev => prev.map(m => m.id === c.id ? { ...m, status: "invited" } : m)); await api.post(`/teams/${teamId}/invite`, { target_user_id: c.id }); } catch (err) { fetchCandidates(teamId); } }
    const acceptRequest = async (c: Candidate) => { try { await api.post(`/teams/${teamId}/members`, { target_user_id: c.id }); fetchTeamData(); fetchCandidates(teamId); } catch (err) { } }
    const rejectRequest = async (c: Candidate) => { if (!confirm("Reject?")) return; try { await api.post(`/teams/${teamId}/reject`, { target_user_id: c.id }); fetchCandidates(teamId); } catch (err) { } }
    const deleteCandidate = async (c: Candidate) => { if (!confirm("Remove?")) return; try { await api.delete(`/matches/delete/${teamId}/${c.id}`); fetchCandidates(teamId); } catch (err) { } }
    const createTeamChat = async () => { try { const res = await api.post(`/chat/groups/team/${teamId}`, {}); router.push(`/chat?targetId=${res.data._id || res.data.id}`); } catch (err) { } };
    const likeProject = async () => { try { await api.post("/matches/swipe", { target_id: teamId, direction: "right", type: "project", related_id: teamId }); if (team) setTeam({ ...team, has_liked: true }); window.dispatchEvent(new Event("dashboardUpdate")); } catch (err) { } }
    const openEmailComposer = (u: any) => { setEmailRecipient({ id: u.id, name: u.username || u.name }); setShowEmailModal(true); }
    const handleSendEmail = async () => { if (!emailRecipient) return; try { await api.post("/communication/send-email", { recipient_id: emailRecipient.id, subject: emailSubject, body: emailBody }); setShowEmailModal(false); } catch (err) { } }

    const addSkill = (skill: string) => { if (!localSkills.includes(skill)) setLocalSkills([...localSkills, skill]); setDropdownValue(""); };
    const removeSkill = (skill: string) => { setLocalSkills(localSkills.filter(s => s !== skill)); };
    const saveSkills = async () => { try { await api.put(`/teams/${teamId}/skills`, { needed_skills: localSkills }); fetchTeamData(); setIsEditingSkills(false); setSuggestions(null); } catch (err) { } };

    const askAiForStack = async () => {
        setIsSuggesting(true); setSuggestions(null);
        try {
            const res = await api.post("/teams/suggest-stack", { description: team?.description || "", current_skills: localSkills });
            if (res.data && (res.data.add.length > 0 || res.data.remove.length > 0)) setSuggestions(res.data);
        } catch (err) { console.error(err); } finally { setIsSuggesting(false); }
    };

    const acceptSuggestion = (type: 'add' | 'remove', skill: string) => { if (type === 'add') addSkill(skill); if (type === 'remove') removeSkill(skill); if (suggestions) setSuggestions({ ...suggestions, [type]: suggestions[type].filter(s => s !== skill) }); };
    const generateRoadmap = async () => { setIsGenerating(true); try { await api.post(`/teams/${teamId}/roadmap`, {}); fetchTeamData(); } catch (err) { } finally { setIsGenerating(false); } };

    if (loading || !team) return <div className="flex h-screen items-center justify-center bg-transparent text-white"><Loader2 className="w-10 h-10 animate-spin text-purple-600" /></div>;

    // Helper for task status visualization
    const getTaskStyles = (task: TaskItem) => {
        const timeLeft = new Date(task.deadline).getTime() - Date.now();
        if (task.status === 'completed') return { border: "border-green-500/20", bg: "bg-green-950/20", icon: <CheckCircle2 className="w-5 h-5 text-green-500" /> };
        if (task.status === 'rework') return { border: "border-red-500/50", bg: "bg-red-950/30", icon: <RotateCcw className="w-5 h-5 text-red-500" /> };
        if (task.is_overdue) return { border: "border-red-500/50", bg: "bg-red-950/20", icon: <AlertTriangle className="w-5 h-5 text-red-500" /> };
        if (task.status === 'review') return { border: "border-yellow-500/40", bg: "bg-yellow-950/20", icon: <Clock className="w-5 h-5 text-yellow-500" /> };
        if (timeLeft > 0 && timeLeft < 86400000) return { border: "border-orange-500/40", bg: "bg-orange-950/20", icon: <Timer className="w-5 h-5 text-orange-500" /> };
        return { border: "border-white/5", bg: "bg-zinc-900/30 backdrop-blur-sm", icon: <Clock className="w-5 h-5 text-zinc-500" /> };
    }

    return (
        <div className="min-h-screen w-full bg-transparent text-zinc-100 font-sans selection:bg-purple-500/30 relative overflow-hidden">
        

            {/* --- 2. CURSOR GLOW EFFECT --- */}
            <div 
                className="pointer-events-none fixed inset-0 z-30 transition-opacity duration-300"
                style={{
                    background: `radial-gradient(800px at ${mousePosition.x}px ${mousePosition.y}px, rgba(168, 85, 247, 0.1), transparent 99%)`,
                }}
            />

            {/* --- 3. STATIC BACKGROUND AMBIENCE --- */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[60%] bg-purple-900/10 blur-[100px] rounded-full mix-blend-screen" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[50%] bg-blue-900/10 blur-[120px] rounded-full mix-blend-screen" />
            </div>

            {/* --- 4. MAIN CONTENT WRAPPER --- */}
            <div className="relative z-40 max-w-7xl mx-auto p-4 md:p-8">

                {/* --- ALERTS & REQUESTS --- */}
                <div className="space-y-4 mb-8">
                    {team.member_requests?.filter(r => r.is_active).map(req => {
                        const hasVoted = req.votes[currentUserId];
                        const approv = Object.values(req.votes).filter(v => v === 'approve').length;
                        const needed = Math.ceil(team.members.length * 0.7);
                        return (
                            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} key={req.id} className="bg-yellow-950/20 backdrop-blur-md border border-yellow-500/30 p-4 rounded-xl flex items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="p-2 bg-yellow-500/20 rounded-lg text-yellow-500"><UserMinus className="w-5 h-5" /></div>
                                    <div>
                                        <h3 className="font-bold text-yellow-400 text-sm">Vote: {req.type === "leave" ? "Member Departure" : "Member Removal"}</h3>
                                        <p className="text-xs text-zinc-400 italic">"{req.explanation}"</p>
                                    </div>
                                </div>
                                {hasVoted ? <span className="text-xs font-bold text-zinc-500 bg-zinc-900 px-3 py-1 rounded-full border border-zinc-800">Voted</span> : (
                                    <div className="flex gap-2">
                                        <button onClick={() => handleVoteRequest(req.id, 'approve')} className="px-3 py-1.5 bg-green-600/20 text-green-400 border border-green-500/30 hover:bg-green-600 hover:text-white rounded-lg text-xs font-bold transition">Approve</button>
                                        <button onClick={() => handleVoteRequest(req.id, 'reject')} className="px-3 py-1.5 bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600 hover:text-white rounded-lg text-xs font-bold transition">Reject ({approv}/{needed})</button>
                                    </div>
                                )}
                            </motion.div>
                        );
                    })}
                </div>

                {/* --- HEADER --- */}
                <header className="mb-12">
                    <div className="flex flex-col lg:flex-row justify-between items-start gap-8">
                        <div className="flex-1 space-y-4">
                            <div className="flex items-center gap-3">
                                {isRecruiting ? 
                                    <span className="animate-pulse inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-green-500/10 text-green-400 border border-green-500/20 shadow-[0_0_10px_rgba(34,197,94,0.2)]">
                                            <Megaphone className="w-3 h-3" /> Recruiting
                                    </span> : 
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zinc-800 text-zinc-500 border border-zinc-700">
                                            Filled
                                    </span>
                                }
                                {team.status === "completed" && <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20"><CheckCircle2 className="w-3 h-3" /> Completed</span>}
                            </div>
                            
                            <h1 className="text-5xl md:text-6xl font-black tracking-tight text-white mb-2">{team.name}
                                {isLeader && team.status !== "completed" && <Link href={`/teams/${team.id}/edit`} className="inline-block ml-4 align-middle"><Edit2 className="w-5 h-5 text-zinc-600 hover:text-purple-400 transition" /></Link>}
                            </h1>
                            
                            <p className="text-lg text-zinc-400 leading-relaxed max-w-2xl">{team.description}</p>
                            
                            <div className="flex flex-wrap gap-6 text-sm font-medium text-zinc-500 pt-2">
                                <div className="flex items-center gap-2"><Users className="w-4 h-4 text-purple-400" /> {team.members.length} / {team.target_members} Members</div>
                                {team.target_completion_date && <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-blue-400" /> Target: {new Date(team.target_completion_date).toLocaleDateString()}</div>}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-3 w-full lg:w-auto min-w-[200px]">
                            {isLeader && team.status !== "completed" && (
                                <>
                                    <Link href={`/matches?type=users&projectId=${team.id}`} className="w-full">
                                        <button className="w-full px-6 py-3.5 bg-zinc-100 text-black hover:bg-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                                            <UserPlus className="w-5 h-5" /> Recruit Talent
                                        </button>
                                    </Link>
                                    <button onClick={team.chat_group_id ? () => router.push(`/chat?targetId=${team.chat_group_id}`) : createTeamChat} className="w-full px-6 py-3.5 bg-zinc-900 text-zinc-300 border border-zinc-800 hover:border-zinc-600 hover:text-white rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2">
                                        <MessageSquare className="w-5 h-5" /> {team.chat_group_id ? "Team Chat" : "Create Group"}
                                    </button>
                                    {team.status === 'planning' ? (
                                        <button onClick={handleStartProject} className="w-full mt-2 px-6 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 hover:shadow-blue-500/20 transition-all active:scale-95">
                                            <Play className="w-5 h-5 fill-current" /> Launch Project
                                        </button>
                                    ) : (
                                        team.status === 'active' && <div className="w-full mt-2 px-6 py-3.5 bg-green-500/10 border border-green-500/20 text-green-500 rounded-xl font-bold flex items-center justify-center gap-2 cursor-default"><CheckCircle2 className="w-5 h-5" /> Active</div>
                                    )}
                                </>
                            )}
                            
                            {/* Member Actions */}
                            {isMember && !isLeader && team.status !== "completed" && (
                                <>
                                    {team.chat_group_id && <button onClick={() => router.push(`/chat?targetId=${team.chat_group_id}`)} className="w-full px-6 py-3 bg-zinc-800 text-zinc-200 rounded-xl font-bold hover:bg-zinc-700 transition flex items-center justify-center gap-2"><MessageSquare className="w-4 h-4" /> Team Chat</button>}
                                    <button onClick={handleLeave} className="w-full px-6 py-3 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl font-bold hover:bg-red-500/20 transition flex items-center justify-center gap-2"><LogOut className="w-4 h-4" /> Leave</button>
                                </>
                            )}
                            
                            {/* Non-Member Actions */}
                            {!isMember && (
                                <button onClick={likeProject} disabled={team.has_liked} className={`w-full px-6 py-4 rounded-xl font-bold transition flex items-center justify-center gap-2 ${team.has_liked ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/20'}`}>
                                    <ThumbsUp className="w-5 h-5" /> {team.has_liked ? "Request Sent" : "I'm Interested"}
                                </button>
                            )}
                        </div>
                    </div>
                </header>
                        
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    {/* Tech Stack Card */}
                    <div className="md:col-span-2 bg-zinc-900/60 backdrop-blur-xl border border-white/5 p-8 rounded-[2rem] relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl -z-10 transition-opacity opacity-50 group-hover:opacity-100"></div>
                        
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold flex items-center gap-3 text-white"><Code2 className="text-purple-400 w-6 h-6" /> Tech Stack</h3>
                            {isLeader && !isEditingSkills && <button onClick={() => setIsEditingSkills(true)} className="text-xs text-zinc-400 hover:text-white font-medium border border-zinc-800 hover:border-zinc-600 px-3 py-1.5 rounded-lg transition-colors">Edit Stack</button>}
                            {isEditingSkills && (
                                <div className="flex gap-2">
                                    <button onClick={askAiForStack} disabled={isSuggesting} className="text-xs bg-blue-600/20 text-blue-400 border border-blue-500/30 px-3 py-1.5 rounded-lg flex gap-1.5 items-center hover:bg-blue-600 hover:text-white transition">{isSuggesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} AI Suggest</button>
                                    <button onClick={saveSkills} className="text-xs bg-green-600 text-white px-4 py-1.5 rounded-lg font-bold hover:bg-green-500">Save</button>
                                </div>
                            )}
                        </div>

                        {/* AI Suggestions Panel */}
                        {isEditingSkills && suggestions && (suggestions.add.length > 0 || suggestions.remove.length > 0) && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mb-6 bg-blue-950/20 border border-blue-500/20 rounded-xl p-4">
                                <h4 className="text-[10px] font-bold text-blue-400 mb-3 uppercase tracking-wider flex items-center gap-2"><Sparkles className="w-3 h-3" /> Recommended Changes</h4>
                                <div className="flex flex-wrap gap-2">
                                    {suggestions.add.map(s => <div key={s} className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 px-3 py-1.5 rounded-lg text-xs text-blue-200 group/item">{s} <button onClick={() => acceptSuggestion('add', s)} className="opacity-50 group-hover/item:opacity-100 hover:text-green-400"><Check className="w-3 h-3" /></button></div>)}
                                    {suggestions.remove.map(s => <div key={s} className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 px-3 py-1.5 rounded-lg text-xs text-red-200 group/item">{s} <button onClick={() => acceptSuggestion('remove', s)} className="opacity-50 group-hover/item:opacity-100 hover:text-red-400"><X className="w-3 h-3" /></button></div>)}
                                </div>
                            </motion.div>
                        )}

                        <div className="flex flex-wrap gap-2">
                            {(isEditingSkills ? localSkills : team.needed_skills).map((skill, k) => (
                                <span key={k} className="bg-zinc-900/50 text-zinc-300 px-4 py-2 rounded-xl text-sm border border-zinc-700/50 flex items-center gap-2 shadow-sm hover:border-zinc-500 transition-colors">
                                    {skill}
                                    {isEditingSkills && <button onClick={() => removeSkill(skill)}><X className="w-3 h-3 text-zinc-500 hover:text-red-400" /></button>}
                                </span>
                            ))}
                            {isEditingSkills && (
                                <div className="relative">
                                    <select className="bg-black/50 border border-zinc-700 text-zinc-400 text-sm rounded-xl px-4 py-2 outline-none focus:border-purple-500 appearance-none pr-8 cursor-pointer hover:bg-zinc-900" value={dropdownValue} onChange={(e) => addSkill(e.target.value)}>
                                        <option value="" disabled>+ Add Skill</option>
                                        {PRESET_SKILLS.filter(s => !localSkills.includes(s)).map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                    <Plus className="absolute right-3 top-2.5 w-4 h-4 text-zinc-500 pointer-events-none" />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Team Members Card - UPDATED WITH GOLDEN RING */}
                    <div className="bg-zinc-900/60 backdrop-blur-xl border border-white/5 p-8 rounded-[2rem] flex flex-col h-full">
                        <h3 className="text-xl font-bold flex items-center gap-3 text-white mb-6">
                            <Users className="text-green-400 w-6 h-6" /> Team
                        </h3>
                        <div className="space-y-4 overflow-y-auto custom-scrollbar pr-2">
                            {team?.members.map((m: any, i: number) => {
                                
                                // 🔍 DEBUG: Log the full member object to see what ID field exists
                                console.log("Rendering Member:", m); 

                                // Handle every possible ID format commonly used in MongoDB/SQL
                                const memberId = m.id || m._id || m.userId || m.user_id;

                                return (
                                    <div key={memberId || i} className="flex items-center justify-between group p-2 hover:bg-white/5 rounded-xl transition-all">
                                        
                                        {/* SWITCHED TO LINK COMPONENT (Better for debugging 404s) */}
                                        <Link 
                                            href={`/profile/${memberId}`}
                                            className="flex items-center gap-3 cursor-pointer"
                                            onClick={(e) => {
                                                if (!memberId) {
                                                    e.preventDefault(); // Stop navigation if ID is missing
                                                    alert("CRITICAL ERROR: Member ID is undefined. Check Console.");
                                                    console.error("Missing ID for member:", m);
                                                }
                                            }}
                                        >
                                            {/* AVATAR WITH GOLDEN RING */}
                                            <img 
                                                src={m.avatar_url || "https://github.com/shadcn.png"} 
                                                className={`w-10 h-10 rounded-full bg-zinc-800 object-cover ${
                                                    (m.id === team.leader_id || m._id === team.leader_id)
                                                    ? "border-2 border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)]" 
                                                    : "border border-zinc-700"
                                                }`} 
                                            />

                                            <div>
                                                <p className="text-sm font-bold text-zinc-200 group-hover:text-purple-400 transition leading-tight">{m.username}</p>
                                                
                                                {/* LEADER BADGE LOGIC */}
                                                {(m.id === team.leader_id || m._id === team.leader_id) && (
                                                    <span className="flex items-center gap-1 text-[9px] font-black text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20 mt-1 uppercase tracking-wide">
                                                        <Trophy className="w-3 h-3" /> Leader
                                                    </span>
                                                )}
                                            </div>
                                        </Link>
                                        
                                        {/* Action Buttons */}
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {(isMember && memberId !== currentUserId) || (!isMember && (m.id === team.leader_id || m._id === team.leader_id)) ? (
                                                <>
                                                    <Link href={`/chat?targetId=${memberId}`}><button className="text-zinc-500 hover:text-blue-400 p-2 hover:bg-blue-500/10 rounded-lg transition"><MessageSquare className="w-4 h-4" /></button></Link>
                                                    <button onClick={() => openEmailComposer(m)} className="text-zinc-500 hover:text-green-400 p-2 hover:bg-green-500/10 rounded-lg transition"><Mail className="w-4 h-4" /></button>
                                                </>
                                            ) : null}
                                            {isLeader && memberId !== team.leader_id && team.status !== "completed" && (
                                                <button onClick={() => handleRemove(memberId)} className="text-zinc-500 hover:text-red-500 p-2 hover:bg-red-500/10 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
                <div className="space-y-6">
                {team.status !== 'planning' && team.status !== 'completed' && (
    <div className="mb-20">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <ClipboardList className="text-blue-400" /> Project Workflow
        </h2>

        {/* --- LEADER INPUT AREA (Your Specific Design) --- */}
        {isLeader && (
            <div className="bg-[#0f0f0f] border border-white/5 p-6 rounded-[2.5rem] mb-8 space-y-4 shadow-2xl shadow-black/50">
                <input 
                    className="w-full bg-black border border-white/10 rounded-2xl p-4 text-sm outline-none focus:border-purple-500 transition-all shadow-inner text-white placeholder:text-zinc-600" 
                    placeholder="What needs to be done?" 
                    value={newTaskDesc} 
                    onChange={e => setNewTaskDesc(e.target.value)} 
                />
                <div className="flex flex-col md:flex-row gap-3">
                    <div className="relative flex-1">
                        <select 
                            className="w-full h-full bg-black border border-white/10 rounded-2xl p-4 text-sm outline-none appearance-none text-zinc-300 cursor-pointer" 
                            value={newTaskAssignee} 
                            onChange={e => setNewTaskAssignee(e.target.value)}
                        >
                            <option value="">Select Collaborator</option>
                            {team.members.map(m => <option key={m.id} value={m.id}>{m.username}</option>)}
                        </select>
                        <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 rotate-90 text-zinc-600 pointer-events-none" />
                    </div>
                    
                    <input 
                        type="datetime-local" 
                        className="flex-1 bg-black border border-white/10 rounded-2xl p-4 text-sm text-zinc-300 outline-none" 
                        style={{ colorScheme: 'dark' }} 
                        value={newTaskDeadline} 
                        onChange={e => setNewTaskDeadline(e.target.value)} 
                    />
                    
                    <button 
                        onClick={handleAssignTask} 
                        disabled={isTaskLoading} 
                        className="bg-purple-600 hover:bg-purple-500 rounded-2xl px-8 font-black uppercase text-[10px] tracking-widest shadow-lg shadow-purple-500/20 transition-all hover:scale-105 active:scale-95 text-white"
                    >
                        {isTaskLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Assign"}
                    </button>
                </div>
            </div>
        )}

        {/* --- TASK LIST (With Smart Color Logic) --- */}
        <div className="space-y-6">
            {team?.members.map(member => {
                const memberTasks = tasks.filter(t => t.assignee_id === member.id);
                if (memberTasks.length === 0) return null;

                return (
                    <div key={member.id} className="bg-zinc-900/30 border border-zinc-800 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-4 border-b border-zinc-800 pb-2">
                            <img src={member.avatar_url || "https://github.com/shadcn.png"} className="w-6 h-6 rounded-full" />
                            <h3 className="font-bold text-zinc-300">{member.username}'s Tasks</h3>
                        </div>
                        
                        <div className="space-y-3">
                            {memberTasks.map(task => {
                                const isMyTask = task.assignee_id === currentUserId;
                                const timeLeft = new Date(task.deadline).getTime() - Date.now();
                                const isApproaching = timeLeft > 0 && timeLeft < 86400000; // < 24 hours

                                // --- COLOR LOGIC ---
                                let style = {
                                    container: "border-blue-500/30 bg-blue-900/10", // Default Blue (Active)
                                    iconBox: "bg-blue-500/20 text-blue-400",
                                    text: "text-blue-100",
                                    metaText: "text-blue-400/60",
                                    icon: <Clock className="w-5 h-5" />
                                };

                                if (task.status === 'completed') {
                                    style = { container: "border-zinc-800 bg-zinc-900/30 opacity-60", iconBox: "bg-zinc-800 text-zinc-500", text: "text-zinc-500 line-through", metaText: "text-zinc-600", icon: <CheckCircle2 className="w-5 h-5" /> };
                                } else if (task.status === 'rework') {
                                    style = { container: "border-red-500/50 bg-red-900/10", iconBox: "bg-red-500/20 text-red-400", text: "text-red-200", metaText: "text-red-400/60", icon: <RotateCcw className="w-5 h-5" /> };
                                } else if (task.status === 'review') { 
                                    style = { container: "border-green-500/50 bg-green-900/10", iconBox: "bg-green-500/20 text-green-400", text: "text-green-100", metaText: "text-green-400/60", icon: <CheckCircle2 className="w-5 h-5" /> };
                                } else if (task.is_overdue) {
                                    style = { container: "border-red-600/60 bg-red-900/20 shadow-[0_0_15px_rgba(220,38,38,0.15)]", iconBox: "bg-red-600/20 text-red-500", text: "text-red-100", metaText: "text-red-400", icon: <AlertTriangle className="w-5 h-5" /> };
                                } else if (task.was_extended) {
                                    style = { container: "border-purple-500/50 bg-purple-900/10", iconBox: "bg-purple-500/20 text-purple-400", text: "text-purple-100", metaText: "text-purple-400/60", icon: <CalendarClock className="w-5 h-5" /> };
                                } else if (isApproaching) {
                                    style = { container: "border-orange-500/50 bg-orange-900/10", iconBox: "bg-orange-500/20 text-orange-400", text: "text-orange-100", metaText: "text-orange-400/60", icon: <Timer className="w-5 h-5" /> };
                                }

                                return (
    <div key={task.id} className={`border p-4 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4 transition-all hover:scale-[1.01] ${style.container}`}>
        <div className="flex items-start gap-4 flex-1">
            <div className={`mt-1 p-2 rounded-full ${style.iconBox}`}>
                {style.icon}
            </div>
            <div>
                <h4 className={`font-bold ${style.text}`}>{task.description}</h4>
                <div className={`flex flex-wrap gap-4 mt-1 text-xs font-medium ${style.metaText}`}>
                    <span className={`flex items-center gap-1 ${task.is_overdue ? 'font-bold' : ''}`}>
                        <Calendar className="w-3 h-3" /> {new Date(task.deadline).toLocaleString()}
                        {task.is_overdue && " (LATE)"}
                    </span>
                    
                    {task.was_extended && !task.is_overdue && <span className="flex items-center gap-1 font-bold"><CalendarClock className="w-3 h-3" /> Extended</span>}
                    
                    {/* FIX: Now checks that status is NOT 'review' (Delivered) and NOT 'completed' */}
                    {isApproaching && !task.is_overdue && !task.was_extended && task.status !== 'completed' && task.status !== 'review' && (
                        <span className="flex items-center gap-1 font-bold"><Timer className="w-3 h-3" /> Due Soon</span>
                    )}
                    
                    {task.status === 'review' && !isMyTask && <span className="uppercase font-bold tracking-wider">Review Needed</span>}
                    
                    {task.extension_active && <span className="text-yellow-400 font-bold flex items-center gap-1 ml-2"><Timer className="w-3 h-3" /> Vote Extension ({task.extension_votes}/{task.extension_required})</span>}
                </div>
            </div>
        </div>
        
        <div className="flex items-center gap-2">
            {(task.status === 'pending' || task.status === 'rework') && isMyTask && (
                <button onClick={() => handleSubmitTask(task.id)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest shadow-lg shadow-blue-900/20 transition-all active:scale-95">
                    Deliver
                </button>
            )}
            {task.status === 'review' && !isMyTask && (
                <div className="flex gap-2">
                    <button onClick={() => handleVerifyTask(task.id)} className="bg-green-600 hover:bg-green-500 text-white px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1 shadow-lg shadow-green-900/20"><Check className="w-3 h-3" /> Verify</button>
                    <button onClick={() => handleReworkTask(task.id)} className="bg-zinc-800 hover:bg-red-500 text-zinc-400 hover:text-white px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"><RotateCcw className="w-3 h-3" /> Rework</button>
                </div>
            )}
            {task.is_overdue && isMyTask && !task.extension_active && (
                <button onClick={() => openExtensionModal(task.id)} className="text-[10px] font-black text-blue-400 bg-blue-400/10 px-3 py-1.5 rounded-xl border border-blue-400/20 hover:bg-blue-400/20 transition">Ask Extension</button>
            )}
            {task.extension_active && !isMyTask && (
                <div className="flex gap-1">
                    <button onClick={() => handleVoteExtension(task.id, 'approve')} className="bg-green-600/20 text-green-400 hover:bg-green-600 hover:text-white p-1.5 rounded transition"><Check className="w-3 h-3" /></button>
                    <button onClick={() => handleVoteExtension(task.id, 'reject')} className="bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white p-1.5 rounded transition"><X className="w-3 h-3" /></button>
                </div>
            )}
            {isLeader && (
                <button onClick={() => handleDeleteTask(task.id)} className="text-zinc-600 hover:text-red-500 p-2 transition"><Trash2 className="w-4 h-4" /></button>
            )}
        </div>
    </div>
);
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
)}

</div>

                {/* --- ROADMAP --- */}
                <div className="mb-16">
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-2xl font-bold flex items-center gap-3"><Calendar className="text-purple-500" /> Execution Roadmap</h2>
                        {isLeader && team.project_roadmap && team.project_roadmap.phases && (
                            <button onClick={generateRoadmap} disabled={isGenerating} className="text-xs flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 transition">
                                {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Regenerate
                            </button>
                        )}
                    </div>
                    
                    {!team.project_roadmap || !team.project_roadmap.phases ? (
                        <div className="text-center py-20 bg-zinc-900/20 rounded-3xl border border-zinc-800/50 border-dashed">
                            <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-zinc-800"><Bot className="w-8 h-8 text-zinc-700" /></div>
                            <p className="text-zinc-500 mb-6 font-medium">No roadmap generated yet.</p>
                            {isLeader ? (
                                <button onClick={generateRoadmap} disabled={isGenerating} className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-xl font-bold transition flex items-center gap-2 mx-auto shadow-lg shadow-purple-900/20">
                                    {isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles className="w-5 h-5" />} Generate Plan
                                </button>
                            ) : <p className="text-sm text-zinc-600">Waiting for leader initialization.</p>}
                        </div>
                    ) : (
                        <div className="relative pl-8 space-y-12 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-zinc-800">
                            {team.project_roadmap.phases.map((phase: any, i: number) => (
                                <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} className="relative">
                                    <div className="absolute -left-[27px] top-1 w-5 h-5 bg-black border-4 border-purple-500 rounded-full shadow-[0_0_15px_rgba(168,85,247,0.4)] z-10"></div>
                                    <div className="flex items-baseline gap-4 mb-4">
                                        <span className="text-purple-400 font-bold font-mono text-sm tracking-wider uppercase">Week {phase.week}</span>
                                        <h3 className="text-xl font-semibold text-white">{phase.goal}</h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {phase.tasks.map((task: any, j: number) => (
                                            <div key={j} className="bg-zinc-900/60 backdrop-blur-sm border border-white/5 p-5 rounded-xl flex gap-4 hover:border-white/10 transition group">
                                                <div className="mt-1 opacity-50 group-hover:opacity-100 transition-opacity">
                                                    {task.role.toLowerCase().includes('front') ? <LayoutDashboard className="w-5 h-5 text-blue-400" /> : task.role.toLowerCase().includes('back') ? <Code2 className="w-5 h-5 text-green-400" /> : <Layers className="w-5 h-5 text-orange-400" />}
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">{task.role}</span>
                                                    <p className="text-zinc-300 text-sm leading-relaxed">{task.task}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>

                {/* --- WORKFLOW --- */}
                

                {/* --- COMPLETED RATING UI --- */}
                {team.status === 'completed' && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-gradient-to-br from-yellow-900/10 via-zinc-900 to-purple-900/10 border border-yellow-500/20 p-10 rounded-[3rem] text-center shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500/50 to-transparent"></div>
                        <div className="inline-flex p-5 bg-yellow-500/10 rounded-full mb-6 border border-yellow-500/20 shadow-[0_0_30px_rgba(234,179,8,0.15)]"><Trophy className="w-12 h-12 text-yellow-400" /></div>
                        <h2 className="text-4xl font-black text-white mb-2">Mission Accomplished!</h2>
                        <p className="text-zinc-400 max-w-xl mx-auto mb-10 text-lg">The project is officially complete. Please rate your experience with your teammates to finalize the collaboration.</p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left max-w-4xl mx-auto">
                            {team.members.filter(m => m.id !== currentUserId).map(m => (
                                <div key={m.id} className="bg-black/40 border border-zinc-800 p-6 rounded-2xl flex flex-col gap-4">
                                    <div className="flex items-center gap-4">
                                        <img src={m.avatar_url || "https://github.com/shadcn.png"} className="w-12 h-12 rounded-full border border-zinc-700" />
                                        <div>
                                            <span className="font-bold text-lg block text-zinc-200">{m.username}</span>
                                            <span className="text-xs text-zinc-500 font-mono">{m.role || "Collaborator"}</span>
                                        </div>
                                        {ratedMembers.includes(m.id) && <span className="ml-auto text-green-400 text-xs font-bold bg-green-900/20 px-3 py-1 rounded-full border border-green-500/20 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Rated</span>}
                                    </div>
                                    {!ratedMembers.includes(m.id) && (
                                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                            <textarea className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-sm focus:border-yellow-500/50 outline-none resize-none h-24 text-zinc-300 placeholder:text-zinc-600" placeholder={`How was working with ${m.username}?`} value={ratingExplanation} onChange={e => setRatingExplanation(e.target.value)} />
                                            <div>
                                                <span className="text-[10px] uppercase text-zinc-500 font-bold mb-2 block">Trust Score</span>
                                                <div className="flex gap-1">
                                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(s => (
                                                        <button key={s} onClick={() => handleRateMember(m.id, s)} disabled={ratingProcessing === m.id} className={`flex-1 h-8 rounded text-[10px] font-bold transition-all hover:-translate-y-1 ${s >= 8 ? 'bg-green-500/20 text-green-400 hover:bg-green-500 hover:text-white' : s >= 5 ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500 hover:text-white' : 'bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white'}`}>{s}</button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </div>

            {/* --- MODALS --- */}
            <AnimatePresence>
                {showEmailModal && emailRecipient && (
                    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-[#111] border border-zinc-800 p-8 rounded-3xl w-full max-w-md shadow-2xl">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold flex items-center gap-2 text-white"><Mail className="w-5 h-5 text-purple-500" /> Send Message</h2>
                                <button onClick={() => setShowEmailModal(false)}><X className="text-zinc-500 hover:text-white transition" /></button>
                            </div>
                            <div className="space-y-4">
                                <div className="bg-zinc-900 p-3 rounded-xl text-sm text-zinc-400 border border-zinc-800">To: <span className="text-white font-bold">{emailRecipient.name}</span></div>
                                <input className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 outline-none focus:border-purple-500 transition text-white" placeholder="Subject" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} />
                                <textarea className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 h-32 outline-none focus:border-purple-500 resize-none transition text-white" placeholder="Type your message..." value={emailBody} onChange={e => setEmailBody(e.target.value)} />
                                <button onClick={handleSendEmail} className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition active:scale-95 shadow-lg shadow-purple-900/20"><Send className="w-4 h-4" /> Send</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
            
             <AnimatePresence>{showExtensionModal && (<div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4"><motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-[#111] border border-white/10 p-10 rounded-[2.5rem] w-full max-w-md shadow-2xl"><h2 className="text-2xl font-black tracking-tight mb-2 text-white">Extend Deadline</h2><p className="text-zinc-500 text-sm mb-8 leading-relaxed">Requesting an extension will require a team vote.</p><input type="datetime-local" className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-white mb-8 outline-none focus:border-blue-500 transition-all" style={{ colorScheme: 'dark' }} value={extensionDate} onChange={e => setExtensionDate(e.target.value)} /><div className="flex gap-4"><button onClick={confirmExtensionRequest} className="flex-1 bg-blue-600 py-4 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-500 active:scale-95 text-white">Submit Request</button><button onClick={() => setShowExtensionModal(false)} className="flex-1 bg-zinc-900 border border-zinc-800 py-4 rounded-xl font-bold text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white transition">Cancel</button></div></motion.div></div>)}</AnimatePresence>
             <AnimatePresence>{showExplainModal && (<div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4"><motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-[#111] border border-white/10 p-10 rounded-[2.5rem] w-full max-w-md shadow-2xl"><h2 className="text-2xl font-black mb-4 text-white">{actionType === "leave" ? "Confirm Departure" : "Confirm Removal"}</h2><textarea className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-5 h-32 mb-8 outline-none focus:border-red-500 transition-all resize-none text-sm text-white" placeholder="Please provide a reason..." value={explanation} onChange={e => setExplanation(e.target.value)} /><div className="flex gap-4"><button onClick={handleConfirmAction} className="flex-1 bg-red-600 py-4 rounded-xl font-bold text-sm shadow-lg shadow-red-500/20 hover:bg-red-500 active:scale-95 text-white">Confirm</button><button onClick={() => setShowExplainModal(false)} className="flex-1 bg-zinc-900 border border-zinc-800 py-4 rounded-xl font-bold text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white transition">Cancel</button></div></motion.div></div>)}</AnimatePresence>
        </div>
    );
}