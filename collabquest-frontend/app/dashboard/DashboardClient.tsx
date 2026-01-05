"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Cookies from "js-cookie";
import api from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
    Loader2, Globe, Edit2, X, Plus,
    MessageSquare, CheckCircle,
    Briefcase, Send, Code2, Mail, Clock, XCircle, RotateCcw, Check, Trash2,
    Calendar, Layout, Award, Star,
    ChevronLeft, ChevronRight, LayoutDashboard, Users, Settings, LogOut,
    Network, Sparkles, ArrowUpRight, Rocket, TrendingUp
} from "lucide-react";
import Link from "next/link";
import GlobalHeader from "@/components/GlobalHeader";
import OnboardingTutorial from "@/components/OnboardingTutorial";

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

interface TopUser {
    id: string;
    username: string;
    avatar_url: string;
    trust_score: number;
    skills: string[];
}

interface TopProject {
    id: string;
    name: string;
    description: string;
    favorite_count: number;
    needed_skills: string[];
}

/* -------------------- STYLED COMPONENTS -------------------- */
const DashboardCard = ({ children, className = "", onClick, glow = false }: any) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        onClick={onClick}
        className={`
            relative overflow-hidden rounded-2xl 
            bg-[#0D0D12] border border-white/[0.08]
            ${glow ? 'shadow-[0_0_60px_-15px_rgba(168,85,247,0.3)]' : ''}
            ${className}
        `}
    >
        {children}
    </motion.div>
);

const GlowOrb = ({ className = "" }: { className?: string }) => (
    <div className={`absolute rounded-full blur-[100px] opacity-30 pointer-events-none ${className}`} />
);

const NEWS_ITEMS = [
    { version: "v1.2.0", date: "Dec 10", title: "Real-time Chat", desc: "Collaborate instantly with your team.", icon: MessageSquare },
    { version: "v1.1.5", date: "Dec 23", title: "Smart Matching", desc: "Improved algorithm for skill-based teams.", icon: Sparkles },
];

/* -------------------- SIDEBAR COMPONENT -------------------- */
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
    <button
        id={id}
        onClick={onClick}
        className={`
            w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300
            ${active
                ? 'bg-gradient-to-r from-purple-600/20 to-purple-500/10 text-white border border-purple-500/30 shadow-[0_0_20px_-5px_rgba(168,85,247,0.4)]'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }
            ${isCollapsed ? 'justify-center' : ''}
        `}
    >
        <Icon className={`w-5 h-5 ${active ? 'text-purple-400' : ''}`} />
        {!isCollapsed && (
            <span className="font-medium text-sm tracking-wide">
                {label}
            </span>
        )}
    </button>
);

