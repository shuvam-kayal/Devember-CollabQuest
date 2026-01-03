"use client";
import { useEffect, useState, useRef } from "react";
import Cookies from "js-cookie";
import api from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
    ShieldCheck, Bell, MessageSquare, Check, X, Loader2,
    User as UserIcon, Settings, LogOut, AlertTriangle, ArrowUpRight
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { usePathname, useRouter } from "next/navigation";

interface UserProfile {
    username: string;
    avatar_url: string;
    trust_score: number;
    _id: string;
}

interface Notification {
    id: string;
    message: string;
    type: string;
    related_id?: string;
    sender_id: string;
    is_read: boolean;
    action_status?: string;
    data?: {
        candidate_name: string;
        candidate_avatar: string;
        project_name: string;
    };
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

export default function GlobalHeader() {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [pageTitle, setPageTitle] = useState("Dashboard");

    const [showNotifDropdown, setShowNotifDropdown] = useState(false);
    const [showProfileDropdown, setShowProfileDropdown] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);

    const notifRef = useRef<HTMLDivElement>(null);
    const profileRef = useRef<HTMLDivElement>(null);

    const pathname = usePathname();
    const router = useRouter();

    // --- 1. SMART TITLE LOGIC ---
    useEffect(() => {
        const segment = pathname.split("/").pop();
        const isId = segment && segment.length > 15 && /\d/.test(segment);

        if (pathname.includes("/find-team")) setPageTitle("Find Team");
        else if (pathname.includes("/projects")) setPageTitle("My Projects");
        else if (isId) setPageTitle("Project Workspace");
        else setPageTitle(segment?.replace(/-/g, " ") || "Dashboard");

        const handleTitleUpdate = (e: any) => {
            if (e.detail) setPageTitle(e.detail);
        };

        window.addEventListener("headerTitleUpdate", handleTitleUpdate);
        window.addEventListener("dashboardUpdate", handleRefresh);

        return () => {
            window.removeEventListener("headerTitleUpdate", handleTitleUpdate);
            window.removeEventListener("dashboardUpdate", handleRefresh);
        };
    }, [pathname]);

    // --- 2. DATA FETCHING ---
    useEffect(() => {
        const token = Cookies.get("token");
        if (token) {
            fetchUserProfile(token);
            fetchNotifications(token);
            fetchUnreadCount(token);
        }

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleRefresh = () => {
        const token = Cookies.get("token");
        if (token) {
            fetchNotifications(token);
            fetchUnreadCount(token);
        }
    };

    const handleClickOutside = (event: MouseEvent) => {
        if (notifRef.current && !notifRef.current.contains(event.target as Node)) setShowNotifDropdown(false);
        if (profileRef.current && !profileRef.current.contains(event.target as Node)) setShowProfileDropdown(false);
    };

    const handleLogout = () => { Cookies.remove("token"); window.location.href = "/"; };

    const fetchUserProfile = async (jwt: string) => {
        try {
            const res = await api.get("/users/me");
            setUser(res.data);
            const ws = new WebSocket(`${WS_URL}/chat/ws/${res.data._id || res.data.id}`);

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);

                // --- 1. Handle New Notifications ---
                if (data.event === "notification") {
                    setNotifications(prev => [data.notification, ...prev]);
                    // Trigger a refresh so the Action Center (votes) updates immediately
                    window.dispatchEvent(new Event("dashboardUpdate"));
                    toast.info("New Notification received");
                }
                // --- 2. Handle Dashboard Updates (The part you missed) ---
                else if (data.event === "dashboardUpdate") {
                    // This tells all components (like TeamDetails) to re-fetch data
                    window.dispatchEvent(new Event("dashboardUpdate"));
                    if (data.message) toast.info(data.message);
                }
                // --- 3. Handle Critical Events ---
                else if (data.event === "team_deleted") {
                    alert(data.message);
                    window.location.href = "/dashboard";
                }
                // --- 4. Handle Chat Messages ---
                else if (data.event === "message" && data.message.sender_id !== (res.data._id || res.data.id)) {
                    setUnreadCount(p => p + 1);
                }
            };
        } catch (e) { console.error(e); }
    };

