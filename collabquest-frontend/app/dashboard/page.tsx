"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Cookies from "js-cookie";
import api from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
    Loader2, Globe, Edit2, X, Plus,
    MessageSquare, CheckCircle,
    Briefcase, Send, Code2, Mail, Clock, XCircle, RotateCcw, Check, Trash2,
    Calendar, Layout, Award, Star,
    // Sidebar specific icons
    ChevronLeft, ChevronRight, LayoutDashboard, Users, Settings, LogOut,
    Network, Sparkles, ArrowUpRight
} from "lucide-react";
import Link from "next/link";
import GlobalHeader from "@/components/GlobalHeader";

/* -------------------- INTERFACES -------------------- */
interface UserProfile {
    username: string;
    avatar_url: string;
    trust_score: number;
    is_verified_student: boolean;
    skills: { name: string; level: string }[];
    interests: string[];
    about: string;
    availability_hours: number;
    _id?: string;
    id?: string;
}

interface Match {
    id: string;
    name: string;
    avatar: string;
    contact: string;
    role: "Team Leader" | "Teammate";
    project_id: string;
    project_name: string;
    status: "matched" | "invited" | "requested" | "joined" | "rejected";
    rejected_by?: string;
}

interface TaskItem {
    id: string;
    description: string;
    deadline: string;
    status: string;
    project_id: string;
    project_name: string;
}

/* -------------------- STYLED COMPONENTS -------------------- */
const GlassCard = ({ children, className = "", onClick }: any) => (
    <div 
        onClick={onClick}
        className={`relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-xl transition-all duration-300 hover:bg-white/10 hover:border-white/20 hover:shadow-purple-500/10 ${className}`}
    >
        {children}
    </div>
);

