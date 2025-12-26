"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import api from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
    Loader2, Code2, Mail, MessageSquare, Trash2,
    CheckCircle, XCircle, RotateCcw, Send, Clock, Award, Briefcase, X
} from "lucide-react";
import Link from "next/link";
import GlobalHeader from "@/components/GlobalHeader";

// --- INTERFACES ---
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

export default function MyProjectsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [currentUserId, setCurrentUserId] = useState<string>("");
    
    // Data State
    const [applications, setApplications] = useState<Match[]>([]);
    const [completedProjects, setCompletedProjects] = useState<Team[]>([]);
    
    // UI State
    const [activeTab, setActiveTab] = useState<"applications" | "completed">("applications");
    const [processingId, setProcessingId] = useState<string | null>(null);

    // Email Modal State
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [emailRecipient, setEmailRecipient] = useState<{ id: string, name: string } | null>(null);
    const [emailSubject, setEmailSubject] = useState("");
    const [emailBody, setEmailBody] = useState("");

    useEffect(() => {
        const token = Cookies.get("token");
        if (!token) {
            router.push("/login");
            return;
        }
        fetchData(token);
    }, []);

    const fetchData = async (token: string) => {
        try {
            // 1. Get User ID (needed for logic)
            const userRes = await api.get("/users/me");
            setCurrentUserId(userRes.data._id || userRes.data.id);

            // 2. Get Matches (Applications)
            const matchRes = await api.get("/matches/mine");
            setApplications(matchRes.data.filter((m: any) => m.role === "Team Leader").reverse());

            // 3. Get Completed Projects
            const projRes = await api.get("/users/me/projects");
            setCompletedProjects(projRes.data.filter((t: Team) => t.status === "completed"));

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // --- ACTION HANDLERS ---

    const handleReapply = async (match: Match) => {
        setProcessingId(match.id + match.project_id);
        try {
            setApplications(prev => prev.map(m => m.id === match.id && m.project_id === match.project_id ? { ...m, status: "matched" as const } : m));
            await api.post(`/teams/${match.project_id}/reset`, { target_user_id: match.id });
            const token = Cookies.get("token");
            fetchData(token!);
        } catch (err) { alert("Action failed"); }
        finally { setProcessingId(null); }
    }

    const handleDeleteMatch = async (match: Match) => {
        if (!confirm("Remove this project application?")) return;
        const token = Cookies.get("token");
        try {
            setApplications(prev => prev.filter(p => p.project_id !== match.project_id));
            await api.delete(`/matches/delete/${match.project_id}/${currentUserId}`);
        } catch (e) { alert("Failed"); fetchData(token!); }
    }

    const handleReject = async (match: Match) => {
        if (!confirm("Reject this request?")) return;
        try {
            setApplications(prev => prev.map(m => m.id === match.id && m.project_id === match.project_id ? { ...m, status: "rejected" as const, rejected_by: currentUserId } : m));
            await api.post(`/teams/${match.project_id}/reject`, { target_user_id: match.id });
        } catch (err) { alert("Action failed"); }
    }

    const requestJoin = async (match: Match) => {
        setProcessingId(match.id + match.project_id);
        try {
            setApplications(prev => prev.map(m => m.id === match.id && m.project_id === match.project_id ? { ...m, status: "requested" as const } : m));
            await api.post(`/teams/${match.project_id}/invite`, { target_user_id: "LEADER" });
        } catch (err: any) { alert("Failed"); }
        finally { setProcessingId(null); }
    }

    const handleConnectionAction = async (match: Match) => {
        setProcessingId(match.id + match.project_id);
        const token = Cookies.get("token");
        try {
            setApplications(prev => prev.map(m => m.id === match.id && m.project_id === match.project_id ? { ...m, status: "joined" as const } : m));
            await api.post(`/teams/${match.project_id}/members`, { target_user_id: currentUserId });
            alert("Success! You joined the team.");
            fetchData(token!); // Refresh to move possibly to active projects
        } catch (err) { alert("Action failed"); }
        finally { setProcessingId(null); }
    }

    // Email Logic
    const openEmailComposer = (match: Match) => { setEmailRecipient({ id: match.id, name: match.name }); setShowEmailModal(true); }
    const handleSendEmail = async () => { if (!emailRecipient) return; try { await api.post("/communication/send-email", { recipient_id: emailRecipient.id, subject: emailSubject, body: emailBody }); alert("Email sent!"); setShowEmailModal(false); setEmailSubject(""); setEmailBody(""); } catch (err) { alert("Failed"); } }


    // --- RENDER HELPERS ---
    const renderMatchButton = (match: Match) => {
        const isProcessing = processingId === (match.id + match.project_id);
        
        if (match.status === "rejected") {
            const isMe = match.rejected_by === currentUserId;
            return (
                <div className="flex-1 flex gap-1">
                    <div className="flex-1 bg-red-900/20 text-red-400 border border-red-900/50 py-1.5 rounded text-xs font-bold text-center flex items-center justify-center gap-1">
                        <XCircle className="w-3 h-3" /> {isMe ? "Rejected by You" : "Rejected by Team"}
                    </div>
                    <button onClick={() => handleReapply(match)} disabled={isProcessing} className="bg-gray-700 hover:bg-gray-600 px-2 rounded text-white">
                        {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                    </button>
                </div>
            );
        }

        if (match.status === "matched") return <button onClick={() => requestJoin(match)} disabled={isProcessing} className="flex-1 bg-purple-600 hover:bg-purple-500 text-white py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1">{isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Send className="w-3 h-3" /> Request Join</>}</button>;
        if (match.status === "requested") return <div className="flex-1 bg-gray-700 text-gray-400 py-1.5 rounded text-xs flex items-center justify-center gap-1"><Clock className="w-3 h-3" /> Pending</div>;
        if (match.status === "invited") return <div className="flex gap-1 flex-1"><button onClick={() => handleConnectionAction(match)} disabled={isProcessing} className="flex-1 bg-green-600 hover:bg-green-500 text-white py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1">{isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <><CheckCircle className="w-3 h-3" /> Join Team</>}</button><button onClick={() => handleReject(match)} className="bg-red-600 hover:bg-red-500 text-white px-2 rounded"><XCircle className="w-3 h-3" /></button></div>;
        if (match.status === "joined") return <div className="flex-1 bg-gray-800 text-green-400 border border-green-900 py-1.5 rounded text-xs font-bold text-center">Joined</div>;

        return <div className="flex-1 text-gray-500 text-xs text-center py-1 bg-gray-900/50 rounded">Status: {match.status}</div>;
    };

    if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white"><Loader2 className="animate-spin w-8 h-8 text-purple-500" /></div>;

    return (
        <div className="min-h-screen w-full bg-transparent text-zinc-100 font-sans selection:bg-purple-500/30 relative overflow-hidden">

            <div className="max-w-6xl mx-auto p-8 pt-12">
                <div className="flex flex-col md:flex-row justify-between items-end mb-8 border-b border-gray-800 pb-4">
                    <div>
                        <h1 className="text-3xl font-black bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent">My Projects</h1>
                        <p className="text-gray-400 mt-1">Manage your applications and view past achievements.</p>
                    </div>
                    
                    {/* Tab Switcher */}
                    <div className="flex bg-gray-900 p-1 rounded-lg mt-4 md:mt-0">
                        <button 
                            onClick={() => setActiveTab("applications")}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === "applications" ? "bg-purple-600 text-white shadow-lg" : "text-gray-400 hover:text-white"}`}
                        >
                            Applications ({applications.length})
                        </button>
                        <button 
                            onClick={() => setActiveTab("completed")}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === "completed" ? "bg-blue-600 text-white shadow-lg" : "text-gray-400 hover:text-white"}`}
                        >
                            Completed ({completedProjects.length})
                        </button>
                    </div>
                </div>

                {/* CONTENT AREA */}
                
                {/* 1. APPLICATIONS TAB */}
                {activeTab === "applications" && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                        <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-purple-300"><Briefcase className="w-5 h-5" /> Active Applications</h3>
                        
                        {applications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 bg-gray-900/30 border border-gray-800 rounded-2xl text-center">
                                <div className="bg-gray-800 p-4 rounded-full mb-4"><Code2 className="w-8 h-8 text-gray-500" /></div>
                                <h3 className="text-lg font-semibold text-white">No active applications</h3>
                                <p className="text-gray-500 mb-6 max-w-sm">You haven't applied to any projects yet. Start looking for teams to join!</p>
                                <Link href="/find-team" className="bg-white text-black px-6 py-2 rounded-lg font-bold hover:bg-gray-200 transition">Find Projects</Link>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                {applications.map((m) => (
                                    <div key={m.id + m.project_id} className="bg-gray-900 border border-gray-800 p-5 rounded-xl hover:border-gray-700 transition shadow-lg">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-10 h-10 bg-purple-900/30 rounded-full flex items-center justify-center border border-purple-500/30 shrink-0">
                                                <Code2 className="w-5 h-5 text-purple-400" />
                                            </div>
                                            <div className="overflow-hidden">
                                                <h4 className="font-bold text-white truncate" title={m.project_name}>{m.project_name}</h4>
                                                <p className="text-xs text-gray-400 truncate">Leader: {m.name}</p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex flex-col gap-3">
                                            <div className="flex gap-2 w-full">
                                                {renderMatchButton(m)}
                                            </div>
                                            <div className="flex gap-2 w-full">
                                                <button onClick={() => openEmailComposer(m)} className="flex-1 bg-gray-800 py-1.5 rounded text-xs hover:bg-gray-700 hover:text-green-400 transition flex items-center justify-center gap-1 border border-white/5">
                                                    <Mail className="w-3 h-3" /> Email
                                                </button>
                                                <Link href={`/chat?targetId=${m.id}`} className="flex-1">
                                                    <button className="w-full bg-gray-800 py-1.5 rounded text-xs hover:bg-gray-700 hover:text-blue-400 transition flex items-center justify-center gap-1 border border-white/5">
                                                        <MessageSquare className="w-3 h-3" /> Chat
                                                    </button>
                                                </Link>
                                                <button onClick={() => handleDeleteMatch(m)} className="bg-gray-800 px-3 rounded hover:bg-red-900/30 hover:text-red-400 border border-white/5 transition" title="Remove Application">
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}

                {/* 2. COMPLETED TAB */}
                {activeTab === "completed" && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                         <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-blue-400"><Award className="w-5 h-5" /> Completed Projects</h3>
                         
                         {completedProjects.length === 0 ? (
                             <div className="flex flex-col items-center justify-center py-16 bg-gray-900/30 border border-gray-800 rounded-2xl text-center">
                                 <div className="bg-gray-800 p-4 rounded-full mb-4"><Award className="w-8 h-8 text-gray-500" /></div>
                                 <h3 className="text-lg font-semibold text-white">No completed projects yet</h3>
                                 <p className="text-gray-500 mb-6 max-w-sm">Finish tasks and projects to build your portfolio history here.</p>
                             </div>
                         ) : (
                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                {completedProjects.map(team => (
                                    <Link href={`/teams/${team._id || team.id}`} key={team._id || team.id}>
                                        <div className="h-full bg-gradient-to-br from-gray-900 to-black border border-blue-500/30 p-6 rounded-xl hover:scale-[1.02] transition cursor-pointer group">
                                            <div className="flex justify-between items-start mb-4">
                                                <h4 className="font-bold text-white text-lg truncate w-3/4 group-hover:text-blue-400 transition">{team.name}</h4>
                                                <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-1 rounded font-black uppercase tracking-wider border border-blue-500/20">DONE</span>
                                            </div>
                                            <p className="text-sm text-gray-500 line-clamp-3 leading-relaxed">{team.description}</p>
                                            <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-gray-400">
                                                <span>{team.members.length} Members</span>
                                                <span className="flex items-center gap-1 group-hover:translate-x-1 transition"><ArrowRightIcon /> View Details</span>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                             </div>
                         )}
                    </motion.div>
                )}

            </div>

            {/* Email Modal */}
            <AnimatePresence>
                {showEmailModal && emailRecipient && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-gray-900 border border-gray-800 p-8 rounded-2xl w-full max-w-md relative shadow-2xl">
                            <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold flex items-center gap-2"><Mail className="w-5 h-5" /> Send Secure Message</h2><button onClick={() => setShowEmailModal(false)}><X className="text-gray-500 hover:text-white" /></button></div>
                            <div className="space-y-4 mt-4"><div className="bg-gray-800/50 p-3 rounded-lg text-sm text-gray-400">To: <span className="text-white font-bold">{emailRecipient.name}</span> (Email Hidden)</div><input className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 outline-none focus:border-green-500 transition" placeholder="Subject" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} /><textarea className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 h-32 outline-none focus:border-green-500 resize-none transition" placeholder="Message" value={emailBody} onChange={e => setEmailBody(e.target.value)} /><button onClick={handleSendEmail} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition shadow-lg shadow-green-900/20"><Send className="w-4 h-4" /> Send Message</button></div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

// Simple Helper Icon
const ArrowRightIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
)