    const fetchNotifications = async (jwt: string) => { try { const res = await api.get("/notifications/"); setNotifications(res.data); } catch (e) { } };
    const fetchUnreadCount = async (jwt: string) => { try { const res = await api.get("/chat/unread-count"); setUnreadCount(res.data.count); } catch (e) { } }

    // --- 3. NOTIFICATION LOGIC ---
    const toggleNotifications = async () => {
        const newState = !showNotifDropdown;
        setShowNotifDropdown(newState);

        if (newState) {
            // Mark informational items as read visually
            setNotifications(prev => prev.map(n =>
                (['team_invite', 'join_request', 'deletion_request', 'completion_request'].includes(n.type) && !n.action_status)
                    ? n
                    : { ...n, is_read: true }
            ));
            try { await api.post("/notifications/read-all", {}); } catch (e) { }
        }
    }

    // --- 4. ACTION HANDLERS ---
    const handleVote = async (notif: Notification, decision: 'approve' | 'reject') => {
        if (!notif.related_id) return;
        setProcessingId(notif.id);
        const endpoint = notif.type === 'completion_request'
            ? `/teams/${notif.related_id}/complete/vote`
            : `/teams/${notif.related_id}/delete/vote`;

        try {
            const res = await api.post(endpoint, { decision });

            // Remove notification after vote
            setNotifications(prev => prev.filter(n => n.id !== notif.id));

            if (res.data.status === "deleted") {
                alert("Consensus reached. Team deleted.");
                window.location.href = "/dashboard";
            } else if (res.data.status === "completed") {
                alert("Project Completed! Please rate your teammates.");
                window.dispatchEvent(new Event("dashboardUpdate"));
            } else if (res.data.status === "kept") {
                alert("Vote failed. Consensus not reached.");
                window.dispatchEvent(new Event("dashboardUpdate"));
            } else {
                window.dispatchEvent(new Event("dashboardUpdate"));
            }
        } catch (err) { alert("Failed to vote"); } finally { setProcessingId(null); }
    };

