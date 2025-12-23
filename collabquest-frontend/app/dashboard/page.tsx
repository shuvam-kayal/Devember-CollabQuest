"use client";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Cookies from "js-cookie";
import api from "@/lib/api"; // Using your custom api utility
import { motion, AnimatePresence } from "framer-motion";
import {
    Sparkles, ChevronLeft, ChevronRight, ShieldCheck, Loader2, Edit2, X, Plus,
    MessageSquare, Bell, Briefcase, Users, Star, Clock, LayoutDashboard, 
    Settings, Send, CheckCircle, XCircle, RotateCcw, Code2, Mail, Trash2, User
} from "lucide-react";
import Link from "next/link";

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
    name: string;
    description: string;
    members: string[];
}

/* -------------------- SIDEBAR LINK -------------------- */
const SidebarLink = ({ icon: Icon, label, active, onClick, isCollapsed }: any) => (
    <div
        onClick={onClick}
        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all
      ${active ? "bg-purple-600/10 text-purple-400" : "text-gray-400 hover:bg-white/5 hover:text-white"}`}
    >
        <Icon className="w-5 h-5 min-w-[20px]" />
        {!isCollapsed && <span className="text-sm font-medium whitespace-nowrap">{label}</span>}
    </div>
);

export default function Dashboard() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    // UI States
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [showEmailModal, setShowEmailModal] = useState(false);
    
    // Data States
    const [user, setUser] = useState<UserProfile | null>(null);
    const [projectOpportunities, setProjectOpportunities] = useState<Match[]>([]);
    const [myProjects, setMyProjects] = useState<Team[]>([]);
    
    // Form States
    const [emailRecipient, setEmailRecipient] = useState<{ id: string, name: string } | null>(null);
    const [emailSubject, setEmailSubject] = useState("");
    const [emailBody, setEmailBody] = useState("");

    /* -------------------- INITIALIZATION & SYNC -------------------- */
    useEffect(() => {
        const urlToken = searchParams.get("token");
        let activeToken = urlToken;
        
        if (urlToken) { 
            Cookies.set("token", urlToken, { expires: 7 }); 
            router.replace("/dashboard"); 
        } else { 
            activeToken = Cookies.get("token") || null; 
            if (!activeToken) { router.push("/"); return; } 
        }

        if (activeToken) {
            fetchInitialData();
        }

        const handleSync = () => fetchInitialData();
        window.addEventListener("dashboardUpdate", handleSync);
        return () => window.removeEventListener("dashboardUpdate", handleSync);
    }, [searchParams]);

    const fetchInitialData = async () => {
        try {
            const userRes = await api.get("/users/me");
            setUser(userRes.data);
            
            const matchRes = await api.get("/matches/mine");
            setProjectOpportunities(matchRes.data.filter((m: any) => m.role === "Team Leader").reverse());
            
            const teamRes = await api.get("/teams/");
            const uid = userRes.data._id || userRes.data.id;
            setMyProjects(teamRes.data.filter((t: any) => t.members.includes(uid)));
        } catch (error) {
            console.error("Session expired");
            Cookies.remove("token");
            router.push("/");
        }
    };

    /* -------------------- HANDLERS -------------------- */
    const handleReapply = async (match: Match) => {
        setProcessingId(match.id + match.project_id);
        try {
            await api.post(`/teams/${match.project_id}/reset`, { target_user_id: match.id });
            fetchInitialData();
        } catch (err) { alert("Action failed"); }
        finally { setProcessingId(null); }
    }

    const handleDeleteMatch = async (match: Match) => {
        if (!confirm("Remove this project?")) return;
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
            window.dispatchEvent(new Event("triggerNotificationRefresh"));
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
            window.dispatchEvent(new Event("triggerNotificationRefresh"));
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
        } catch (err) { alert("Failed"); } 
    }

    /* -------------------- RENDER LOGIC -------------------- */
    const renderMatchButton = (match: Match) => {
        const isProcessing = processingId === (match.id + match.project_id);
        
        if (match.status === "rejected") {
            const myId = user?._id || user?.id;
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
                    <div className="flex items-center gap-3">
                        <img src={user.avatar_url} className="w-9 h-9 rounded-lg border border-purple-500/50 object-cover shrink-0" />
                        {!isCollapsed && (
                            <div className="flex-1 overflow-hidden">
                                <p className="text-sm font-bold truncate">{user.username}</p>
                                <p className="text-[10px] text-green-400 font-mono">TRUST {user.trust_score.toFixed(1)}</p>
                            </div>
                        )}
                        {!isCollapsed && <Settings className="w-4 h-4 text-gray-500" />}
                    </div>
                </div>
            </aside>
            
            {/* -------------------- MAIN CONTENT -------------------- */}
            <main className={`flex-1 ${isCollapsed ? "ml-20" : "ml-64"} transition-all duration-300 min-h-screen`}>
    {/* --- HEADER --- */}
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

    {/* --- CONTENT --- */}
    <div className="p-8 max-w-7xl mx-auto space-y-8">
        {/* Profile and Action Cards Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Welcome Profile Card */}
            <Link href="/profile">
                <motion.div whileHover={{ scale: 1.01 }} className="p-6 rounded-2xl bg-[#161616] border border-white/5 shadow-xl flex items-center gap-5 cursor-pointer group hover:border-purple-500/50 transition-all relative">
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Edit2 className="w-4 h-4 text-purple-400" />
                    </div>
                    <img src={user.avatar_url} alt="Avatar" className="w-20 h-20 rounded-2xl border-2 border-purple-500 object-cover shadow-lg shadow-purple-500/20" />
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
                                <span className="text-xs text-yellow-500/70 italic font-medium">Add skills to your arsenal +</span>
                            )}
                        </div>
                    </div>
                </motion.div>
            </Link>

            {/* "Build Your Dream Team" Action Card */}
            <motion.div whileHover={{ scale: 1.01 }} className="p-6 rounded-2xl bg-gradient-to-br from-purple-900/20 to-blue-900/20 border border-white/10 flex flex-col justify-center items-start shadow-xl relative overflow-hidden group">
                <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Sparkles size={120} className="text-white" />
                </div>
                <h2 className="text-2xl font-bold mb-2 italic">Forge Your Squad</h2>
                <p className="text-sm text-gray-400 mb-5 font-medium">Post an mission brief and find experts instantly.</p>
                <Link href="/find-team" className="w-full">
                    <button className="w-full px-6 py-3 bg-white text-black font-black text-xs uppercase tracking-widest rounded-xl hover:bg-gray-200 transition-all shadow-lg flex items-center justify-center gap-2 active:scale-95">
                        <Plus className="w-4 h-4" /> Create Project
                    </button>
                </Link>
            </motion.div>
        </div>

        {/* Existing "My Applications" Section */}
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
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {projectOpportunities.map((m) => (
                        <div key={m.id + m.project_id} className="bg-[#161616] border border-white/5 p-5 rounded-2xl group hover:border-purple-500/30 transition-all flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-purple-600/10 rounded-xl flex items-center justify-center border border-purple-500/20">
                                    <Code2 className="w-6 h-6 text-purple-400" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-base">{m.project_name}</h4>
                                    <p className="text-xs text-gray-500 font-medium">Lead: <span className="text-gray-300">@{m.name}</span></p>
                                </div>
                            </div>
                            <div className="flex gap-2 w-full sm:w-auto">
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
    </div>
</main>

            {/* -------------------- EMAIL MODAL -------------------- */}
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