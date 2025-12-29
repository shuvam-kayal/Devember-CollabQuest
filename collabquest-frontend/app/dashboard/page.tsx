"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Cookies from "js-cookie";
import api from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
    Loader2, Edit2, X, Plus,
    MessageSquare, CheckCircle,
    Briefcase, Send, Code2, Mail, Clock, XCircle, RotateCcw, Check, Trash2,
    Calendar, Layout, Award, Star,
    // Sidebar specific icons
    ChevronLeft, ChevronRight, LayoutDashboard, Users, Settings, LogOut
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

interface Team {
    _id: string;
    id?: string;
    name: string;
    description: string;
    members: string[];
    status?: string;
}

interface TaskItem {
    id: string;
    description: string;
    deadline: string;
    status: string;
    project_id: string;
    project_name: string;
}

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
            // FIX: We explicitly attach the token to the request headers
            const config = {
                headers: { Authorization: `Bearer ${jwt}` }
            };

            // Pass 'config' as the second argument
            const taskRes = await api.get("/users/me/tasks", config);
            
            setActiveTasks(taskRes.data.active);
            setHistoryTasks(taskRes.data.history);
            
            // If you have other API calls in this function, update them too!
            // Example: await api.get("/other/endpoint", config);

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
        const token = Cookies.get("token");
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
    const handleSendEmail = async () => { const token = Cookies.get("token"); if (!emailRecipient) return; try { await api.post("/communication/send-email", { recipient_id: emailRecipient.id, subject: emailSubject, body: emailBody }); alert("Email sent!"); setShowEmailModal(false); setEmailSubject(""); setEmailBody(""); } catch (err) { alert("Failed"); } }
    const getCurrentUserId = async (token: string) => { const res = await api.get("/users/me"); return res.data._id || res.data.id; }

    const renderMatchButton = (match: Match) => {
        const isProcessing = processingId === (match.id + match.project_id);
        if (match.status === "rejected") {
            const myId = user?._id || user?.id;
            const isMe = match.rejected_by === myId;
            const text = isMe ? "Rejected by You" : "Rejected by Team";
            return (
                <div className="flex-1 flex gap-1">
                    <div className="flex-1 bg-red-900/20 text-red-400 border border-red-900/50 py-1.5 rounded text-xs font-bold text-center flex items-center justify-center gap-1"><XCircle className="w-3 h-3" /> {text}</div>
                    <button onClick={() => handleReapply(match)} disabled={isProcessing} className="bg-gray-700 hover:bg-gray-600 px-2 rounded text-white" title="Re-apply / Reset Status">{isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}</button>
                </div>
            );
        }
        if (match.status === "matched") return <button onClick={() => requestJoin(match)} disabled={isProcessing} className="flex-1 bg-purple-600 hover:bg-purple-500 text-white py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1">{isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Send className="w-3 h-3" /> Request Join</>}</button>;
        if (match.status === "requested") return <div className="flex-1 bg-gray-700 text-gray-400 py-1.5 rounded text-xs flex items-center justify-center gap-1"><Clock className="w-3 h-3" /> Pending</div>;
        if (match.status === "invited") return <div className="flex gap-1 flex-1"><button onClick={() => handleConnectionAction(match)} disabled={isProcessing} className="flex-1 bg-green-600 hover:bg-green-500 text-white py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1">{isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <><CheckCircle className="w-3 h-3" /> Join Team</>}</button><button onClick={() => handleReject(match)} className="bg-red-600 hover:bg-red-500 text-white px-2 rounded"><XCircle className="w-3 h-3" /></button></div>;
        if (match.status === "joined") return <div className="flex-1 bg-gray-800 text-green-400 border border-green-900 py-1.5 rounded text-xs font-bold text-center">Joined</div>;
        return <div className="flex-1 text-gray-500 text-xs text-center py-1 bg-gray-900/50 rounded">Status: {match.status}</div>;
    };

    if (!user) return <div className="flex h-screen items-center justify-center bg-gray-950 text-white"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
            
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
                    
                    <SidebarLink icon={Code2} label="My Projects" isCollapsed={isCollapsed} active={pathname.startsWith("/myproject")} onClick={() => router.push("/projects")} />
                    <SidebarLink icon={Star} label="Saved" isCollapsed={isCollapsed} active={pathname.includes("saved")} onClick={() => router.push("/saved")} />
                    <SidebarLink icon={Clock} label="History" isCollapsed={isCollapsed} active={pathname.includes("history")} onClick={() => router.push("/history")} />
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
            <div className={`flex-1 flex flex-col h-full relative overflow-hidden transition-all duration-300`}>
                <div className="shrink-0">
                    <GlobalHeader />
                </div>

                <main className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth custom-scrollbar">
                    <div className="max-w-[1600px] mx-auto space-y-12 pb-20">
                        
                        {/* 1. WELCOME SECTION (Full Width) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Link href="/profile">
                                <motion.div whileHover={{ scale: 1.01 }} className="p-6 rounded-2xl bg-gray-900 border border-gray-800 shadow-xl flex items-center gap-4 cursor-pointer group hover:border-purple-500/50 transition-all relative h-full">
                                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"><Edit2 className="w-4 h-4 text-purple-400" /></div>
                                    <img src={user.avatar_url} alt="Avatar" className="w-16 h-16 rounded-full border-2 border-purple-500" />
                                    <div><h2 className="text-xl font-semibold">Welcome, {user.username}!</h2><div className="flex flex-wrap gap-2 mt-2">{user.skills.length > 0 ? user.skills.slice(0, 3).map((s, i) => <span key={i} className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-300 border border-gray-700">{s.name}</span>) : <span className="text-xs text-yellow-500 italic">Tap to add skills +</span>}</div></div>
                                </motion.div>
                            </Link>
                            <motion.div whileHover={{ scale: 1.01 }} className="p-6 rounded-2xl bg-gradient-to-br from-purple-900/50 to-blue-900/50 border border-purple-500/20 flex flex-col justify-center items-start h-full">
                                <h2 className="text-xl font-semibold mb-2">Build Your Dream Team</h2>
                                <p className="text-sm text-gray-400 mb-4">Post an idea and find hackers instantly.</p>
                                <Link href="/find-team"><button className="w-full px-6 py-2 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition shadow-lg flex items-center gap-2"><Plus className="w-4 h-4" /> Create Project</button></Link>
                            </motion.div>
                        </div>
                        
                        {/* 2. SPLIT LAYOUT: Applications (Left) / Tasks (Right) */}
                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
                            
                            {/* --- LEFT COLUMN: APPLICATIONS (Takes 1/3 Width) --- */}
                            <div className="xl:col-span-1 w-full">
                                <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-purple-300"><Briefcase className="w-5 h-5" /> Applications</h3>
                                {projectOpportunities.length === 0 ? <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8 text-center text-gray-500 h-64 flex flex-col items-center justify-center gap-2"><p>No active applications.</p><Link href="/matches?type=projects" className="text-purple-400 hover:underline text-sm font-bold uppercase tracking-wide">Find Projects</Link></div> : (
                                    <div className="flex flex-col gap-4">
                                        {projectOpportunities.map((m) => (
                                            <div key={m.id + m.project_id} className="bg-gray-900 border border-gray-800 p-4 rounded-xl hover:bg-gray-900/80 transition shadow-lg">
                                                <div className="flex items-center gap-3 mb-3 pb-3 border-b border-gray-800">
                                                    <div className="w-10 h-10 bg-purple-900/30 rounded-lg flex items-center justify-center border border-purple-500/20 shrink-0"><Code2 className="w-5 h-5 text-purple-400" /></div>
                                                    <div className="overflow-hidden">
                                                        <h4 className="font-bold text-sm text-white truncate">{m.project_name}</h4>
                                                        <p className="text-xs text-gray-400 truncate">Lead: {m.name}</p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-2">
                                                    <div className="flex w-full gap-2">
                                                        {renderMatchButton(m)}
                                                    </div>
                                                    <div className="flex gap-1 justify-end">
                                                        <button onClick={() => openEmailComposer(m)} className="bg-gray-800 p-2 rounded hover:text-green-400 hover:bg-gray-700 transition" title="Email"><Mail className="w-4 h-4" /></button>
                                                        <Link href={`/chat?targetId=${m.id}`}>
                                                            <button className="bg-gray-800 p-2 rounded hover:text-blue-400 hover:bg-gray-700 transition" title="Chat"><MessageSquare className="w-4 h-4" /></button>
                                                        </Link>
                                                        <button onClick={() => handleDeleteMatch(m)} className="bg-gray-800 p-2 rounded hover:text-red-400 hover:bg-gray-700 transition" title="Remove"><Trash2 className="w-4 h-4" /></button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* --- RIGHT COLUMN: ACTIVE TASKS (Takes 2/3 Width) --- */}
                            <div className="xl:col-span-2 w-full">
                                <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-green-400">
                                    <CheckCircle className="w-5 h-5" /> Active Tasks
                                </h3>
                                {tasksLoading ? <div className="text-gray-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin"/> Loading tasks...</div> : 
                                activeTasks.length === 0 ? (
                                    <div className="bg-gray-900/30 border border-gray-800 border-dashed rounded-xl p-8 text-center text-gray-500 text-sm h-64 flex items-center justify-center flex-col gap-2">
                                        <CheckCircle className="w-8 h-8 text-gray-700 mb-2" />
                                        <span>No active tasks pending. You are all caught up!</span>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        {activeTasks.map(task => (
                                            <div key={task.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col justify-between hover:border-green-500/30 transition shadow-lg">
                                                <div className="mb-4">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <Link href={`/teams/${task.project_id}`} className="text-[10px] bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded border border-blue-900/50 hover:bg-blue-900/50 transition font-mono uppercase">
                                                            {task.project_name}
                                                        </Link>
                                                        <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">{task.status}</span>
                                                    </div>
                                                    <h4 className="font-bold text-white text-sm line-clamp-2 leading-relaxed">{task.description}</h4>
                                                </div>
                                                <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-800">
                                                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                                        <Calendar className="w-3.5 h-3.5" />
                                                        {new Date(task.deadline).toLocaleDateString()}
                                                    </div>
                                                    {task.status !== 'review' && (
                                                        <button onClick={() => handleTaskSubmit(task)} className="bg-green-600 hover:bg-green-500 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-green-900/20">
                                                            <Check className="w-3 h-3" /> Mark Done
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        {/* Task History */}
                        {historyTasks.length > 0 && (
                            <div className="w-full">
                                <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-400">
                                    <Layout className="w-5 h-5" /> Task History
                                </h3>
                                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden max-h-60 overflow-y-auto custom-scrollbar">
                                    {historyTasks.map((task, i) => (
                                        <div key={i} className="flex items-center justify-between p-4 border-b border-gray-800 last:border-0 hover:bg-gray-800/50 transition">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-gray-300 line-through decoration-gray-600">{task.description}</span>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] text-blue-400">{task.project_name}</span>
                                                    <span className="text-[10px] text-gray-600">•</span>
                                                    <span className="text-[10px] text-gray-500">Completed</span>
                                                </div>
                                            </div>
                                            <div className="text-green-500">
                                                <CheckCircle className="w-4 h-4" />
                                            </div>
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
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-gray-900 border border-gray-800 p-8 rounded-2xl w-full max-w-md relative">
                            <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold flex items-center gap-2"><Mail className="w-5 h-5" /> Send Secure Message</h2><button onClick={() => setShowEmailModal(false)}><X className="text-gray-500 hover:text-white" /></button></div>
                            <div className="space-y-4 mt-4"><div className="bg-gray-800/50 p-3 rounded-lg text-sm text-gray-400">To: <span className="text-white font-bold">{emailRecipient.name}</span> (Email Hidden)</div><input className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 outline-none focus:border-green-500" placeholder="Subject" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} /><textarea className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 h-32 outline-none focus:border-green-500 resize-none" placeholder="Message" value={emailBody} onChange={e => setEmailBody(e.target.value)} /><button onClick={handleSendEmail} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2"><Send className="w-4 h-4" /> Send Message</button></div>
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
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-gray-950 text-white"><Loader2 className="animate-spin text-purple-500" /></div>}>
            <DashboardContent />
        </Suspense>
    );
}