    const handleAccept = async (notif: Notification) => {
        if (!notif.related_id) return;
        setProcessingId(notif.id);

        try {
            let targetUserId = notif.sender_id;
            await api.post(`/teams/${notif.related_id}/members`, { target_user_id: targetUserId });
            await api.put(`/notifications/${notif.id}/read?status=accepted`, {});

            // ✅ ACTION: Remove from list immediately (Satisfies "Go Away")
            setNotifications(prev => prev.filter(n => n.id !== notif.id));

            // Trigger background refresh with slight delay to allow DB to sync
            setTimeout(() => window.dispatchEvent(new Event("dashboardUpdate")), 500);
        } catch (err) {
            console.error(err);
            alert("Action failed");
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (notif: Notification) => {
        if (!notif.related_id) return;
        if (!confirm("Reject this request?")) return;
        setProcessingId(notif.id);
        try {
            await api.post(`/teams/${notif.related_id}/reject`, { target_user_id: notif.sender_id });
            await api.put(`/notifications/${notif.id}/read?status=rejected`, {});

            // ✅ ACTION: Remove from list immediately
            setNotifications(prev => prev.filter(n => n.id !== notif.id));

            setTimeout(() => window.dispatchEvent(new Event("dashboardUpdate")), 500);
        } catch (err) { alert("Action failed"); } finally { setProcessingId(null); }
    };

    if (!user) return <div className="h-20 bg-transparent"></div>;

    // --- RENDER ---
    return (
        <header className="w-full h-20 px-8 flex items-center justify-between bg-transparent relative z-50">

            <div className="flex items-center gap-3 text-sm">
                <span className="text-zinc-500 font-medium">Workspace</span>
                <span className="text-zinc-600">/</span>
                <h1 className="text-zinc-100 font-bold capitalize text-lg tracking-tight">{pageTitle}</h1>
            </div>

            <div className="flex items-center gap-6">

                <button id="onboarding-chat" onClick={() => router.push("/chat")} className="relative group">
                    <MessageSquare className="w-5 h-5 text-zinc-400 group-hover:text-white transition-colors" />
                    {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-[#0B0E14]"></span>}
                </button>

                <div className="relative" ref={notifRef}>
                    <button onClick={toggleNotifications} className="relative group pt-1">
                        <Bell className={`w-5 h-5 transition-colors ${notifications.some(n => !n.is_read) ? 'text-zinc-100' : 'text-zinc-400 group-hover:text-white'}`} />
                        {notifications.filter(n => !n.is_read).length > 0 && (
                            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full border-2 border-[#0B0E14]">
                                {notifications.filter(n => !n.is_read).length}
                            </span>
                        )}
                    </button>

                    <AnimatePresence>
                        {showNotifDropdown && (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute right-0 mt-4 w-80 bg-[#111] border border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden">
                                <div className="p-4 border-b border-zinc-800 font-bold text-xs uppercase text-zinc-500 flex justify-between">
                                    <span>Notifications</span>
                                    <button onClick={() => setShowNotifDropdown(false)}><X className="w-4 h-4 hover:text-white" /></button>
                                </div>
                                <div className="max-h-80 overflow-y-auto custom-scrollbar p-1">
                                    {notifications.length === 0 ? <p className="p-4 text-zinc-600 text-xs text-center">No new notifications</p> :
                                        notifications.map(n => {
                                            const isDecided = n.action_status === 'accepted' || n.action_status === 'rejected' || n.action_status === 'voted';
                                            const isInvite = n.type === 'team_invite' || n.type === 'join_request';
                                            const isVote = n.type === 'deletion_request' || n.type === 'completion_request';
                                            const isLike = n.type === 'project_like' || n.type === 'candidate_like';

                                            return (
                                                <div key={n.id} className={`p-3 rounded-lg mb-1 border border-transparent ${!n.is_read ? 'bg-zinc-900/50 border-zinc-800' : 'hover:bg-zinc-900'}`}>

                                                    {/* HEADER */}
                                                    <div className="flex items-start gap-3 mb-2">
                                                        <img
                                                            src={n.data?.candidate_avatar || "https://github.com/shadcn.png"}
                                                            className="w-8 h-8 rounded-full object-cover border border-zinc-700 shrink-0"
                                                            alt="Avatar"
                                                        />
                                                        <div className="overflow-hidden">
                                                            <p className="text-xs text-zinc-300 leading-snug">
                                                                <span className="font-bold text-white block mb-0.5">{n.data?.candidate_name || "User"}</span>
                                                                {n.message.replace(n.data?.candidate_name || "", "").trim()}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/*INFO-ONLY VIEW BUTTONS (For Likes) */}
                                                    {isLike && (
                                                        <div className="pl-11">
                                                            {n.type === 'project_like' ? (
                                                                // User liked project -> Leader views User Profile
                                                                <Link href={`/profile/${n.sender_id}`} target="_blank" className="block w-full">
                                                                    <button className="w-full bg-zinc-800 border border-zinc-700 text-zinc-300 py-1.5 rounded text-[10px] font-bold hover:bg-zinc-700 hover:text-white flex justify-center items-center gap-1 transition-all">
                                                                        <UserIcon className="w-3 h-3" /> View Profile
                                                                    </button>
                                                                </Link>
                                                            ) : (
                                                                // Leader liked user -> User views Project
                                                                <Link href={`/teams/${n.related_id}`} target="_blank" className="block w-full">
                                                                    <button className="w-full bg-zinc-800 border border-zinc-700 text-zinc-300 py-1.5 rounded text-[10px] font-bold hover:bg-zinc-700 hover:text-white flex justify-center items-center gap-1 transition-all">
                                                                        <ArrowUpRight className="w-3 h-3" /> View Project
                                                                    </button>
                                                                </Link>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* ACTIONS: View | Accept | Reject */}
                                                    {isInvite && !isDecided && (
                                                        <div className="grid grid-cols-3 gap-2 pl-11">
                                                            {/* Smart View Button */}
                                                            {n.type === 'join_request' ? (
                                                                <Link href={`/profile/${n.sender_id}`} target="_blank" className="w-full">
                                                                    <button className="w-full bg-zinc-800 border border-zinc-700 text-zinc-300 py-1.5 rounded text-[10px] font-bold hover:bg-zinc-700 hover:text-white flex justify-center items-center gap-1 transition-all">
                                                                        <UserIcon className="w-3 h-3" /> Profile
                                                                    </button>
                                                                </Link>
                                                            ) : n.related_id ? (
                                                                <Link href={`/teams/${n.related_id}`} target="_blank" className="w-full">
                                                                    <button className="w-full bg-zinc-800 border border-zinc-700 text-zinc-300 py-1.5 rounded text-[10px] font-bold hover:bg-zinc-700 hover:text-white flex justify-center items-center gap-1 transition-all">
                                                                        <ArrowUpRight className="w-3 h-3" /> View
                                                                    </button>
                                                                </Link>
                                                            ) : <div />}

                                                            <button onClick={() => handleAccept(n)} disabled={processingId === n.id} className="w-full bg-green-500/10 border border-green-500/20 text-green-400 py-1.5 rounded text-[10px] font-bold hover:bg-green-500 hover:text-white flex justify-center items-center gap-1 transition-all">
                                                                {processingId === n.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Check className="w-3 h-3" /> Accept</>}
                                                            </button>

                                                            <button onClick={() => handleReject(n)} disabled={processingId === n.id} className="w-full bg-red-500/10 border border-red-500/20 text-red-400 py-1.5 rounded text-[10px] font-bold hover:bg-red-500 hover:text-white flex justify-center items-center gap-1 transition-all">
                                                                <X className="w-3 h-3" /> Reject
                                                            </button>
                                                        </div>
                                                    )}

                                                    {/* VOTING ACTIONS */}
                                                    {isVote && !isDecided && (
                                                        <div className="flex gap-2 pl-11">
                                                            <button onClick={() => handleVote(n, 'approve')} disabled={processingId === n.id} className={`flex-1 ${n.type === 'completion_request' ? 'bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500 hover:text-white' : 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white'} py-1.5 rounded text-[10px] font-bold flex justify-center items-center gap-1 transition-all`}>
                                                                {n.type === 'completion_request' ? 'Complete' : 'Delete'}
                                                            </button>
                                                            <button onClick={() => handleVote(n, 'reject')} disabled={processingId === n.id} className="flex-1 bg-zinc-800 border border-zinc-700 text-zinc-300 py-1.5 rounded text-[10px] font-bold hover:bg-zinc-700 hover:text-white transition-all">Reject</button>
                                                        </div>
                                                    )}

                                                    {/* STATUS FEEDBACK */}
                                                    {isDecided && (
                                                        <div className={`text-[10px] mt-2 pl-11 font-bold flex items-center gap-1 ${n.action_status === 'accepted' ? 'text-green-500' : n.action_status === 'voted' ? 'text-blue-500' : 'text-red-500'}`}>
                                                            {n.action_status === 'accepted' && <Check className="w-3 h-3" />}
                                                            {n.action_status === 'rejected' && <X className="w-3 h-3" />}
                                                            {n.action_status === 'accepted' ? 'Accepted' : n.action_status === 'voted' ? 'Voted' : 'Rejected'}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div className="flex items-center gap-4 border-l border-zinc-800 pl-6">
                    <div className="hidden md:flex items-center gap-2 bg-[#1A1D24] px-3 py-1.5 rounded-lg border border-zinc-800/50">
                        <span className="text-[10px] uppercase text-zinc-500 font-bold tracking-wider">Trust</span>
                        <span className={`text-sm font-bold ${user.trust_score >= 8 ? 'text-green-400' : 'text-yellow-400'}`}>{user.trust_score.toFixed(1)}</span>
                    </div>

                    <div className="relative" ref={profileRef}>
                        <button onClick={() => setShowProfileDropdown(!showProfileDropdown)} className="block">
                            <img src={user.avatar_url || "https://github.com/shadcn.png"} className="w-9 h-9 rounded-full border border-zinc-700 hover:border-zinc-500 transition-all object-cover" />
                        </button>
                        {showProfileDropdown && (
                            <div className="absolute right-0 mt-4 w-48 bg-[#111] border border-zinc-800 rounded-xl shadow-xl z-50 py-1">
                                <Link href="/profile" className="block px-4 py-2 text-sm text-zinc-400 hover:text-white hover:bg-zinc-900">Profile</Link>
                                <Link href="/settings" className="block px-4 py-2 text-sm text-zinc-400 hover:text-white hover:bg-zinc-900">Settings</Link>
                                <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-900/10">Log Out</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}