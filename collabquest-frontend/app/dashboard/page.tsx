"use client";
import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Cookies from "js-cookie";
import api from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
    ShieldCheck, Loader2, Edit2, X, Plus,
    MessageSquare, UserCheck, Bell, CheckCircle,
    Briefcase, UserPlus, Send, Code2, Mail, Clock, Search, XCircle, RotateCcw, Check, Trash2,
    Calendar, ArrowRight, Layout, Award, Star, Lock
} from "lucide-react";
import Link from "next/link";
import GlobalHeader from "@/components/GlobalHeader";

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

export default function Dashboard() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [user, setUser] = useState<UserProfile | null>(null);

    const [projectOpportunities, setProjectOpportunities] = useState<Match[]>([]);
    const [myProjects, setMyProjects] = useState<Team[]>([]);
    
    // New Feature State
    const [activeTasks, setActiveTasks] = useState<TaskItem[]>([]);
    const [historyTasks, setHistoryTasks] = useState<TaskItem[]>([]);
    const [completedProjects, setCompletedProjects] = useState<Team[]>([]);
    const [favorites, setFavorites] = useState<Team[]>([]);
    const [tasksLoading, setTasksLoading] = useState(true);

    const [processingId, setProcessingId] = useState<string | null>(null);
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [emailRecipient, setEmailRecipient] = useState<{ id: string, name: string } | null>(null);
    const [emailSubject, setEmailSubject] = useState("");
    const [emailBody, setEmailBody] = useState("");
    
    // Guest State
    const [isGuest, setIsGuest] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);

    useEffect(() => {
        const urlToken = searchParams.get("token");
        let activeToken = urlToken;
        if (urlToken) { 
            Cookies.set("token", urlToken, { expires: 7 }); 
            router.replace("/dashboard"); 
        } else { 
            activeToken = Cookies.get("token") || null; 
        }

        if (activeToken) {
            fetchUserProfile(activeToken);
            fetchMatches(activeToken);
            fetchMyProjects(activeToken);
            fetchDashboardData(activeToken);
        } else {
            // GUEST MODE
            setIsGuest(true);
            setTasksLoading(false);
        }

        // Sync with Header Actions
        const handleSync = () => {
            if (activeToken) {
                fetchMatches(activeToken);
                fetchMyProjects(activeToken);
                fetchDashboardData(activeToken);
            }
        };
        window.addEventListener("dashboardUpdate", handleSync);
        return () => window.removeEventListener("dashboardUpdate", handleSync);
    }, [searchParams, router]);

    const fetchUserProfile = async (jwt: string) => {
        try { const response = await api.get("/users/me"); setUser(response.data); } catch (error) { Cookies.remove("token"); setIsGuest(true); }
    };
    const fetchMatches = async (jwt: string) => {
        try { const res = await api.get("/matches/mine"); setProjectOpportunities(res.data.filter((m: any) => m.role === "Team Leader").reverse()); } catch (e) { }
    }
    const fetchMyProjects = async (jwt: string) => {
        try { const res = await api.get("/teams/"); const uid = (await api.get("/users/me")).data._id; setMyProjects(res.data.filter((t: any) => t.members[0] === uid)); } catch (e) { }
    }
    
    const fetchDashboardData = async (jwt: string) => {
        try {
            const taskRes = await api.get("/users/me/tasks");
            setActiveTasks(taskRes.data.active);
            setHistoryTasks(taskRes.data.history);
            
            const projRes = await api.get("/users/me/projects");
            const completed = projRes.data.filter((t: Team) => t.status === "completed");
            setCompletedProjects(completed);

            const favRes = await api.get("/users/me/favorites_details");
            setFavorites(favRes.data);

        } catch (e) { console.error(e); } finally { setTasksLoading(false); }
    };

    // --- HELPER FOR GUEST ---
    const checkGuest = () => {
        if (isGuest || !user) {
            setShowLoginModal(true);
            return true;
        }
        return false;
    };

    // --- ACTIONS ---

    const handleReapply = async (match: Match) => {
        if (checkGuest()) return;
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
        if (checkGuest()) return;
        if (!confirm("Remove this project? This will 'unlike' it and remove it from your list.")) return;
        const token = Cookies.get("token");
        const myId = user?._id || user?.id || "";
        try {
            setProjectOpportunities(prev => prev.filter(p => p.project_id !== match.project_id));
            await api.delete(`/matches/delete/${match.project_id}/${myId}`);
        } catch (e) { alert("Failed"); fetchMatches(token!); }
    }

    const handleReject = async (match: Match) => {
        if (checkGuest()) return;
        if (!confirm("Are you sure you want to reject this request?")) return;
        const token = Cookies.get("token");
        const myId = user?._id || user?.id || "";
        try {
            setProjectOpportunities(prev => prev.map(m => m.id === match.id && m.project_id === match.project_id ? { ...m, status: "rejected" as const, rejected_by: myId } : m));
            await api.post(`/teams/${match.project_id}/reject`, { target_user_id: match.id });
            window.dispatchEvent(new Event("triggerNotificationRefresh"));
        } catch (err) { alert("Action failed"); }
    }

    const requestJoin = async (match: Match) => { 
        if (checkGuest()) return;
        const token = Cookies.get("token"); 
        setProcessingId(match.id + match.project_id); 
        try { 
            setProjectOpportunities(prev => prev.map(m => m.id === match.id && m.project_id === match.project_id ? { ...m, status: "requested" as const } : m)); 
            await api.post(`/teams/${match.project_id}/invite`, { target_user_id: "LEADER" }); 
            setTimeout(() => fetchMatches(token!), 500); 
        } catch (err: any) { alert("Failed"); fetchMatches(token!); } 
        finally { setProcessingId(null); } 
    }

    const handleConnectionAction = async (match: Match) => {
        if (checkGuest()) return;
        const token = Cookies.get("token");
        setProcessingId(match.id + match.project_id);
        try {
            let target = "";
            if (match.role === "Team Leader") target = await getCurrentUserId(token!);

            setProjectOpportunities(prev => prev.map(m => m.id === match.id && m.project_id === match.project_id ? { ...m, status: "joined" as const } : m));
            await api.post(`/teams/${match.project_id}/members`, { target_user_id: target });

            window.dispatchEvent(new Event("triggerNotificationRefresh"));

            alert("Success!");
            setTimeout(() => { fetchMatches(token!); fetchMyProjects(token!); }, 500);
        } catch (err) { alert("Action failed"); fetchMatches(token!); }
        finally { setProcessingId(null); }
    }
    
    const handleTaskSubmit = async (task: TaskItem) => {
        if (checkGuest()) return;
        if(!confirm("Mark this task as done and submit for review?")) return;
        const token = Cookies.get("token");
        try {
            setActiveTasks(prev => prev.filter(t => t.id !== task.id));
            await api.post(`/teams/${task.project_id}/tasks/${task.id}/submit`);
            fetchDashboardData(token!);
        } catch(e) { alert("Failed to submit task"); }
    };

    const openEmailComposer = (match: Match) => { if (checkGuest()) return; setEmailRecipient({ id: match.id, name: match.name }); setShowEmailModal(true); }
    const handleSendEmail = async () => { if (checkGuest()) return; const token = Cookies.get("token"); if (!emailRecipient) return; try { await api.post("/communication/send-email", { recipient_id: emailRecipient.id, subject: emailSubject, body: emailBody }); alert("Email sent!"); setShowEmailModal(false); setEmailSubject(""); setEmailBody(""); } catch (err) { alert("Failed"); } }
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

    if (!user && !isGuest) return <div className="flex h-screen items-center justify-center bg-gray-950 text-white"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="min-h-screen bg-gray-950 text-white relative">
            <GlobalHeader />

            <div className="max-w-6xl mx-auto p-8 pt-12">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                    
                    {/* Welcome / Profile Card */}
                    <Link href={isGuest ? "#" : "/profile"} onClick={(e) => isGuest && e.preventDefault() || checkGuest()}>
                        <motion.div whileHover={{ scale: 1.02 }} className="p-6 rounded-2xl bg-gray-900 border border-gray-800 shadow-xl flex items-center gap-4 cursor-pointer group hover:border-purple-500/50 transition-all relative h-full">
                            {isGuest ? (
                                <>
                                    <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center border-2 border-gray-700">
                                        <Lock className="w-6 h-6 text-gray-500" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-semibold text-white">Welcome, Guest!</h2>
                                        <p className="text-sm text-gray-400 mt-1">Please <span className="text-purple-400 underline">sign in</span> to access all features.</p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"><Edit2 className="w-4 h-4 text-purple-400" /></div>
                                    <img src={user!.avatar_url} alt="Avatar" className="w-16 h-16 rounded-full border-2 border-purple-500" />
                                    <div><h2 className="text-xl font-semibold">Welcome, {user!.username}!</h2><div className="flex flex-wrap gap-2 mt-2">{user!.skills.length > 0 ? user!.skills.slice(0, 3).map((s, i) => <span key={i} className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-300 border border-gray-700">{s.name}</span>) : <span className="text-xs text-yellow-500 italic">Tap to add skills +</span>}</div></div>
                                </>
                            )}
                        </motion.div>
                    </Link>

                    {/* Action Card */}
                    <motion.div onClick={() => checkGuest()} whileHover={{ scale: 1.02 }} className="p-6 rounded-2xl bg-gradient-to-br from-purple-900/50 to-blue-900/50 border border-purple-500/20 flex flex-col justify-center items-start cursor-pointer h-full">
                        <h2 className="text-xl font-semibold mb-2">Build Your Dream Team</h2>
                        <p className="text-sm text-gray-400 mb-4">Post an idea and find hackers instantly.</p>
                        <Link href={isGuest ? "#" : "/find-team"} className="w-full"><button className="w-full px-6 py-2 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition shadow-lg flex items-center gap-2"><Plus className="w-4 h-4" /> Create Project</button></Link>
                    </motion.div>
                </div>
                
                {/* ACTIVE TASKS SECTION */}
                <div className="w-full mb-12">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-green-400">
                        <CheckCircle className="w-5 h-5" /> Active Tasks
                    </h3>
                    {isGuest ? (
                        <div className="bg-gray-900/30 border border-gray-800 border-dashed rounded-xl p-8 text-center text-gray-500 text-sm flex flex-col items-center gap-2">
                             <Lock className="w-6 h-6 text-gray-600 mb-1" />
                             Sign in to view your pending tasks and deadlines.
                        </div>
                    ) : tasksLoading ? <div className="text-gray-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin"/> Loading tasks...</div> : 
                     activeTasks.length === 0 ? (
                        <div className="bg-gray-900/30 border border-gray-800 border-dashed rounded-xl p-6 text-center text-gray-500 text-sm">
                            No active tasks pending.
                        </div>
                     ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {activeTasks.map(task => (
                                <div key={task.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col justify-between hover:border-gray-700 transition">
                                    <div className="mb-4">
                                        <div className="flex justify-between items-start mb-2">
                                            <Link href={`/teams/${task.project_id}`} className="text-[10px] bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded border border-blue-900/50 hover:bg-blue-900/50 transition">
                                                {task.project_name}
                                            </Link>
                                            <span className="text-[10px] text-gray-500 uppercase tracking-widest">{task.status}</span>
                                        </div>
                                        <h4 className="font-bold text-white text-sm line-clamp-2">{task.description}</h4>
                                    </div>
                                    <div className="flex items-center justify-between mt-auto">
                                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                            <Calendar className="w-3.5 h-3.5" />
                                            {new Date(task.deadline).toLocaleDateString()}
                                        </div>
                                        {task.status !== 'review' && (
                                            <button onClick={() => handleTaskSubmit(task)} className="bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5">
                                                <Check className="w-3 h-3" /> Mark Done
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                     )}
                </div>

                {/* MY APPLICATIONS */}
                <div className="w-full mb-12">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-purple-300"><Briefcase className="w-5 h-5" /> My Applications</h3>
                    {isGuest ? (
                        <div className="bg-gray-900/30 border border-gray-800 border-dashed rounded-xl p-8 text-center text-gray-500 text-sm flex flex-col items-center gap-2">
                             <Lock className="w-6 h-6 text-gray-600 mb-1" />
                             Sign in to track your project applications.
                        </div>
                    ) : projectOpportunities.length === 0 ? <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8 text-center text-gray-500"><p>No active applications.</p><Link href="/matches?type=projects" className="text-purple-400 hover:underline text-sm">Find Projects</Link></div> : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {projectOpportunities.map((m) => (
                                <div key={m.id + m.project_id} className="bg-gray-900 border border-gray-800 p-4 rounded-xl">
                                    <div className="flex items-center gap-3 mb-3"><div className="w-8 h-8 bg-purple-900/50 rounded-full flex items-center justify-center border border-purple-500/30"><Code2 className="w-4 h-4 text-purple-400" /></div><div><h4 className="font-bold text-sm">{m.project_name}</h4><p className="text-xs text-gray-400">Leader: {m.name}</p></div></div>
                                    <div className="flex gap-2">
                                        {renderMatchButton(m)}
                                        <button onClick={() => openEmailComposer(m)} className="bg-gray-800 p-1.5 rounded hover:text-green-400" title="Email"><Mail className="w-4 h-4" /></button>
                                        <Link href={`/chat?targetId=${m.id}`}>
                                            <button className="bg-gray-800 p-1.5 rounded hover:text-blue-400" title="Chat"><MessageSquare className="w-4 h-4" /></button>
                                        </Link>
                                        <button onClick={() => handleDeleteMatch(m)} className="bg-gray-800 p-1.5 rounded hover:text-red-400" title="Remove / Unlike"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                 {/* FAVORITED PROJECTS SECTION (NEW) */}
                 {(favorites.length > 0 || isGuest) && (
                    <div className="w-full mb-12">
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-yellow-500">
                            <Star className="w-5 h-5 fill-yellow-500" /> Favorited Projects
                        </h3>
                         {isGuest ? (
                            <div className="bg-gray-900/30 border border-gray-800 border-dashed rounded-xl p-8 text-center text-gray-500 text-sm flex flex-col items-center gap-2">
                                <Lock className="w-6 h-6 text-gray-600 mb-1" />
                                Sign in to see projects you've starred.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {favorites.map(team => (
                                    <Link href={`/teams/${team._id || team.id}`} key={team._id || team.id}>
                                        <div className="bg-gray-900 border border-yellow-500/20 p-5 rounded-xl hover:scale-[1.02] transition cursor-pointer hover:border-yellow-500/50">
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="font-bold text-white truncate w-3/4">{team.name}</h4>
                                                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                            </div>
                                            <p className="text-xs text-gray-500 line-clamp-2">{team.description}</p>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                
                {/* COMPLETED PROJECTS SECTION */}
                {(completedProjects.length > 0 || isGuest) && (
                    <div className="w-full mb-12">
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-blue-400">
                            <Award className="w-5 h-5" /> Completed Projects
                        </h3>
                        {isGuest ? (
                            <div className="bg-gray-900/30 border border-gray-800 border-dashed rounded-xl p-8 text-center text-gray-500 text-sm flex flex-col items-center gap-2">
                                <Lock className="w-6 h-6 text-gray-600 mb-1" />
                                Sign in to view your completed project history.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {completedProjects.map(team => (
                                    <Link href={`/teams/${team._id || team.id}`} key={team._id || team.id}>
                                        <div className="bg-gradient-to-br from-gray-900 to-black border border-blue-500/30 p-5 rounded-xl hover:scale-[1.02] transition cursor-pointer">
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="font-bold text-white truncate">{team.name}</h4>
                                                <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded font-black uppercase">DONE</span>
                                            </div>
                                            <p className="text-xs text-gray-500 line-clamp-2">{team.description}</p>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                
                {/* TASK HISTORY SECTION */}
                {(historyTasks.length > 0 || isGuest) && (
                    <div className="w-full">
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-400">
                            <Layout className="w-5 h-5" /> Task History
                        </h3>
                        {isGuest ? (
                             <div className="bg-gray-900/30 border border-gray-800 border-dashed rounded-xl p-8 text-center text-gray-500 text-sm flex flex-col items-center gap-2">
                                <Lock className="w-6 h-6 text-gray-600 mb-1" />
                                Sign in to view your past activity.
                            </div>
                        ) : (
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
                        )}
                    </div>
                )}

            </div>
            
            {/* EMAIL MODAL */}
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

             {/* GUEST LOGIN POPUP */}
             <AnimatePresence>
                {showLoginModal && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }} 
                            animate={{ scale: 1, opacity: 1 }} 
                            exit={{ scale: 0.9, opacity: 0 }} 
                            className="bg-gray-900 border border-gray-800 p-8 rounded-2xl w-full max-w-md relative text-center shadow-2xl"
                        >
                            <button onClick={() => setShowLoginModal(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
                            
                            <div className="mx-auto w-16 h-16 bg-purple-900/30 rounded-full flex items-center justify-center mb-6 border border-purple-500/30">
                                <Lock className="w-8 h-8 text-purple-400" />
                            </div>
                            
                            <h2 className="text-2xl font-bold text-white mb-2">Sign In Required</h2>
                            <p className="text-gray-400 mb-8">You need to be logged in to access this feature. Join CollabQuest to find your dream team.</p>
                            
                            <div className="flex flex-col gap-3">
                                <Link href="/" className="w-full">
                                    <button className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-purple-900/20">
                                        Sign In / Sign Up
                                    </button>
                                </Link>
                                <button onClick={() => setShowLoginModal(false)} className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-3 rounded-xl transition">
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