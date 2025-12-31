"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import api from "@/lib/api";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import GlobalHeader from "@/components/GlobalHeader";
import {
    Loader2, Search, Filter, X, CheckCircle, Check, 
    UserPlus, Mail, MessageSquare, Clock, Users, Send
} from "lucide-react";

// --- CONSTANTS ---
const PRESET_SKILLS = ["React", "Python", "Node.js", "TypeScript", "Next.js", "Tailwind", "MongoDB", "Firebase", "Flutter", "Java", "C++", "Rust", "Go", "Figma", "UI/UX", "AI/ML", "Docker", "AWS", "Solidity"];

// --- INTERFACES ---
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

function NetworkContent() {
    const router = useRouter();

    // --- STATE ---
    const [activeNetworkTab, setActiveNetworkTab] = useState<'connections' | 'sent' | 'received'>('connections');
    const [networkUsers, setNetworkUsers] = useState<NetworkUser[]>([]); // Connections
    const [receivedRequests, setReceivedRequests] = useState<RequestItem[]>([]);
    const [sentRequests, setSentRequests] = useState<RequestItem[]>([]);
    
    // Search State
    const [searchQuery, setSearchQuery] = useState("");
    const [searchSkill, setSearchSkill] = useState("");
    const [isNetworkLoading, setIsNetworkLoading] = useState(false);
    const [isSearching, setIsSearching] = useState(false); // Mode flag
    const [processingId, setProcessingId] = useState<string | null>(null);

    // Email Modal State
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [emailRecipient, setEmailRecipient] = useState<{ id: string, name: string } | null>(null);
    const [emailSubject, setEmailSubject] = useState("");
    const [emailBody, setEmailBody] = useState("");
    const [sendingEmail, setSendingEmail] = useState(false); // Added missing state from dashboard

    // --- INITIAL FETCH ---
    useEffect(() => {
        const token = Cookies.get("token");
        if (!token) {
            router.push("/");
            return;
        }
        fetchAllNetworkData();
    }, [router]);

    // --- DATA FETCHING ---
    const fetchAllNetworkData = async () => {
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
        } catch(e) {
            console.error("Failed to fetch network data", e);
        }
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
        fetchAllNetworkData();
    }

    // --- ACTIONS ---
    const handleSendConnection = async (targetId: string) => {
        setProcessingId(targetId);
        try {
            await api.post(`/users/connection-request/${targetId}`);
            setNetworkUsers(prev => prev.map(u => u.id === targetId ? { ...u, request_sent: true } : u));
            fetchAllNetworkData(); // Refresh lists
        } catch (e) { alert("Failed to send request."); }
        finally { setProcessingId(null); }
    };

    const handleAcceptRequest = async (requestId: string) => {
        setProcessingId(requestId);
        try {
            await api.post(`/users/requests/${requestId}/accept`);
            fetchAllNetworkData();
        } catch (e) { alert("Failed to accept."); }
        finally { setProcessingId(null); }
    };

    const handleRejectRequest = async (requestId: string) => {
        if(!confirm("Reject connection request?")) return;
        setProcessingId(requestId);
        try {
            await api.post(`/users/requests/${requestId}/reject`);
            fetchAllNetworkData();
        } catch (e) { alert("Failed to reject."); }
        finally { setProcessingId(null); }
    };

    // --- EMAIL LOGIC ---
    const openEmailComposer = (user: NetworkUser | any) => { 
        const name = user.username || user.name || "User";
        const id = user.id || user._id;
        setEmailRecipient({ id, name }); 
        setShowEmailModal(true); 
    }

    const handleSendEmail = async () => { 
        if (!emailRecipient) return; 
        setSendingEmail(true);
        try { 
            await api.post("/communication/send-email", { 
                recipient_id: emailRecipient.id, 
                subject: emailSubject, 
                body: emailBody 
            }); 
            alert("Email sent!"); 
            setShowEmailModal(false); 
            setEmailSubject(""); 
            setEmailBody(""); 
        } catch (err) { 
            alert("Failed to send email."); 
        } finally {
            setSendingEmail(false);
        }
    }

    return (
       <div className="min-h-screen w-full bg-transparent text-zinc-100 font-sans selection:bg-purple-500/30 relative overflow-hidden">
            <div className="max-w-6xl mx-auto p-8 pt-12">
                
                {/* PAGE TITLE */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Users className="w-8 h-8 text-purple-500" /> 
                        Network & Connections
                    </h1>
                    <p className="text-gray-400 mt-2">Find collaborators, manage requests, and build your circle.</p>
                </div>

                {/* --- MAIN NETWORK SECTION --- */}
                <div className="w-full bg-[#0a0a0a] border border-gray-800 rounded-2xl p-6 shadow-2xl">
                    
                    {/* Search & Tabs Container */}
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
                                <button onClick={handleSearchNetwork} className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-xl font-bold text-sm transition flex items-center gap-2">
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
                            <div className="flex gap-2 border-b border-gray-800 pb-1 overflow-x-auto">
                                <button 
                                    onClick={() => setActiveNetworkTab('connections')}
                                    className={`px-4 py-2 text-sm font-bold rounded-t-lg transition whitespace-nowrap ${activeNetworkTab === 'connections' ? 'text-white border-b-2 border-purple-500 bg-gray-900/50' : 'text-gray-500 hover:text-white'}`}
                                >
                                    My Connections ({networkUsers.length})
                                </button>
                                <button 
                                    onClick={() => setActiveNetworkTab('received')}
                                    className={`px-4 py-2 text-sm font-bold rounded-t-lg transition flex items-center gap-2 whitespace-nowrap ${activeNetworkTab === 'received' ? 'text-white border-b-2 border-purple-500 bg-gray-900/50' : 'text-gray-500 hover:text-white'}`}
                                >
                                    Pending Requests 
                                    {receivedRequests.length > 0 && <span className="bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">{receivedRequests.length}</span>}
                                </button>
                                <button 
                                    onClick={() => setActiveNetworkTab('sent')}
                                    className={`px-4 py-2 text-sm font-bold rounded-t-lg transition whitespace-nowrap ${activeNetworkTab === 'sent' ? 'text-white border-b-2 border-purple-500 bg-gray-900/50' : 'text-gray-500 hover:text-white'}`}
                                >
                                    Sent ({sentRequests.length})
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Content Area */}
                    <div className="min-h-[400px]">
                        {/* 1. SEARCH RESULTS MODE */}
                        {isSearching ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {networkUsers.length === 0 ? <p className="text-gray-500 col-span-3 text-center py-12">No users found matching your criteria.</p> : networkUsers.map(u => (
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
                                    networkUsers.length === 0 ? <p className="text-gray-500 text-center py-12 flex flex-col items-center gap-2"><Users className="w-8 h-8 opacity-50"/>You haven't connected with anyone yet.</p> :
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
                                    receivedRequests.length === 0 ? <p className="text-gray-500 text-center py-12">No pending requests.</p> :
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
                                    sentRequests.length === 0 ? <p className="text-gray-500 text-center py-12">No sent requests.</p> :
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
            </div>

            {/* EMAIL MODAL */}
            <AnimatePresence>
                {showEmailModal && emailRecipient && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-gray-900 border border-gray-800 p-8 rounded-2xl w-full max-w-md relative">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold flex items-center gap-2"><Mail className="w-5 h-5" /> Send Secure Message</h2>
                                <button onClick={() => setShowEmailModal(false)}><X className="text-gray-500 hover:text-white" /></button>
                            </div>
                            <div className="space-y-4 mt-4">
                                <div className="bg-gray-800/50 p-3 rounded-lg text-sm text-gray-400">To: <span className="text-white font-bold">{emailRecipient.name}</span> (Email Hidden)</div>
                                <input className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 outline-none focus:border-green-500 text-white" placeholder="Subject" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} />
                                <textarea className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 h-32 outline-none focus:border-green-500 resize-none text-white" placeholder="Message" value={emailBody} onChange={e => setEmailBody(e.target.value)} />
                                <button onClick={handleSendEmail} disabled={sendingEmail} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2">
                                    {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4" />}
                                    Send Message
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default function NetworkPage() {
    return (
        <Suspense fallback={<div className="h-screen bg-gray-950 flex items-center justify-center text-white"><Loader2 className="animate-spin" /></div>}>
            <NetworkContent />
        </Suspense>
    );
}