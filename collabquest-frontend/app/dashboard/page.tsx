"use client";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Cookies from "js-cookie";
import api from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
    ShieldCheck, Loader2, Edit2, X, Plus,
    MessageSquare, UserCheck, Bell, CheckCircle,
    Briefcase, UserPlus, Send, Code2, Mail, Clock, Search, XCircle, RotateCcw, Check, Trash2,
    Calendar, ArrowRight, Layout, Award, Star, Users, Filter, ExternalLink, UserMinus
} from "lucide-react";
import Link from "next/link";
import GlobalHeader from "@/components/GlobalHeader";

const PRESET_SKILLS = ["React", "Python", "Node.js", "TypeScript", "Next.js", "Tailwind", "MongoDB", "Firebase", "Flutter", "Java", "C++", "Rust", "Go", "Figma", "UI/UX", "AI/ML", "Docker", "AWS", "Solidity"];

// ... [Keep existing Interfaces] ...
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

// --- NETWORK INTERFACES ---
interface NetworkUser {
    id: string;
    username: string;
    full_name?: string;
    avatar_url: string;
    skills: { name: string; level: string }[];
    is_connected: boolean;
    request_sent?: boolean;
}

interface RequestItem {
    request_id: string;
    user: any; // Raw user object from backend
    created_at: string;
}