/* -------------------- MAIN CONTENT COMPONENT -------------------- */
export default function DashboardClient() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const [isCollapsed, setIsCollapsed] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [showEmailModal, setShowEmailModal] = useState(false);

    const [user, setUser] = useState<UserProfile | null>(null);
    const [projectOpportunities, setProjectOpportunities] = useState<Match[]>([]);
    const [activeTasks, setActiveTasks] = useState<TaskItem[]>([]);
    const [historyTasks, setHistoryTasks] = useState<TaskItem[]>([]);
    const [tasksLoading, setTasksLoading] = useState(true);
    const [topUsers, setTopUsers] = useState<TopUser[]>([]);
    const [topProjects, setTopProjects] = useState<TopProject[]>([]);

    const [emailRecipient, setEmailRecipient] = useState<{ id: string, name: string } | null>(null);
    const [emailSubject, setEmailSubject] = useState("");
    const [emailBody, setEmailBody] = useState("");

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
            fetchLeaderboards(activeToken);
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

    const fetchUserProfile = async (jwt: string) => {
        try { const response = await api.get("/users/me"); setUser(response.data); } catch (error) { Cookies.remove("token"); router.push("/"); }
    };
    const fetchMatches = async (jwt: string) => {
        try { const res = await api.get("/matches/mine"); setProjectOpportunities(res.data.filter((m: any) => m.role === "Team Leader").reverse()); } catch (e) { }
    };
    const fetchDashboardData = async (jwt: string) => {
        try {
            const config = { headers: { Authorization: `Bearer ${jwt}` } };
            const taskRes = await api.get("/users/me/tasks", config);
            setActiveTasks(taskRes.data.active);
            setHistoryTasks(taskRes.data.history);
        } catch (e) { console.error(e); } finally { setTasksLoading(false); }
    };
    const fetchLeaderboards = async (jwt: string) => {
        try {
            const [uRes, pRes] = await Promise.all([api.get("/users/top"), api.get("/teams/top")]);
            setTopUsers(uRes.data);
            setTopProjects(pRes.data);
        } catch (e) { console.error("Failed to fetch leaderboards"); }
    };

    const handleReapply = async (match: Match) => {
        const token = Cookies.get("token");
        setProcessingId(match.id + match.project_id);
        try {
            setProjectOpportunities(prev => prev.map(m => m.id === match.id && m.project_id === match.project_id ? { ...m, status: "matched" as const } : m));
            await api.post(`/teams/${match.project_id}/reset`, { target_user_id: match.id });
            alert("Status reset! You can now apply/invite again.");
            fetchMatches(token!);
        } catch (err) { alert("Action failed"); } finally { setProcessingId(null); }
    };
    const handleReject = async (match: Match) => {
        if (!confirm("Are you sure you want to reject this request?")) return;
        const myId = user?._id || user?.id || "";
        try {
            setProjectOpportunities(prev => prev.map(m => m.id === match.id && m.project_id === match.project_id ? { ...m, status: "rejected" as const, rejected_by: myId } : m));
            await api.post(`/teams/${match.project_id}/reject`, { target_user_id: match.id });
            window.dispatchEvent(new Event("triggerNotificationRefresh"));
        } catch (err) { alert("Action failed"); }
    };
    const requestJoin = async (match: Match) => {
        const token = Cookies.get("token");
        setProcessingId(match.id + match.project_id);
        try {
            setProjectOpportunities(prev => prev.map(m => m.id === match.id && m.project_id === match.project_id ? { ...m, status: "requested" as const } : m));
            await api.post(`/teams/${match.project_id}/invite`, { target_user_id: "LEADER" });
            setTimeout(() => fetchMatches(token!), 500);
        } catch (err: any) { alert("Failed"); fetchMatches(token!); } finally { setProcessingId(null); }
    };
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
        } catch (err) { alert("Action failed"); fetchMatches(token!); } finally { setProcessingId(null); }
    };
    const handleTaskSubmit = async (task: TaskItem) => {
        if (!confirm("Mark this task as done and submit for review?")) return;
        const token = Cookies.get("token");
        try {
            setActiveTasks(prev => prev.filter(t => t.id !== task.id));
            await api.post(`/teams/${task.project_id}/tasks/${task.id}/submit`);
            fetchDashboardData(token!);
        } catch (e) { alert("Failed to submit task"); }
    };
    const handleSendEmail = async () => {
        if (!emailRecipient) return;
        try {
            await api.post("/communication/send-email", { recipient_id: emailRecipient.id, subject: emailSubject, body: emailBody });
            alert("Email sent!");
            setShowEmailModal(false);
            setEmailSubject("");
            setEmailBody("");
        } catch (err) { alert("Failed"); }
    };
    const getCurrentUserId = async (token: string) => {
        const res = await api.get("/users/me");
        return res.data._id || res.data.id;
    };

    const renderMatchButton = (match: Match) => {
        const isProcessing = processingId === (match.id + match.project_id);
        const baseClass = "flex-1 py-2.5 rounded-full text-xs font-bold flex items-center justify-center gap-2 transition-all duration-300";

        if (match.status === "rejected") {
            const myId = user?._id || user?.id;
            const isMe = match.rejected_by === myId;
            return (
                <div className="flex gap-2">
                    <span className="flex-1 py-2.5 rounded-full text-xs font-bold flex items-center justify-center gap-2 bg-red-500/10 text-red-400 border border-red-500/20">
                        <XCircle className="w-3.5 h-3.5" /> {isMe ? "Rejected" : "Declined"}
                    </span>
                    <button onClick={() => handleReapply(match)} disabled={isProcessing} className="bg-white/5 hover:bg-white/10 px-4 rounded-full text-white border border-white/10 transition-all" title="Re-apply">
                        <RotateCcw className="w-4 h-4" />
                    </button>
                </div>
            );
        }
        if (match.status === "matched") return (
            <button onClick={() => requestJoin(match)} disabled={isProcessing} className={`${baseClass} bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white shadow-[0_0_30px_-5px_rgba(168,85,247,0.5)]`}>
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-3.5 h-3.5" /> Request Join</>}
            </button>
        );
        if (match.status === "requested") return <div className="flex-1 py-2.5 rounded-full text-xs font-bold flex items-center justify-center gap-2 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"><Clock className="w-3.5 h-3.5" /> Pending</div>;
        if (match.status === "invited") return (
            <div className="flex gap-2">
                <button onClick={() => handleConnectionAction(match)} disabled={isProcessing} className={`${baseClass} bg-gradient-to-r from-green-500 to-emerald-400 hover:from-green-400 hover:to-emerald-300 text-black shadow-[0_0_30px_-5px_rgba(34,197,94,0.5)]`}>
                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-3.5 h-3.5" /> Accept</>}
                </button>
                <button onClick={() => handleReject(match)} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 px-4 rounded-full border border-red-500/20 transition-all"><X className="w-4 h-4" /></button>
            </div>
        );
        if (match.status === "joined") return <div className="flex-1 py-2.5 rounded-full text-xs font-bold flex items-center justify-center gap-2 bg-green-500/10 text-green-400 border border-green-500/20"><CheckCircle className="w-3.5 h-3.5" /> Joined</div>;
        return <div className="text-gray-500 text-xs">Status: {match.status}</div>;
    };

    if (!user) return (
        <div className="min-h-screen bg-[#09090B] flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                <p className="text-gray-400 text-sm">Loading your dashboard...</p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#09090B] text-white overflow-hidden">
            {/* Background Effects */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px]" />
                <GlowOrb className="w-[600px] h-[600px] bg-purple-600 -top-40 -right-40" />
                <GlowOrb className="w-[400px] h-[400px] bg-purple-500 bottom-20 -left-20" />
            </div>

            {/* Sidebar */}
            <motion.aside
                initial={{ x: -100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className={`fixed top-0 left-0 h-screen ${isCollapsed ? 'w-20' : 'w-64'} bg-[#0D0D12]/80 backdrop-blur-xl border-r border-white/[0.06] z-50 flex flex-col transition-all duration-300`}
            >
                <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
                    {!isCollapsed && (
                        <Link href="/" className="text-xl font-black bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">
                            CollabQuest
                        </Link>
                    )}
                    <button onClick={() => setIsCollapsed(!isCollapsed)} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 transition-all">
                        {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                    </button>
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    <SidebarLink icon={LayoutDashboard} label="Dashboard" isCollapsed={isCollapsed} active={pathname === "/dashboard"} onClick={() => router.push("/dashboard")} id="nav-dashboard" />
                    <SidebarLink icon={Users} label="Find Team" isCollapsed={isCollapsed} active={pathname === "/find-team"} onClick={() => router.push("/find-team")} id="nav-find-team" />

                    {!isCollapsed && <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pt-6 pb-2 px-2">Personal</p>}

                    <SidebarLink icon={Briefcase} label="My Projects" isCollapsed={isCollapsed} active={pathname === "/myproject"} onClick={() => router.push("/myproject")} />
                    <SidebarLink icon={Star} label="Saved" isCollapsed={isCollapsed} active={pathname === "/saved"} onClick={() => router.push("/saved")} />
                    <SidebarLink icon={Network} label="Network" isCollapsed={isCollapsed} active={pathname === "/network"} onClick={() => router.push("/network")} />
                </nav>

                <div onClick={() => router.push("/profile")} className="p-4 border-t border-white/[0.06] bg-gradient-to-r from-purple-600/5 to-transparent cursor-pointer hover:from-purple-600/10 transition-all">
                    <div className="flex items-center gap-3">
                        <img src={user.avatar_url || "/default-avatar.png"} alt="Avatar" className="w-10 h-10 rounded-full border-2 border-purple-500/50 object-cover" />
                        {!isCollapsed && (
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm truncate">{user.username}</p>
                                <p className="text-[10px] text-purple-400 font-medium">TRUST: {user.trust_score?.toFixed(0) || "N/A"}</p>
                            </div>
                        )}
                        {!isCollapsed && <Settings className="w-4 h-4 text-gray-500" />}
                    </div>
                </div>
            </motion.aside>

            {/* Main Content */}
            <main className={`${isCollapsed ? 'ml-20' : 'ml-64'} transition-all duration-300 min-h-screen`}>
                <header className="sticky top-0 z-40 bg-[#09090B]/80 backdrop-blur-xl border-b border-white/[0.06] px-8 py-4">
                    <GlobalHeader />
                </header>

                <div className="p-8 space-y-8">
                    {/* Hero Section */}
                    <DashboardCard glow className="p-8">
                        <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
                            <div className="flex items-center gap-5">
                                <div className="relative">
                                    <img src={user.avatar_url || "/default-avatar.png"} alt="Avatar" className="w-20 h-20 rounded-2xl object-cover border-2 border-purple-500/50" />
                                    <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-green-500 rounded-full border-4 border-[#0D0D12]" />
                                </div>
                                <div>
                                    <p className="text-gray-400 text-sm">Welcome back,</p>
                                    <h1 className="text-3xl font-black text-white">{user.username}</h1>
                                    <div className="flex gap-2 mt-2">
                                        {user.skills.length > 0 ? user.skills.slice(0, 3).map((s, i) => (
                                            <span key={i} className="px-3 py-1 text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-full">{s.name}</span>
                                        )) : <span className="text-gray-500 text-xs">Add skills to profile</span>}
                                    </div>
                                </div>
                            </div>

                            <div className="text-center lg:text-left flex-1 max-w-xl">
                                <h2 className="text-2xl lg:text-3xl font-black">
                                    Find your <span className="bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">dream team</span>
                                </h2>
                                <p className="text-gray-400 mt-2 text-sm">Join thousands of students building amazing projects. Your next big idea starts here.</p>
                                <div className="flex gap-3 mt-4 justify-center lg:justify-start">
                                    <Link href="/create-project" className="px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white font-bold rounded-full flex items-center gap-2 shadow-[0_0_30px_-5px_rgba(168,85,247,0.5)] transition-all">
                                        <Rocket className="w-4 h-4" /> Create Project
                                    </Link>
                                    <Link href="/explore" className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium rounded-full transition-all">
                                        Browse Ideas
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </DashboardCard>

                    {/* Split Layout */}
                    <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
                        {/* Left Column */}
                        <div className="xl:col-span-3 space-y-8">
                            {/* Active Tasks */}
                            <DashboardCard className="p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                                            <Layout className="w-5 h-5 text-purple-400" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg">Active Tasks</h3>
                                            <p className="text-xs text-gray-500">{activeTasks.length} pending</p>
                                        </div>
                                    </div>
                                </div>

                                {tasksLoading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                                    </div>
                                ) : activeTasks.length === 0 ? (
                                    <div className="text-center py-12">
                                        <CheckCircle className="w-12 h-12 text-green-500/50 mx-auto mb-3" />
                                        <p className="text-gray-500">All caught up! No pending tasks.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {activeTasks.map(task => (
                                            <motion.div
                                                key={task.id}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-purple-500/30 transition-all"
                                            >
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <span className="text-xs font-medium text-purple-400">{task.project_name}</span>
                                                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${task.status === 'review' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-blue-500/10 text-blue-400'}`}>
                                                                {task.status}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm text-gray-300">{task.description}</p>
                                                        <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500">
                                                            <Calendar className="w-3 h-3" />
                                                            {new Date(task.deadline).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                    {task.status !== 'review' && (
                                                        <button onClick={() => handleTaskSubmit(task)} className="px-4 py-2 bg-white/5 hover:bg-green-500/10 hover:text-green-400 border border-white/10 hover:border-green-500/30 text-gray-300 rounded-full text-xs font-bold transition-all flex items-center gap-1.5">
                                                            <Check className="w-3 h-3" /> Done
                                                        </button>
                                                    )}
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </DashboardCard>

                            {/* Platform Updates */}
                            <DashboardCard className="p-6">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                                        <Sparkles className="w-5 h-5 text-purple-400" />
                                    </div>
                                    <h3 className="font-bold text-lg">Platform Updates</h3>
                                </div>
                                <div className="space-y-4">
                                    {NEWS_ITEMS.map((news, i) => (
                                        <div key={i} className="flex gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                                            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
                                                <news.icon className="w-5 h-5 text-purple-400" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-xs font-bold text-purple-400">{news.version}</span>
                                                    <span className="text-xs text-gray-500">{news.date}</span>
                                                </div>
                                                <h4 className="font-semibold text-sm">{news.title}</h4>
                                                <p className="text-xs text-gray-500 mt-0.5">{news.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </DashboardCard>
                        </div>

                        {/* Right Column - Leaderboards */}
                        <div className="xl:col-span-2 space-y-8">
                            {/* Top Contributors */}
                            <DashboardCard className="p-6">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                                        <Award className="w-5 h-5 text-yellow-400" />
                                    </div>
                                    <h3 className="font-bold text-lg">Top Contributors</h3>
                                </div>
                                <div className="space-y-3">
                                    {topUsers.map((u, i) => (
                                        <motion.div
                                            key={u.id}
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.1 }}
                                            onClick={() => router.push(`/profile/${u.id}`)}
                                            className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-purple-500/30 cursor-pointer transition-all"
                                        >
                                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-yellow-500 text-black' : i === 1 ? 'bg-gray-400 text-black' : i === 2 ? 'bg-amber-700 text-white' : 'bg-white/10 text-gray-400'}`}>
                                                {i + 1}
                                            </span>
                                            <img src={u.avatar_url || "/default-avatar.png"} alt={u.username} className="w-9 h-9 rounded-full object-cover border border-white/10" />
                                            <span className="flex-1 font-medium text-sm truncate">{u.username}</span>
                                            <span className="text-xs font-bold text-purple-400">{u.trust_score.toFixed(1)}</span>
                                        </motion.div>
                                    ))}
                                </div>
                            </DashboardCard>

                            {/* Trending Projects */}
                            <DashboardCard className="p-6">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                                        <TrendingUp className="w-5 h-5 text-green-400" />
                                    </div>
                                    <h3 className="font-bold text-lg">Trending Projects</h3>
                                </div>
                                <div className="space-y-3">
                                    {topProjects.map((p, i) => (
                                        <motion.div
                                            key={p.id}
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.1 }}
                                            onClick={() => router.push(`/teams/${p.id}`)}
                                            className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-purple-500/30 cursor-pointer transition-all"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-semibold text-sm truncate">{p.name}</h4>
                                                    <div className="flex gap-1.5 mt-2 flex-wrap">
                                                        {p.needed_skills.slice(0, 2).map((s, idx) => (
                                                            <span key={idx} className="text-[10px] px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded-full">{s}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 text-yellow-400">
                                                    <Star className="w-4 h-4 fill-current" />
                                                    <span className="text-xs font-bold">{p.favorite_count}</span>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </DashboardCard>
                        </div>
                    </div>
                </div>
            </main>

            {/* Email Modal */}
            <AnimatePresence>
                {showEmailModal && emailRecipient && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="w-full max-w-lg bg-[#0D0D12] border border-white/[0.08] rounded-2xl overflow-hidden shadow-[0_0_60px_-15px_rgba(168,85,247,0.3)]"
                        >
                            <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
                                <h3 className="font-bold text-lg flex items-center gap-2"><Mail className="w-5 h-5 text-purple-400" /> New Message</h3>
                                <button onClick={() => setShowEmailModal(false)} className="p-2 hover:bg-white/10 rounded-full transition"><X className="w-5 h-5" /></button>
                            </div>
                            <div className="p-6 space-y-4">
                                <p className="text-sm text-gray-400">To: <span className="text-white font-medium">{emailRecipient.name}</span></p>
                                <input
                                    placeholder="Subject"
                                    value={emailSubject}
                                    onChange={e => setEmailSubject(e.target.value)}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition"
                                />
                                <textarea
                                    placeholder="Write your message..."
                                    rows={5}
                                    value={emailBody}
                                    onChange={e => setEmailBody(e.target.value)}
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition resize-none"
                                />
                                <button onClick={handleSendEmail} className="w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white font-bold py-3.5 rounded-full flex items-center justify-center gap-2 shadow-[0_0_30px_-5px_rgba(168,85,247,0.5)] transition-all">
                                    <Send className="w-4 h-4" /> Send Message
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
            <OnboardingTutorial />
        </div>
    );
}
