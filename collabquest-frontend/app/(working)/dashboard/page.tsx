"use client";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Cookies from "js-cookie";
import api from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
    Sparkles, Loader2, Edit2, X, Plus,
    MessageSquare, Briefcase, Code2, Mail, Trash2,
    RotateCcw, CheckCircle, XCircle, Send, Clock,
    Layers, ArrowRight, Calendar, CalendarClock, Timer, AlertTriangle, CheckCircle2
} from "lucide-react";
import Link from "next/link";

/* -------------------- INTERFACES -------------------- */
interface UserProfile {
    username: string;
    avatar_url: string;
    trust_score: number;
    skills: { name: string; level: string }[];
    _id?: string;
    id?: string;
}

interface Match {
    id: string;
    name: string;
    avatar: string;
    role: "Team Leader" | "Teammate";
    project_id: string;
    project_name: string;
    status: "matched" | "invited" | "requested" | "joined" | "rejected";
    rejected_by?: string;
}

/* -------------------- COMPONENT: ACTIVE WORKFLOW (From Team Page) -------------------- */
function GlobalActiveTasks() {
    const [tasks, setTasks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState("");

    useEffect(() => {
        const loadData = async () => {
            try {
                const token = Cookies.get("token");
                if (!token) return;

                // 1. Get Current User ID
                const userRes = await api.get("/users/me");
                const currentId = userRes.data._id || userRes.data.id;
                setUserId(currentId);

                // 2. Find Projects via Matches (Since /users/me/teams failed)
                const matchesRes = await api.get("/matches/mine");
                
                // Filter: Projects where I am Leader OR have Joined
                // We use a Map to avoid duplicates if you matched multiple times
                const projectMap = new Map();
                if (matchesRes.data && Array.isArray(matchesRes.data)) {
                    matchesRes.data.forEach((m: any) => {
                        if (m.role === 'Team Leader' || m.status === 'joined') {
                            projectMap.set(m.project_id, { id: m.project_id, name: m.project_name });
                        }
                    });
                }
                const myProjects = Array.from(projectMap.values());

                // 3. Fetch Tasks for each Project
                const tasksPromises = myProjects.map((proj: any) =>
                    api.get(`/teams/${proj.id}/tasks`)
                        .then(res => res.data.map((t: any) => ({ ...t, project_name: proj.name, project_id: proj.id })))
                        .catch(() => []) // Ignore failed requests
                );

                const results = await Promise.all(tasksPromises);
                
                // 4. Filter: Only MY Active Tasks
                const allTasks = results.flat().filter((t: any) => 
                    // Robust ID check (String comparison)
                    String(t.assignee_id) === String(currentId) && 
                    t.status !== 'completed'
                );

                // 5. Sort by Deadline
                allTasks.sort((a: any, b: any) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
                setTasks(allTasks);

            } catch (err) {
                console.error("Failed to load active tasks", err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    if (loading) return <div className="h-48 flex items-center justify-center text-zinc-500 animate-pulse">Syncing Mission Data...</div>;
    
    if (tasks.length === 0) return (
        <div className="w-full">
             <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                <div className="h-[1px] w-8 bg-gray-500/50"></div> <Layers className="w-4 h-4" /> Active Workflow
            </h3>
            <div className="w-full h-64 flex flex-col items-center justify-center border border-white/5 bg-[#111] rounded-[2.5rem] p-8 text-center">
                <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mb-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                </div>
                <p className="text-gray-500 font-medium text-sm">All systems nominal.</p>
                <p className="text-gray-600 text-xs mt-1">No pending tasks assigned to you.</p>
            </div>
        </div>
    );

    return (
        <div className="w-full">
            <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                <div className="h-[1px] w-8 bg-gray-500/50"></div> <Layers className="w-4 h-4" /> Active Workflow
            </h3>

            <div className="bg-[#0f0f0f] border border-white/5 rounded-[2.5rem] p-6 space-y-3 shadow-2xl shadow-black/50">
                {tasks.map((task) => {
                    const timeLeft = new Date(task.deadline).getTime() - Date.now();
                    
                    // --- EXACT LOGIC FROM TEAM PAGE ---
                    // "Due Soon" only if approaching, not late, not extended, not completed, not review
                    const isApproaching = timeLeft > 0 && timeLeft < 86400000 && task.status !== 'completed' && task.status !== 'review';

                    let style = {
                        container: "border-blue-500/20 bg-blue-900/5 hover:bg-blue-900/10",
                        iconBox: "bg-blue-500/20 text-blue-400",
                        text: "text-blue-100",
                        metaText: "text-blue-400/60",
                        icon: <Clock className="w-5 h-5" />
                    };

                    if (task.status === 'rework') {
                        style = { container: "border-red-500/30 bg-red-900/10 hover:bg-red-900/20", iconBox: "bg-red-500/20 text-red-400", text: "text-red-200", metaText: "text-red-400/60", icon: <RotateCcw className="w-5 h-5" /> };
                    } else if (task.status === 'review') { 
                        style = { container: "border-green-500/30 bg-green-900/10 hover:bg-green-900/20", iconBox: "bg-green-500/20 text-green-400", text: "text-green-100", metaText: "text-green-400/60", icon: <CheckCircle2 className="w-5 h-5" /> };
                    } else if (task.is_overdue) {
                        style = { container: "border-red-600/40 bg-red-900/20 hover:bg-red-900/30 shadow-[0_0_15px_rgba(220,38,38,0.1)]", iconBox: "bg-red-600/20 text-red-500", text: "text-red-100", metaText: "text-red-400", icon: <AlertTriangle className="w-5 h-5" /> };
                    } else if (task.was_extended) {
                        style = { container: "border-purple-500/30 bg-purple-900/10 hover:bg-purple-900/20", iconBox: "bg-purple-500/20 text-purple-400", text: "text-purple-100", metaText: "text-purple-400/60", icon: <CalendarClock className="w-5 h-5" /> };
                    } else if (isApproaching) {
                        style = { container: "border-orange-500/30 bg-orange-900/10 hover:bg-orange-900/20", iconBox: "bg-orange-500/20 text-orange-400", text: "text-orange-100", metaText: "text-orange-400/60", icon: <Timer className="w-5 h-5" /> };
                    }

                    return (
                        <div key={task.id} className={`group relative border rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 transition-all duration-300 ${style.container}`}>
                            <div className="flex items-start gap-4 flex-1 w-full">
                                <div className={`mt-1 p-2.5 rounded-xl ${style.iconBox} transition-transform group-hover:scale-110`}>
                                    {style.icon}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 bg-black/40 px-2 py-0.5 rounded border border-white/5">
                                            {task.project_name}
                                        </span>
                                        {task.is_overdue && <span className="text-[10px] font-bold bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse">LATE</span>}
                                    </div>
                                    <h4 className={`font-bold text-base ${style.text}`}>{task.description}</h4>
                                    
                                    <div className={`flex flex-wrap gap-4 mt-1.5 text-xs font-medium ${style.metaText}`}>
                                        <span className="flex items-center gap-1.5">
                                            <Calendar className="w-3 h-3" /> {new Date(task.deadline).toLocaleString()}
                                        </span>
                                        
                                        {task.was_extended && !task.is_overdue && <span className="flex items-center gap-1 text-purple-400"><CalendarClock className="w-3 h-3" /> Extended</span>}
                                        
                                        {/* EXACT LOGIC FROM TEAM PAGE: ONLY SHOW IF NOT COMPLETED */}
                                        {isApproaching && !task.is_overdue && !task.was_extended && task.status !== 'completed' && task.status !== 'review' && (
                                            <span className="flex items-center gap-1 text-orange-400 font-bold"><Timer className="w-3 h-3" /> Due Soon</span>
                                        )}

                                        {task.status === 'review' && <span className="uppercase font-bold tracking-wider">In Review</span>}
                                    </div>
                                </div>
                            </div>
                            
                            {/* Action Button: Go to Project */}
                            <Link href={`/teams/${task.project_id}`} className="w-full md:w-auto">
                                <button className="w-full flex items-center justify-center gap-2 bg-[#1a1a1a] hover:bg-white hover:text-black text-zinc-400 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest border border-white/5 hover:border-white transition-all group-hover:shadow-lg">
                                    View <ArrowRight className="w-3 h-3" />
                                </button>
                            </Link>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/* -------------------- MAIN DASHBOARD PAGE -------------------- */
export default function Dashboard() {
    const searchParams = useSearchParams();
    const router = useRouter();

    // UI States
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [showEmailModal, setShowEmailModal] = useState(false);
    
    // Data States
    const [user, setUser] = useState<UserProfile | null>(null);
    const [projectOpportunities, setProjectOpportunities] = useState<Match[]>([]);
    
    // Form States
    const [emailRecipient, setEmailRecipient] = useState<{ id: string, name: string } | null>(null);
    const [emailSubject, setEmailSubject] = useState("");
    const [emailBody, setEmailBody] = useState("");

    /* -------------------- INITIALIZATION -------------------- */
    useEffect(() => {
        const urlToken = searchParams.get("token");
        if (urlToken) { 
            Cookies.set("token", urlToken, { expires: 7 }); 
            router.replace("/dashboard"); 
        } else { 
            const activeToken = Cookies.get("token"); 
            if (!activeToken) { router.push("/"); return; } 
        }

        fetchInitialData();
        const handleSync = () => fetchInitialData();
        window.addEventListener("dashboardUpdate", handleSync);
        return () => window.removeEventListener("dashboardUpdate", handleSync);
    }, [searchParams, router]);

    const fetchInitialData = async () => {
        try {
            const userRes = await api.get("/users/me");
            setUser(userRes.data);
            const matchRes = await api.get("/matches/mine");
            // Filter: where I am the "Team Leader"
            setProjectOpportunities(matchRes.data.filter((m: any) => m.role === "Team Leader").reverse());
        } catch (error) {
            console.error("Session expired or fetch failed", error);
        }
    };

    /* -------------------- LOGIC HANDLERS -------------------- */
    const handleReapply = async (match: Match) => {
        setProcessingId(match.id + match.project_id);
        try {
            await api.post(`/teams/${match.project_id}/reset`, { target_user_id: match.id });
            fetchInitialData();
        } catch (err) { alert("Action failed"); }
        finally { setProcessingId(null); }
    }

    const handleDeleteMatch = async (match: Match) => {
        if (!confirm("Remove this project application?")) return;
        const myId = user?._id || user?.id || "";
        try {
            setProjectOpportunities(prev => prev.filter(p => p.project_id !== match.project_id));
            await api.delete(`/matches/delete/${match.project_id}/${myId}`);
        } catch (e) { alert("Failed"); fetchInitialData(); }
    }

    const handleReject = async (match: Match) => {
        if (!confirm("Reject this request?")) return;
        try {
            await api.post(`/teams/${match.project_id}/reject`, { target_user_id: match.id });
            window.dispatchEvent(new Event("dashboardUpdate"));
            fetchInitialData();
        } catch (err) { alert("Action failed"); }
    }

    const requestJoin = async (match: Match) => { 
        setProcessingId(match.id + match.project_id); 
        try { 
            await api.post(`/teams/${match.project_id}/invite`, { target_user_id: "LEADER" }); 
            setTimeout(() => fetchInitialData(), 500); 
        } catch (err: any) { alert("Failed"); fetchInitialData(); } 
        finally { setProcessingId(null); } 
    }

    const handleJoinAction = async (match: Match) => {
        setProcessingId(match.id + match.project_id);
        try {
            const target = user?._id || user?.id;
            await api.post(`/teams/${match.project_id}/members`, { target_user_id: target });
            window.dispatchEvent(new Event("dashboardUpdate"));
            alert("Joined Successfully!");
            setTimeout(() => fetchInitialData(), 500);
        } catch (err) { alert("Action failed"); fetchInitialData(); }
        finally { setProcessingId(null); }
    }

    const openEmailComposer = (match: Match) => { 
        setEmailRecipient({ id: match.id, name: match.name }); 
        setShowEmailModal(true); 
    }

    const handleSendEmail = async () => { 
        if (!emailRecipient) return; 
        try { 
            await api.post("/communication/send-email", { recipient_id: emailRecipient.id, subject: emailSubject, body: emailBody }); 
            alert("Email sent!"); 
            setShowEmailModal(false); 
            setEmailSubject(""); 
            setEmailBody(""); 
        } catch (err) { alert("Failed to send email"); } 
    }

    /* -------------------- RENDER HELPERS -------------------- */
    const renderMatchButton = (match: Match) => {
        const isProcessing = processingId === (match.id + match.project_id);
        const myId = user?._id || user?.id;

        if (match.status === "rejected") {
            const isMe = match.rejected_by === myId;
            return (
                <div className="flex-1 flex gap-1">
                    <div className="flex-1 bg-red-900/10 text-red-400 border border-red-900/30 py-1.5 rounded-lg text-[10px] font-bold text-center flex items-center justify-center gap-1 uppercase">
                        <XCircle className="w-3 h-3" /> {isMe ? "Rejected" : "Declined"}
                    </div>
                    <button onClick={() => handleReapply(match)} disabled={isProcessing} className="bg-white/5 hover:bg-white/10 px-3 rounded-lg text-gray-400">
                        {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                    </button>
                </div>
            );
        }

        if (match.status === "matched") return <button onClick={() => requestJoin(match)} disabled={isProcessing} className="flex-1 bg-purple-600 hover:bg-purple-500 text-white py-1.5 rounded-lg text-[10px] font-bold uppercase flex items-center justify-center gap-2">{isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Send className="w-3 h-3" /> Request Join</>}</button>;
        if (match.status === "requested") return <div className="flex-1 bg-white/5 text-gray-500 py-1.5 rounded-lg text-[10px] font-bold uppercase flex items-center justify-center gap-2"><Clock className="w-3 h-3" /> Pending</div>;
        if (match.status === "invited") return (
            <div className="flex gap-1 flex-1">
                <button onClick={() => handleJoinAction(match)} disabled={isProcessing} className="flex-1 bg-green-600 hover:bg-green-500 text-white py-1.5 rounded-lg text-[10px] font-bold uppercase flex items-center justify-center gap-2">{isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <><CheckCircle className="w-3 h-3" /> Accept</>}</button>
                <button onClick={() => handleReject(match)} className="bg-red-600/20 text-red-500 hover:bg-red-600 hover:text-white px-3 rounded-lg"><XCircle className="w-3 h-3" /></button>
            </div>
        );
        if (match.status === "joined") return <div className="flex-1 bg-green-500/10 text-green-500 border border-green-500/20 py-1.5 rounded-lg text-[10px] font-bold uppercase text-center">Active Member</div>;

        return <div className="flex-1 text-gray-500 text-[10px] text-center py-1.5 bg-white/5 rounded-lg uppercase">{match.status}</div>;
    };

    if (!user) return <div className="flex h-full min-h-[500px] items-center justify-center"><Loader2 className="animate-spin text-purple-500" /></div>;

    return (
        <div className="space-y-8">
            
            {/* 1. TOP SECTION: WELCOME & CREATE */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Welcome Card */}
                <Link href="/profile">
                    <motion.div whileHover={{ scale: 1.01 }} className="p-6 rounded-2xl bg-[#161616] border border-white/5 shadow-xl flex items-center gap-5 cursor-pointer group hover:border-purple-500/50 transition-all relative h-full">
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Edit2 className="w-4 h-4 text-purple-400" />
                        </div>
                        <img src={user.avatar_url || "https://github.com/shadcn.png"} alt="Avatar" className="w-20 h-20 rounded-2xl border-2 border-purple-500 object-cover shadow-lg shadow-purple-500/20" />
                        <div>
                            <h2 className="text-2xl font-bold tracking-tight">Welcome, {user.username}!</h2>
                            <div className="flex flex-wrap gap-2 mt-3">
                                {user.skills && user.skills.length > 0 ? (
                                    user.skills.slice(0, 3).map((s, i) => (
                                        <span key={i} className="text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 px-2 py-1 rounded border border-purple-500/20 text-purple-400">
                                            {s.name}
                                        </span>
                                    ))
                                ) : (
                                    <span className="text-xs text-yellow-500/70 italic font-medium">Add skills to get matched +</span>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </Link>

                {/* Create Project Action */}
                <motion.div whileHover={{ scale: 1.01 }} className="p-6 rounded-2xl bg-gradient-to-br from-purple-900/20 to-blue-900/20 border border-white/10 flex flex-col justify-center items-start shadow-xl relative overflow-hidden group h-full">
                    <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Sparkles size={120} className="text-white" />
                    </div>
                    <h2 className="text-2xl font-bold mb-2 italic">Forge Your Squad</h2>
                    <p className="text-sm text-gray-400 mb-5 font-medium">Post a mission brief and find experts instantly.</p>
                    <Link href="/find-team" className="w-full">
                        <button className="w-full px-6 py-3 bg-white text-black font-black text-xs uppercase tracking-widest rounded-xl hover:bg-gray-200 transition-all shadow-lg flex items-center justify-center gap-2 active:scale-95">
                            <Plus className="w-4 h-4" /> Create Project
                        </button>
                    </Link>
                </motion.div>
            </div>

            {/* 2. SPLIT LAYOUT: MISSIONS (LEFT) & WORKFLOW (RIGHT) */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
                
                {/* LEFT: ACTIVE MISSIONS */}
                <div className="w-full">
                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                        <div className="h-[1px] w-8 bg-gray-500/50"></div> <Briefcase className="w-4 h-4" /> Active Missions
                    </h3>
                    
                    {projectOpportunities.length === 0 ? (
                        <div className="bg-[#111] border border-white/5 rounded-3xl p-12 text-center">
                            <p className="text-gray-500 italic font-medium mb-4">No active applications in the field.</p>
                            <Link href="/matches?type=projects" className="text-purple-400 font-bold hover:underline text-xs uppercase tracking-widest">Find Missions</Link>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {projectOpportunities.map((m) => (
                                <div key={m.id + m.project_id} className="bg-[#161616] border border-white/5 p-5 rounded-2xl group hover:border-purple-500/30 transition-all flex flex-col justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-purple-600/10 rounded-xl flex items-center justify-center border border-purple-500/20 shrink-0">
                                            <Code2 className="w-6 h-6 text-purple-400" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-base">{m.project_name}</h4>
                                            <p className="text-xs text-gray-500 font-medium">Lead: <span className="text-gray-300">@{m.name}</span></p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 w-full mt-2">
                                        {renderMatchButton(m)}
                                        <div className="flex gap-1">
                                            <button onClick={() => openEmailComposer(m)} className="p-2.5 bg-white/5 rounded-lg hover:text-green-400 transition-colors border border-white/5"><Mail className="w-4 h-4" /></button>
                                            <Link href={`/chat?targetId=${m.id}`}>
                                                <button className="p-2.5 bg-white/5 rounded-lg hover:text-blue-400 transition-colors border border-white/5"><MessageSquare className="w-4 h-4" /></button>
                                            </Link>
                                            <button onClick={() => handleDeleteMatch(m)} className="p-2.5 bg-white/5 rounded-lg hover:text-red-400 transition-colors border border-white/5"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* RIGHT: GLOBAL ACTIVE TASKS (Integrated Component) */}
                <GlobalActiveTasks />

            </div>

            {/* 3. EMAIL MODAL */}
            <AnimatePresence>
                {showEmailModal && emailRecipient && (
                    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-[#111] border border-white/10 p-8 rounded-3xl w-full max-w-md shadow-2xl">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold flex items-center gap-2 text-green-400"><Mail className="w-5 h-5" /> Secure Message</h2>
                                <button onClick={() => setShowEmailModal(false)} className="text-gray-500 hover:text-white"><X /></button>
                            </div>
                            <div className="space-y-4">
                                <div className="bg-white/5 p-3 rounded-xl text-xs text-gray-400">Recipient: <span className="text-white font-bold">@{emailRecipient.name}</span></div>
                                <input className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm outline-none focus:border-purple-500 transition-all" placeholder="Subject" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} />
                                <textarea className="w-full bg-black border border-white/10 rounded-xl p-3 h-40 text-sm outline-none focus:border-purple-500 transition-all resize-none" placeholder="Write your proposal..." value={emailBody} onChange={e => setEmailBody(e.target.value)} />
                                <button onClick={handleSendEmail} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all">
                                    <Send className="w-4 h-4" /> Dispatch Email
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}