export default function Dashboard() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [user, setUser] = useState<UserProfile | null>(null);

    const [projectOpportunities, setProjectOpportunities] = useState<Match[]>([]);
    const [myProjects, setMyProjects] = useState<Team[]>([]);
    
    const [activeTasks, setActiveTasks] = useState<TaskItem[]>([]);
    const [historyTasks, setHistoryTasks] = useState<TaskItem[]>([]);
    const [completedProjects, setCompletedProjects] = useState<Team[]>([]);
    const [favorites, setFavorites] = useState<Team[]>([]);
    const [tasksLoading, setTasksLoading] = useState(true);

    // --- NETWORK STATE ---
    const [activeNetworkTab, setActiveNetworkTab] = useState<'connections' | 'sent' | 'received'>('connections');
    const [networkUsers, setNetworkUsers] = useState<NetworkUser[]>([]); // Connections
    const [receivedRequests, setReceivedRequests] = useState<RequestItem[]>([]);
    const [sentRequests, setSentRequests] = useState<RequestItem[]>([]);
    
    // Search State (Combined with Network)
    const [searchQuery, setSearchQuery] = useState("");
    const [searchSkill, setSearchSkill] = useState("");
    const [isNetworkLoading, setIsNetworkLoading] = useState(false);
    const [isSearching, setIsSearching] = useState(false); // Mode flag

    const [processingId, setProcessingId] = useState<string | null>(null);
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [emailRecipient, setEmailRecipient] = useState<{ id: string, name: string } | null>(null);
    const [emailSubject, setEmailSubject] = useState("");
    const [emailBody, setEmailBody] = useState("");

    useEffect(() => {
        const urlToken = searchParams.get("token");
        let activeToken = urlToken;
        if (urlToken) { Cookies.set("token", urlToken, { expires: 7 }); router.replace("/dashboard"); }
        else { activeToken = Cookies.get("token") || null; if (!activeToken) { router.push("/"); return; } }
        if (activeToken) {
            fetchUserProfile(activeToken);
            fetchMatches(activeToken);
            fetchMyProjects(activeToken);
            fetchDashboardData(activeToken);
            fetchAllNetworkData(activeToken);
        }

        const handleSync = () => {
            if (activeToken) {
                fetchMatches(activeToken);
                fetchMyProjects(activeToken);
                fetchDashboardData(activeToken);
                fetchAllNetworkData(activeToken);
            }
        };
        window.addEventListener("dashboardUpdate", handleSync);
        return () => window.removeEventListener("dashboardUpdate", handleSync);
    }, [searchParams, router]);

    const fetchUserProfile = async (jwt: string) => { try { const response = await api.get("/users/me"); setUser(response.data); } catch (error) { Cookies.remove("token"); router.push("/"); } };
    const fetchMatches = async (jwt: string) => { try { const res = await api.get("/matches/mine"); setProjectOpportunities(res.data.filter((m: any) => m.role === "Team Leader").reverse()); } catch (e) { } }
    const fetchMyProjects = async (jwt: string) => { try { const res = await api.get("/teams/"); const uid = (await api.get("/users/me")).data._id; setMyProjects(res.data.filter((t: any) => t.members[0] === uid)); } catch (e) { } }
    const fetchDashboardData = async (jwt: string) => {
        try {
            const taskRes = await api.get("/users/me/tasks");
            setActiveTasks(taskRes.data.active);
            setHistoryTasks(taskRes.data.history);
            const projRes = await api.get("/users/me/projects");
            setCompletedProjects(projRes.data.filter((t: Team) => t.status === "completed"));
            const favRes = await api.get("/users/me/favorites_details");
            setFavorites(favRes.data);
        } catch (e) { console.error(e); } finally { setTasksLoading(false); }
    };

    // --- NETWORK FETCHERS ---
    const fetchAllNetworkData = async (jwt: string) => {
        try {
            const [netRes, recRes, sentRes] = await Promise.all([
                api.get("/users/network"),
                api.get("/users/requests/received"),
                api.get("/users/requests/sent")
            ]);
            
            setNetworkUsers(netRes.data.map((u: any) => ({
                id: u._id || u.id,
                username: u.username,
                full_name: u.full_name,
                avatar_url: u.avatar_url,
                skills: u.skills,
                is_connected: true
            })));
            setReceivedRequests(recRes.data);
            setSentRequests(sentRes.data);
        } catch(e) {}
    };

    const handleSearchNetwork = async () => {
        setIsNetworkLoading(true);
        setIsSearching(true); // Enter search mode
        try {
            const params = new URLSearchParams();
            if (searchQuery) params.append("query", searchQuery);
            if (searchSkill) params.append("skill", searchSkill);
            
            const res = await api.get(`/users/search?${params.toString()}`);
            setNetworkUsers(res.data);
        } catch(e) { console.error(e); } 
        finally { setIsNetworkLoading(false); }
    };

    const clearSearch = () => {
        setIsSearching(false);
        setSearchQuery("");
        setSearchSkill("");
        fetchAllNetworkData(Cookies.get("token")!);
    }

    // --- NETWORK ACTIONS ---
    const handleSendConnection = async (targetId: string) => {
        setProcessingId(targetId);
        try {
            await api.post(`/users/connection-request/${targetId}`);
            setNetworkUsers(prev => prev.map(u => u.id === targetId ? { ...u, request_sent: true } : u));
            fetchAllNetworkData(Cookies.get("token")!); // Refresh lists
        } catch (e) { alert("Failed to send request."); }
        finally { setProcessingId(null); }
    };

    const handleAcceptRequest = async (requestId: string) => {
        setProcessingId(requestId);
        try {
            await api.post(`/users/requests/${requestId}/accept`);
            fetchAllNetworkData(Cookies.get("token")!);
        } catch (e) { alert("Failed to accept."); }
        finally { setProcessingId(null); }
    };

    const handleRejectRequest = async (requestId: string) => {
        if(!confirm("Reject connection request?")) return;
        setProcessingId(requestId);
        try {
            await api.post(`/users/requests/${requestId}/reject`);
            fetchAllNetworkData(Cookies.get("token")!);
        } catch (e) { alert("Failed to reject."); }
        finally { setProcessingId(null); }
    };

    // ... [Keep existing action handlers] ...
    const handleReapply = async (match: Match) => { const token = Cookies.get("token"); setProcessingId(match.id + match.project_id); try { setProjectOpportunities(prev => prev.map(m => m.id === match.id && m.project_id === match.project_id ? { ...m, status: "matched" as const } : m)); await api.post(`/teams/${match.project_id}/reset`, { target_user_id: match.id }); alert("Status reset! You can now apply/invite again."); fetchMatches(token!); } catch (err) { alert("Action failed"); } finally { setProcessingId(null); } }
    const handleDeleteMatch = async (match: Match) => { if (!confirm("Remove this project? This will 'unlike' it and remove it from your list.")) return; const token = Cookies.get("token"); const myId = user?._id || user?.id || ""; try { setProjectOpportunities(prev => prev.filter(p => p.project_id !== match.project_id)); await api.delete(`/matches/delete/${match.project_id}/${myId}`); } catch (e) { alert("Failed"); fetchMatches(token!); } }
    const handleReject = async (match: Match) => { if (!confirm("Are you sure you want to reject this request?")) return; const token = Cookies.get("token"); const myId = user?._id || user?.id || ""; try { setProjectOpportunities(prev => prev.map(m => m.id === match.id && m.project_id === match.project_id ? { ...m, status: "rejected" as const, rejected_by: myId } : m)); await api.post(`/teams/${match.project_id}/reject`, { target_user_id: match.id }); window.dispatchEvent(new Event("triggerNotificationRefresh")); } catch (err) { alert("Action failed"); } }
    const requestJoin = async (match: Match) => { const token = Cookies.get("token"); setProcessingId(match.id + match.project_id); try { setProjectOpportunities(prev => prev.map(m => m.id === match.id && m.project_id === match.project_id ? { ...m, status: "requested" as const } : m)); await api.post(`/teams/${match.project_id}/invite`, { target_user_id: "LEADER" }); setTimeout(() => fetchMatches(token!), 500); } catch (err: any) { alert("Failed"); fetchMatches(token!); } finally { setProcessingId(null); } }
    const handleConnectionAction = async (match: Match) => { const token = Cookies.get("token"); setProcessingId(match.id + match.project_id); try { let target = ""; if (match.role === "Team Leader") target = await getCurrentUserId(token!); setProjectOpportunities(prev => prev.map(m => m.id === match.id && m.project_id === match.project_id ? { ...m, status: "joined" as const } : m)); await api.post(`/teams/${match.project_id}/members`, { target_user_id: target }); window.dispatchEvent(new Event("triggerNotificationRefresh")); alert("Success!"); setTimeout(() => { fetchMatches(token!); fetchMyProjects(token!); }, 500); } catch (err) { alert("Action failed"); fetchMatches(token!); } finally { setProcessingId(null); } }
    const handleTaskSubmit = async (task: TaskItem) => { if(!confirm("Mark this task as done and submit for review?")) return; const token = Cookies.get("token"); try { setActiveTasks(prev => prev.filter(t => t.id !== task.id)); await api.post(`/teams/${task.project_id}/tasks/${task.id}/submit`); fetchDashboardData(token!); } catch(e) { alert("Failed to submit task"); } };
    const openEmailComposer = (match: Match | NetworkUser | any) => { 
        const name = match.username || match.name || "User";
        const id = match.id || match._id;
        setEmailRecipient({ id, name }); 
        setShowEmailModal(true); 
    }
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
        <div className="min-h-screen bg-gray-950 text-white relative">
            <GlobalHeader />

            <div className="max-w-6xl mx-auto p-8 pt-12">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                    {/* ... [Welcome and Create Project Cards] ... */}
                    <Link href="/profile">
                        <motion.div whileHover={{ scale: 1.02 }} className="p-6 rounded-2xl bg-gray-900 border border-gray-800 shadow-xl flex items-center gap-4 cursor-pointer group hover:border-purple-500/50 transition-all relative">
                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"><Edit2 className="w-4 h-4 text-purple-400" /></div>
                            <img src={user.avatar_url} alt="Avatar" className="w-16 h-16 rounded-full border-2 border-purple-500" />
                            <div><h2 className="text-xl font-semibold">Welcome, {user.username}!</h2><div className="flex flex-wrap gap-2 mt-2">{user.skills.length > 0 ? user.skills.slice(0, 3).map((s, i) => <span key={i} className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-300 border border-gray-700">{s.name}</span>) : <span className="text-xs text-yellow-500 italic">Tap to add skills +</span>}</div></div>
                        </motion.div>
                    </Link>
                    <motion.div whileHover={{ scale: 1.02 }} className="p-6 rounded-2xl bg-gradient-to-br from-purple-900/50 to-blue-900/50 border border-purple-500/20 flex flex-col justify-center items-start">
                        <h2 className="text-xl font-semibold mb-2">Build Your Dream Team</h2>
                        <p className="text-sm text-gray-400 mb-4">Post an idea and find hackers instantly.</p>
                        <Link href="/find-team"><button className="w-full px-6 py-2 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition shadow-lg flex items-center gap-2"><Plus className="w-4 h-4" /> Create Project</button></Link>
                    </motion.div>
                </div>
                
                {/* --- MY NETWORK SECTION --- */}
                <div className="w-full mb-12 bg-[#0a0a0a] border border-gray-800 rounded-2xl p-6">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-blue-300">
                        <Users className="w-5 h-5" /> My Network & Connections
                    </h3>
                    
                    {/* Search & Tabs */}
                    <div className="flex flex-col gap-6 mb-6">
                        {/* Search Area */}
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
                                <input 
                                    className="w-full bg-gray-900 border border-gray-800 rounded-xl py-3 pl-10 pr-4 outline-none focus:border-purple-500 transition text-sm text-white"
                                    placeholder="Search users to connect with..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearchNetwork()}
                                />
                            </div>
                            <div className="relative md:w-1/4">
                                <Filter className="absolute left-3 top-3 w-5 h-5 text-gray-500" />
                                <select
                                    className="w-full bg-gray-900 border border-gray-800 rounded-xl py-3 pl-10 pr-4 outline-none focus:border-purple-500 transition text-sm appearance-none text-gray-300"
                                    value={searchSkill}
                                    onChange={(e) => setSearchSkill(e.target.value)}
                                >
                                    <option value="">All Skills</option>
                                    {PRESET_SKILLS.map(skill => <option key={skill} value={skill}>{skill}</option>)}
                                </select>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={handleSearchNetwork} className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-xl font-bold text-sm transition">
                                    {isNetworkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
                                </button>
                                {isSearching && (
                                    <button onClick={clearSearch} className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-xl" title="Clear Search">
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Network Tabs (Only show if not searching) */}
                        {!isSearching && (
                            <div className="flex gap-2 border-b border-gray-800 pb-1">
                                <button 
                                    onClick={() => setActiveNetworkTab('connections')}
                                    className={`px-4 py-2 text-sm font-bold rounded-t-lg transition ${activeNetworkTab === 'connections' ? 'text-white border-b-2 border-purple-500 bg-gray-900/50' : 'text-gray-500 hover:text-white'}`}
                                >
                                    My Connections ({networkUsers.length})
                                </button>
                                <button 
                                    onClick={() => setActiveNetworkTab('received')}
                                    className={`px-4 py-2 text-sm font-bold rounded-t-lg transition flex items-center gap-2 ${activeNetworkTab === 'received' ? 'text-white border-b-2 border-purple-500 bg-gray-900/50' : 'text-gray-500 hover:text-white'}`}
                                >
                                    Pending Requests 
                                    {receivedRequests.length > 0 && <span className="bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">{receivedRequests.length}</span>}
                                </button>
                                <button 
                                    onClick={() => setActiveNetworkTab('sent')}
                                    className={`px-4 py-2 text-sm font-bold rounded-t-lg transition ${activeNetworkTab === 'sent' ? 'text-white border-b-2 border-purple-500 bg-gray-900/50' : 'text-gray-500 hover:text-white'}`}
                                >
                                    Sent ({sentRequests.length})
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Content Area */}
                    <div className="min-h-[200px]">
                        {/* 1. SEARCH RESULTS MODE */}
                        {isSearching ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {networkUsers.length === 0 ? <p className="text-gray-500 col-span-3 text-center">No users found.</p> : networkUsers.map(u => (
                                    <div key={u.id} className="bg-gray-900 border border-gray-800 p-4 rounded-xl flex items-center gap-4">
                                        <Link href={`/profile/${u.id}`} target="_blank"><img src={u.avatar_url || "https://github.com/shadcn.png"} className="w-12 h-12 rounded-full border border-gray-800 hover:opacity-80 transition" /></Link>
                                        <div className="flex-1 min-w-0">
                                            <Link href={`/profile/${u.id}`} target="_blank" className="hover:underline"><h4 className="font-bold text-white text-sm truncate">{u.username}</h4></Link>
                                            <p className="text-xs text-gray-500">{u.full_name || "Developer"}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            {u.is_connected ? <span className="text-green-500 text-xs flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Connected</span> : (
                                                <button onClick={() => handleSendConnection(u.id)} disabled={u.request_sent || processingId === u.id} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${u.request_sent ? 'bg-gray-800 text-gray-500' : 'bg-purple-600 hover:bg-purple-500 text-white'}`}>
                                                    {processingId === u.id ? <Loader2 className="w-3 h-3 animate-spin"/> : u.request_sent ? <Check className="w-3 h-3" /> : <UserPlus className="w-3 h-3" />}
                                                    {u.request_sent ? "Sent" : "Connect"}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            // 2. TABBED MODE
                            <>
                                {activeNetworkTab === 'connections' && (
                                    networkUsers.length === 0 ? <p className="text-gray-500 text-center py-8">No connections yet.</p> :
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {networkUsers.map((u) => (
                                            <div key={u.id} className="bg-gray-900 border border-gray-800 p-4 rounded-xl flex items-center gap-4 hover:border-gray-700 transition group">
                                                <Link href={`/profile/${u.id}`} target="_blank"><img src={u.avatar_url || "https://github.com/shadcn.png"} className="w-12 h-12 rounded-full border border-gray-800" /></Link>
                                                <div className="flex-1 min-w-0">
                                                    <Link href={`/profile/${u.id}`} target="_blank" className="hover:text-purple-400 font-bold text-white text-sm truncate block">{u.username}</Link>
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {u.skills.slice(0, 2).map((s, i) => <span key={i} className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{s.name}</span>)}
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={() => openEmailComposer(u)} className="bg-gray-800 p-2 rounded hover:text-green-400 transition" title="Email"><Mail className="w-4 h-4" /></button>
                                                    <Link href={`/chat?targetId=${u.id}`}>
                                                        <button className="bg-gray-800 p-2 rounded hover:text-blue-400 transition" title="Chat"><MessageSquare className="w-4 h-4" /></button>
                                                    </Link>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {activeNetworkTab === 'received' && (
                                    receivedRequests.length === 0 ? <p className="text-gray-500 text-center py-8">No pending requests.</p> :
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {receivedRequests.map((req) => (
                                            <div key={req.request_id} className="bg-gray-900 border border-yellow-900/30 p-4 rounded-xl flex items-center justify-between gap-4">
                                                <div className="flex items-center gap-3">
                                                    <Link href={`/profile/${req.user._id}`} target="_blank"><img src={req.user.avatar_url} className="w-10 h-10 rounded-full" /></Link>
                                                    <div>
                                                        <Link href={`/profile/${req.user._id}`} target="_blank" className="font-bold text-sm hover:underline">{req.user.username}</Link>
                                                        <p className="text-xs text-gray-500">Wants to connect</p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleAcceptRequest(req.request_id)} disabled={processingId === req.request_id} className="bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1">{processingId === req.request_id ? <Loader2 className="w-3 h-3 animate-spin"/> : <Check className="w-3 h-3"/>} Accept</button>
                                                    <button onClick={() => handleRejectRequest(req.request_id)} disabled={processingId === req.request_id} className="bg-gray-800 hover:text-red-400 text-gray-400 px-3 py-1.5 rounded-lg text-xs font-bold"><X className="w-3 h-3"/></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {activeNetworkTab === 'sent' && (
                                    sentRequests.length === 0 ? <p className="text-gray-500 text-center py-8">No sent requests.</p> :
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {sentRequests.map((req) => (
                                            <div key={req.request_id} className="bg-gray-900 border border-gray-800 p-4 rounded-xl flex items-center justify-between gap-4 opacity-75">
                                                <div className="flex items-center gap-3">
                                                    <Link href={`/profile/${req.user._id}`} target="_blank"><img src={req.user.avatar_url} className="w-10 h-10 rounded-full grayscale" /></Link>
                                                    <div>
                                                        <Link href={`/profile/${req.user._id}`} target="_blank" className="font-bold text-sm hover:underline">{req.user.username}</Link>
                                                        <p className="text-xs text-gray-500">Request pending...</p>
                                                    </div>
                                                </div>
                                                <span className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-400 flex items-center gap-1"><Clock className="w-3 h-3"/> Sent</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* ... [Keep Active Tasks, Applications, Favorites, Completed, History] ... */}
                {/* ACTIVE TASKS SECTION */}
                <div className="w-full mb-12">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-green-400">
                        <CheckCircle className="w-5 h-5" /> Active Tasks
                    </h3>
                    {tasksLoading ? <div className="text-gray-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin"/> Loading tasks...</div> : 
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
                    {projectOpportunities.length === 0 ? <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8 text-center text-gray-500"><p>No active applications.</p><Link href="/matches?type=projects" className="text-purple-400 hover:underline text-sm">Find Projects</Link></div> : (
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
                 {favorites.length > 0 && (
                    <div className="w-full mb-12">
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-yellow-500">
                            <Star className="w-5 h-5 fill-yellow-500" /> Favorited Projects
                        </h3>
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
                    </div>
                )}
                
                {/* COMPLETED PROJECTS SECTION */}
                {completedProjects.length > 0 && (
                    <div className="w-full mb-12">
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-blue-400">
                            <Award className="w-5 h-5" /> Completed Projects
                        </h3>
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
                    </div>
                )}
                
                {/* TASK HISTORY SECTION */}
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