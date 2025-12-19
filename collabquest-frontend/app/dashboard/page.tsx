"use client";
import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Cookies from "js-cookie";
import api from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
    ShieldCheck, Loader2, Edit2, X, Plus,
    MessageSquare, UserCheck, Bell, CheckCircle,
    Briefcase, UserPlus, Send, Code2, Mail, Clock, Search, XCircle, RotateCcw, Check, Trash2
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
    name: string;
    description: string;
    members: string[];
}

export default function Dashboard() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [user, setUser] = useState<UserProfile | null>(null);

    const [projectOpportunities, setProjectOpportunities] = useState<Match[]>([]);
    const [myProjects, setMyProjects] = useState<Team[]>([]);

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
        }

        // Sync with Header Actions (if action taken in Header)
        const handleSync = () => {
            if (activeToken) {
                fetchMatches(activeToken);
                fetchMyProjects(activeToken);
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
    }
    const fetchMyProjects = async (jwt: string) => {
        try { const res = await api.get("/teams/"); const uid = (await api.get("/users/me")).data._id; setMyProjects(res.data.filter((t: any) => t.members[0] === uid)); } catch (e) { }
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
            setTimeout(() => { fetchMatches(token!); fetchMyProjects(token!); }, 500);
        } catch (err) { alert("Action failed"); fetchMatches(token!); }
        finally { setProcessingId(null); }
    }

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
        <div className="min-h-screen bg-gray-950 text-white relative">
            <GlobalHeader />

            <div className="max-w-6xl mx-auto p-8 pt-12">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
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

                <div className="w-full">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-purple-300"><Briefcase className="w-5 h-5" /> My Applications</h3>
                    {projectOpportunities.length === 0 ? <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8 text-center text-gray-500"><p>No active applications.</p><Link href="/matches?type=projects" className="text-purple-400 hover:underline text-sm">Find Projects</Link></div> : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {projectOpportunities.map((m) => (
                                <div key={m.id + m.project_id} className="bg-gray-900 border border-gray-800 p-4 rounded-xl">
                                    <div className="flex items-center gap-3 mb-3"><div className="w-8 h-8 bg-purple-900/50 rounded-full flex items-center justify-center border border-purple-500/30"><Code2 className="w-4 h-4 text-purple-400" /></div><div><h4 className="font-bold text-sm">{m.project_name}</h4><p className="text-xs text-gray-400">Leader: {m.name}</p></div></div>
                                    <div className="flex gap-2">
                                        {renderMatchButton(m)}
                                        <button onClick={() => openEmailComposer(m)} className="bg-gray-800 p-1.5 rounded hover:text-green-400" title="Email"><Mail className="w-4 h-4" /></button>
                                        {/* NEW CHAT BUTTON */}
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