/* -------------------- HELPER COMPONENT: SIDEBAR LINK -------------------- */
const SidebarLink = ({ 
    icon: Icon, 
    label, 
    isCollapsed, 
    active, 
    onClick, 
    id 
}: { 
    icon: any, 
    label: string, 
    isCollapsed: boolean, 
    active: boolean, 
    onClick: () => void, 
    id?: string 
}) => (
    <div 
        id={id}
        onClick={onClick}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer group mb-1
        ${active 
            ? "bg-purple-600/10 text-purple-400 border border-purple-500/20" 
            : "text-gray-400 hover:bg-white/5 hover:text-white hover:border hover:border-white/5 border border-transparent"
        }`}
    >
        <Icon className={`w-5 h-5 shrink-0 ${active ? "text-purple-400" : "text-gray-500 group-hover:text-white"}`} />
        
        {!isCollapsed && (
            <span className="font-medium text-sm whitespace-nowrap overflow-hidden transition-all">
                {label}
            </span>
        )}
        
        {active && !isCollapsed && (
            <motion.div layoutId="active-pill" className="ml-auto w-1.5 h-1.5 rounded-full bg-purple-400" />
        )}
    </div>
);

/* -------------------- MAIN CONTENT COMPONENT -------------------- */
function DashboardContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    // --- UI STATES ---
    const [isCollapsed, setIsCollapsed] = useState(false); 
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [showEmailModal, setShowEmailModal] = useState(false);

    // --- DATA STATES ---
    const [user, setUser] = useState<UserProfile | null>(null);
    const [projectOpportunities, setProjectOpportunities] = useState<Match[]>([]);
    
    // Feature State
    const [activeTasks, setActiveTasks] = useState<TaskItem[]>([]);
    const [historyTasks, setHistoryTasks] = useState<TaskItem[]>([]);
    const [tasksLoading, setTasksLoading] = useState(true);

    // --- FORM STATES ---
    const [emailRecipient, setEmailRecipient] = useState<{ id: string, name: string } | null>(null);
    const [emailSubject, setEmailSubject] = useState("");
    const [emailBody, setEmailBody] = useState("");

    // --- INITIALIZATION ---
    useEffect(() => {
        const urlToken = searchParams.get("token");
        let activeToken = urlToken;
        
        if (urlToken) { 
            Cookies.set("token", urlToken, { expires: 7 }); 
            router.replace("/dashboard"); 
        } else { 
            activeToken = Cookies.get("token") || null; 
            if (!activeToken) { 
                router.push("/"); 
                return; 
            } 
        }
        
        if (activeToken) {
            fetchUserProfile(activeToken);
            fetchMatches(activeToken);
            fetchDashboardData(activeToken);
        }

        const handleSync = () => {
            const token = Cookies.get("token");
            if (token) {
                fetchMatches(token);
                fetchDashboardData(token);
            }
        };
        window.addEventListener("dashboardUpdate", handleSync);
        return () => window.removeEventListener("dashboardUpdate", handleSync);
    }, [searchParams, router]);

    // --- FETCHERS ---
    const fetchUserProfile = async (jwt: string) => {
        try { const response = await api.get("/users/me"); setUser(response.data); } catch (error) { Cookies.remove("token"); router.push("/"); }
    };
    const fetchMatches = async (jwt: string) => {
        try { const res = await api.get("/matches/mine"); setProjectOpportunities(res.data.filter((m: any) => m.role === "Team Leader").reverse()); } catch (e) { }
    }
    const fetchDashboardData = async (jwt: string) => {
        try {
            const config = {
                headers: { Authorization: `Bearer ${jwt}` }
            };
            const taskRes = await api.get("/users/me/tasks", config);
            
            setActiveTasks(taskRes.data.active);
            setHistoryTasks(taskRes.data.history);

        } catch (e) {
            console.error(e);
        } finally {
            setTasksLoading(false);
        }
    }

    // --- ACTIONS ---
    const handleReapply = async (match: Match) => {
        const token = Cookies.get("token");
        setProcessingId(match.id + match.project_id);
        try {
            const updateStatus = (prev: Match[]) => prev.map(m => m.id === match.id && m.project_id === match.project_id ? { ...m, status: "matched" as const } : m);
            setProjectOpportunities(updateStatus);
            await api.post(`/teams/${match.project_id}/reset`, { target_user_id: match.id });
            alert("Status reset! You can now apply/invite again.");
            fetchMatches(token!);
        } catch (err) { alert("Action failed"); }
        finally { setProcessingId(null); }
    }

    const handleDeleteMatch = async (match: Match) => {
        if (!confirm("Remove this project? This will 'unlike' it and remove it from your list.")) return;
        const token = Cookies.get("token");
        const myId = user?._id || user?.id || "";
        try {
            setProjectOpportunities(prev => prev.filter(p => p.project_id !== match.project_id));
            await api.delete(`/matches/delete/${match.project_id}/${myId}`);
        } catch (e) { alert("Failed"); fetchMatches(token!); }
    }

    const handleReject = async (match: Match) => {
        if (!confirm("Are you sure you want to reject this request?")) return;
        const myId = user?._id || user?.id || "";
        try {
            setProjectOpportunities(prev => prev.map(m => m.id === match.id && m.project_id === match.project_id ? { ...m, status: "rejected" as const, rejected_by: myId } : m));
            await api.post(`/teams/${match.project_id}/reject`, { target_user_id: match.id });
            window.dispatchEvent(new Event("triggerNotificationRefresh"));
        } catch (err) { alert("Action failed"); }
    }

    const requestJoin = async (match: Match) => { const token = Cookies.get("token"); setProcessingId(match.id + match.project_id); try { setProjectOpportunities(prev => prev.map(m => m.id === match.id && m.project_id === match.project_id ? { ...m, status: "requested" as const } : m)); await api.post(`/teams/${match.project_id}/invite`, { target_user_id: "LEADER" }); setTimeout(() => fetchMatches(token!), 500); } catch (err: any) { alert("Failed"); fetchMatches(token!); } finally { setProcessingId(null); } }

    const handleConnectionAction = async (match: Match) => {
        const token = Cookies.get("token");
        setProcessingId(match.id + match.project_id);
        try {
            let target = "";
            if (match.role === "Team Leader") target = await getCurrentUserId(token!);

            setProjectOpportunities(prev => prev.map(m => m.id === match.id && m.project_id === match.project_id ? { ...m, status: "joined" as const } : m));
            await api.post(`/teams/${match.project_id}/members`, { target_user_id: target });
            window.dispatchEvent(new Event("triggerNotificationRefresh"));
            alert("Success!");
            setTimeout(() => { fetchMatches(token!); }, 500);
        } catch (err) { alert("Action failed"); fetchMatches(token!); }
        finally { setProcessingId(null); }
    }
    
    const handleTaskSubmit = async (task: TaskItem) => {
        if(!confirm("Mark this task as done and submit for review?")) return;
        const token = Cookies.get("token");
        try {
            setActiveTasks(prev => prev.filter(t => t.id !== task.id));
            await api.post(`/teams/${task.project_id}/tasks/${task.id}/submit`);
            fetchDashboardData(token!);
        } catch(e) { alert("Failed to submit task"); }
    };

    const openEmailComposer = (match: Match) => { setEmailRecipient({ id: match.id, name: match.name }); setShowEmailModal(true); }
    const handleSendEmail = async () => { if (!emailRecipient) return; try { await api.post("/communication/send-email", { recipient_id: emailRecipient.id, subject: emailSubject, body: emailBody }); alert("Email sent!"); setShowEmailModal(false); setEmailSubject(""); setEmailBody(""); } catch (err) { alert("Failed"); } }
    const getCurrentUserId = async (token: string) => { const res = await api.get("/users/me"); return res.data._id || res.data.id; }

    const renderMatchButton = (match: Match) => {
        const isProcessing = processingId === (match.id + match.project_id);
        const baseClass = "flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all";

        if (match.status === "rejected") {
            const myId = user?._id || user?.id;
            const isMe = match.rejected_by === myId;
            const text = isMe ? "Rejected" : "Declined";
            return (
                <div className="flex-1 flex gap-2">
                    <div className="flex-1 bg-red-500/10 border border-red-500/20 text-red-400 py-1.5 rounded-lg text-xs font-bold text-center flex items-center justify-center gap-1">
                        <XCircle className="w-3 h-3" /> {text}
                    </div>
                    <button onClick={() => handleReapply(match)} disabled={isProcessing} className="bg-white/5 hover:bg-white/10 px-2 rounded-lg text-white border border-white/10" title="Re-apply">
                        {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                    </button>
                </div>
            );
        }
        if (match.status === "matched") return <button onClick={() => requestJoin(match)} disabled={isProcessing} className={`${baseClass} bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/20`}>{isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Send className="w-3 h-3" /> Request Join</>}</button>;
        if (match.status === "requested") return <div className={`${baseClass} bg-white/5 border border-white/10 text-white/50 cursor-default`}><Clock className="w-3 h-3" /> Pending</div>;
        if (match.status === "invited") return <div className="flex gap-2 flex-1"><button onClick={() => handleConnectionAction(match)} disabled={isProcessing} className={`${baseClass} bg-green-500 hover:bg-green-400 text-black shadow-lg shadow-green-900/20`}>{isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <><CheckCircle className="w-3 h-3" /> Accept</>}</button><button onClick={() => handleReject(match)} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 px-2 rounded-lg border border-red-500/10"><XCircle className="w-3 h-3" /></button></div>;
        if (match.status === "joined") return <div className={`${baseClass} bg-green-500/10 text-green-400 border border-green-500/20 cursor-default`}>Joined</div>;
        return <div className="flex-1 text-white/40 text-xs text-center py-1">Status: {match.status}</div>;
    };

    if (!user) return <div className="flex h-screen items-center justify-center bg-black text-white"><Loader2 className="animate-spin text-purple-500" /></div>;

    return (
        <div className="flex h-screen bg-[#050505] text-white overflow-hidden font-sans selection:bg-purple-500/30">
            
            {/* --- AMBIENT BACKGROUND --- */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-900/10 rounded-full blur-[120px] mix-blend-screen" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-900/10 rounded-full blur-[120px] mix-blend-screen" />
            </div>

            {/* --- SIDEBAR --- */}
            <aside className={`${isCollapsed ? "w-20" : "w-64"} transition-all duration-300 fixed md:relative h-full border-r border-white/5 bg-[#0F0F0F] flex flex-col z-50 shrink-0`}>
                <div className="p-6 flex items-center justify-between">
                    {!isCollapsed && <h1 className="text-xl font-black tracking-tighter bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">COLLABQUEST</h1>}
                    <button onClick={() => setIsCollapsed(!isCollapsed)} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 transition-colors">
                        {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                    </button>
                </div>

                <nav className="flex-1 px-4 space-y-2 overflow-hidden overflow-y-auto custom-scrollbar">
                    <SidebarLink icon={LayoutDashboard} label="Dashboard" isCollapsed={isCollapsed} active={pathname === "/dashboard"} onClick={() => router.push("/dashboard")} />
                    <SidebarLink icon={Users} label="Find Team" isCollapsed={isCollapsed} active={pathname === "/find-team"} onClick={() => router.push("/find-team")} />
                    
                    {!isCollapsed && <p className="text-[10px] text-gray-500 uppercase px-2 pt-4 mb-2 font-bold tracking-widest">Personal</p>}
                    
                    <SidebarLink icon={Code2} label="My Projects" isCollapsed={isCollapsed} active={pathname.startsWith("/myproject")} onClick={() => router.push("/myproject")} />
                    <SidebarLink icon={Star} label="Saved" isCollapsed={isCollapsed} active={pathname.includes("saved")} onClick={() => router.push("/saved")} />
                    <SidebarLink icon={Globe} label="Network" isCollapsed={isCollapsed} active={pathname.includes("Network")} onClick={() => router.push("/netwrok")} />
                </nav>

                <div onClick={() => router.push("/profile")} className="p-4 border-t border-white/5 bg-black/20 cursor-pointer hover:bg-white/5 transition-all mt-auto">
                    <div className="flex items-center gap-3">
                        <img src={user.avatar_url || "https://github.com/shadcn.png"} className="w-9 h-9 rounded-lg border border-purple-500/50 object-cover shrink-0" />
                        {!isCollapsed && (
                            <div className="flex-1 overflow-hidden">
                                <p className="text-sm font-bold truncate">{user.username}</p>
                                <p className="text-[10px] text-green-400 font-mono">TRUST {user.trust_score?.toFixed(1) || "N/A"}</p>
                            </div>
                        )}
                        {!isCollapsed && <Settings className="w-4 h-4 text-gray-500" />}
                    </div>
                </div>
            </aside>
            {/* --- END SIDEBAR --- */}
            
            
            {/* --- MAIN CONTENT --- */}
            <div className={`flex-1 flex flex-col h-full relative overflow-hidden transition-all duration-300 z-10`}>
                {/* FIX: Added relative z-50 to the header container. 
                    This ensures the header stacking context sits above the scrolling content below it. 
                */}
                <div className="shrink-0 bg-black/20 backdrop-blur-sm border-b border-white/5 relative z-50">
                    <GlobalHeader />
                </div>

                <main className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth custom-scrollbar">
                    <div className="max-w-[1600px] mx-auto space-y-10 pb-20">
                        
                        {/* 1. HERO SECTION */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Link href="/profile" className="block h-full">
                                <GlassCard className="p-8 h-full flex items-center gap-6 group cursor-pointer relative">
                                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity bg-white/10 p-2 rounded-full"><Edit2 className="w-4 h-4 text-purple-300" /></div>
                                    
                                    <img src={user.avatar_url} alt="Avatar" className="w-20 h-20 rounded-full border-2 border-purple-500 shadow-lg shadow-purple-500/20 object-cover" />
                                    <div className="relative z-10">
                                        <h2 className="text-2xl font-bold text-white mb-2">Welcome back, {user.username}!</h2>
                                        <div className="flex flex-wrap gap-2">
                                            {user.skills.length > 0 ? user.skills.slice(0, 3).map((s, i) => (
                                                <span key={i} className="text-xs bg-white/10 px-3 py-1 rounded-full text-white/70 border border-white/5">{s.name}</span>
                                            )) : <span className="text-xs text-yellow-400/80 italic flex items-center gap-1"><Plus className="w-3 h-3"/> Add skills to profile</span>}
                                        </div>
                                    </div>
                                </GlassCard>
                            </Link>
                            
                            <GlassCard className="p-8 h-full flex flex-col justify-center items-start relative overflow-hidden">
                                <div className="absolute top-[-50%] right-[-10%] w-[200px] h-[200px] bg-blue-500/20 rounded-full blur-[60px]" />
                                <div className="relative z-10 w-full">
                                    <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                                        Build Your Dream Team <Sparkles className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                                    </h2>
                                    <p className="text-white/60 mb-6 text-sm">Got an idea? Post it now and match with talented developers instantly.</p>
                                    <Link href="/find-team">
                                        <button className="w-full sm:w-auto px-6 py-3 bg-white text-black font-bold rounded-xl hover:bg-purple-50 transition shadow-lg shadow-white/10 flex items-center justify-center gap-2 group">
                                            <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" /> Create Project
                                        </button>
                                    </Link>
                                </div>
                            </GlassCard>
                        </div>
                        
                        {/* 2. SPLIT LAYOUT */}
                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
                            

                            {/* --- RIGHT COLUMN: ACTIVE TASKS --- */}
                            <div className="xl:col-span-2 w-full space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-bold flex items-center gap-2 text-white">
                                        <div className="p-1.5 bg-green-500/20 rounded-lg"><CheckCircle className="w-4 h-4 text-green-400" /></div>
                                        Active Tasks
                                    </h3>
                                    <span className="text-xs font-mono text-white/40 bg-white/5 px-2 py-1 rounded-md">{activeTasks.length} Pending</span>
                                </div>

                                {tasksLoading ? <div className="text-white/50 flex items-center gap-2 py-8"><Loader2 className="w-4 h-4 animate-spin"/> Loading tasks...</div> : 
                                activeTasks.length === 0 ? (
                                    <GlassCard className="p-12 text-center flex flex-col items-center justify-center gap-4 border-dashed border-white/20 min-h-[250px]">
                                        <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center"><Check className="w-8 h-8 text-green-500/40" /></div>
                                        <p className="text-white/50">All caught up! No pending tasks.</p>
                                    </GlassCard>
                                ) : (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        {activeTasks.map(task => (
                                            <GlassCard key={task.id} className="p-5 flex flex-col justify-between group h-full border-l-4 border-l-purple-500">
                                                <div className="mb-4">
                                                    <div className="flex justify-between items-start mb-3">
                                                        <Link href={`/teams/${task.project_id}`} className="text-[10px] bg-white/5 text-white/60 px-2 py-1 rounded border border-white/10 hover:bg-white/10 transition font-mono uppercase tracking-wide truncate max-w-[150px]">
                                                            {task.project_name}
                                                        </Link>
                                                        <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded ${task.status === 'review' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-blue-500/10 text-blue-400'}`}>
                                                            {task.status}
                                                        </span>
                                                    </div>
                                                    <h4 className="font-bold text-white text-sm line-clamp-2 leading-relaxed group-hover:text-purple-300 transition-colors">{task.description}</h4>
                                                </div>
                                                <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
                                                    <div className="flex items-center gap-1.5 text-xs text-white/40">
                                                        <Calendar className="w-3.5 h-3.5" />
                                                        {new Date(task.deadline).toLocaleDateString()}
                                                    </div>
                                                    {task.status !== 'review' && (
                                                        <button onClick={() => handleTaskSubmit(task)} className="bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-green-900/20">
                                                            <Check className="w-3 h-3" /> Mark Done
                                                        </button>
                                                    )}
                                                </div>
                                            </GlassCard>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        {/* Task History */}
                        {historyTasks.length > 0 && (
                            <div className="w-full">
                                <h3 className="text-sm font-bold uppercase tracking-widest text-white/30 mb-4 pl-1">Recently Completed</h3>
                                <div className="space-y-2">
                                    {historyTasks.map((task, i) => (
                                        <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition group">
                                            <div className="flex items-center gap-4">
                                                <div className="p-2 bg-green-500/10 rounded-full text-green-500 group-hover:scale-110 transition-transform"><Check className="w-3 h-3"/></div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-white/50 line-through decoration-white/20">{task.description}</span>
                                                    <span className="text-[10px] text-white/30">{task.project_name}</span>
                                                </div>
                                            </div>
                                            <span className="text-[10px] text-green-400/50 font-mono">COMPLETED</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                    </div>
                </main>
            </div>
            
            {/* Email Modal */}
            <AnimatePresence>
                {showEmailModal && emailRecipient && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0 }} 
                            animate={{ scale: 1, opacity: 1 }} 
                            exit={{ scale: 0.95, opacity: 0 }} 
                            className="bg-[#121212] border border-white/10 p-8 rounded-2xl w-full max-w-md relative shadow-2xl"
                        >
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-blue-500" />
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold flex items-center gap-2 text-white"><Mail className="w-5 h-5 text-purple-400" /> Secure Message</h2>
                                <button onClick={() => setShowEmailModal(false)} className="p-2 hover:bg-white/10 rounded-full transition"><X className="w-5 h-5 text-white/50" /></button>
                            </div>
                            <div className="space-y-4 mt-4">
                                <div className="bg-white/5 p-3 rounded-xl text-sm text-white/60 border border-white/5">To: <span className="text-white font-bold">{emailRecipient.name}</span></div>
                                <input className="w-full bg-black/40 border border-white/10 rounded-xl p-3 outline-none focus:border-purple-500 text-white transition-colors" placeholder="Subject" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} />
                                <textarea className="w-full bg-black/40 border border-white/10 rounded-xl p-3 h-32 outline-none focus:border-purple-500 resize-none text-white transition-colors" placeholder="Message" value={emailBody} onChange={e => setEmailBody(e.target.value)} />
                                <button onClick={handleSendEmail} className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-purple-900/30 transition-all hover:scale-[1.01]">
                                    <Send className="w-4 h-4" /> Send Message
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

/* -------------------- MAIN EXPORT WITH SUSPENSE -------------------- */
export default function Dashboard() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#050505] text-white"><Loader2 className="animate-spin text-purple-500" /></div>}>
            <DashboardContent />
        </Suspense>
    );
}