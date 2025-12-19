"use client";
import { useEffect, useState, useRef } from "react";
import Cookies from "js-cookie";
import api from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
    ShieldCheck, Bell, MessageSquare, Check, X, Loader2, AlertTriangle, LogOut, User as UserIcon
} from "lucide-react";
import Link from "next/link";

interface UserProfile {
    username: string;
    avatar_url: string;
    trust_score: number;
    _id: string;
}

interface Notification {
    _id: string;
    message: string;
    type: string;
    related_id?: string;
    sender_id: string;
    is_read: boolean;
    action_status?: string;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

export default function GlobalHeader() {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);

    const [showNotifDropdown, setShowNotifDropdown] = useState(false);
    const [showProfileDropdown, setShowProfileDropdown] = useState(false);

    const [processingId, setProcessingId] = useState<string | null>(null);

    const notifRef = useRef<HTMLDivElement>(null);
    const profileRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const token = Cookies.get("token");
        if (token) {
            fetchUserProfile(token);
            fetchNotifications(token);
            fetchUnreadCount(token);
        }

        document.addEventListener("mousedown", handleClickOutside);

        const handleRefresh = () => {
            if (token) {
                fetchNotifications(token);
                fetchUnreadCount(token);
            }
        };
        window.addEventListener("triggerNotificationRefresh", handleRefresh);
        window.addEventListener("dashboardUpdate", handleRefresh);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            window.removeEventListener("triggerNotificationRefresh", handleRefresh);
            window.removeEventListener("dashboardUpdate", handleRefresh);
        };
    }, []);

    const handleClickOutside = (event: MouseEvent) => {
        if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
            setShowNotifDropdown(false);
        }
        if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
            setShowProfileDropdown(false);
        }
    };

    const handleLogout = () => {
        Cookies.remove("token");
        window.location.href = "/";
    };

    const fetchUserProfile = async (jwt: string) => {
        try {
            const res = await api.get("/users/me");
            setUser(res.data);

            const ws = new WebSocket(`${WS_URL}/chat/ws/${res.data._id || res.data.id}`);

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);

                if (data.event === "notification") {
                    setNotifications(prev => [data.notification, ...prev]);
                    window.dispatchEvent(new Event("dashboardUpdate"));
                } else if (data.event === "team_deleted") {
                    alert(data.message);
                    window.location.href = "/dashboard";
                } else if (data.event === "message") {
                    // Update Unread Count if message is not from me
                    const msg = data.message;
                    if (msg && msg.sender_id !== (res.data._id || res.data.id)) {
                        setUnreadCount(p => p + 1);
                    }
                }
            };
        } catch (e) { console.error(e); }
    };

    const fetchNotifications = async (jwt: string) => {
        try {
            const res = await api.get("/notifications/");
            setNotifications(res.data);
        } catch (e) { }
    };

    const fetchUnreadCount = async (jwt: string) => {
        try {
            const res = await api.get("/chat/unread-count");
            setUnreadCount(res.data.count);
        } catch (e) { }
    }

    const toggleNotifications = async () => {
        const newState = !showNotifDropdown;
        setShowNotifDropdown(newState);
        if (newState) {
            setNotifications(prev => prev.map(n => (['team_invite', 'join_request', 'deletion_request', 'completion_request'].includes(n.type) && !n.action_status) ? n : { ...n, is_read: true }));
            try { await api.post("/notifications/read-all", {}); } catch (e) { }
        }
    }

    // --- ACTIONS ---
    const handleVote = async (notif: Notification, decision: 'approve' | 'reject') => {
        if (!notif.related_id) return;
        setProcessingId(notif._id);
        const endpoint = notif.type === 'completion_request'
            ? `/teams/${notif.related_id}/complete/vote`
            : `/teams/${notif.related_id}/delete/vote`;

        try {
            const res = await api.post(endpoint, { decision });
            if (res.data.status === "deleted") {
                alert("Consensus reached. Team deleted.");
                window.location.href = "/dashboard";
            } else if (res.data.status === "completed") {
                alert("Project Completed! Please rate your teammates.");
                setNotifications(prev => prev.map(n => n._id === notif._id ? { ...n, is_read: true, action_status: "accepted" } : n));
                window.dispatchEvent(new Event("dashboardUpdate"));
            } else if (res.data.status === "kept") {
                alert("Vote failed. Consensus not reached.");
                setNotifications(prev => prev.map(n => n._id === notif._id ? { ...n, is_read: true, action_status: "rejected" } : n));
                window.dispatchEvent(new Event("dashboardUpdate"));
            } else {
                setNotifications(prev => prev.map(n => n._id === notif._id ? { ...n, is_read: true, action_status: "voted" } : n));
                window.dispatchEvent(new Event("dashboardUpdate"));
            }
        } catch (err) { alert("Failed to vote"); } finally { setProcessingId(null); }
    };

    const handleAccept = async (notif: Notification) => {
        if (!notif.related_id) return;
        setProcessingId(notif._id);
        try {
            let target = notif.type === "join_request" ? notif.sender_id : "ME";
            if (target === "ME" && user) target = user._id;
            await api.post(`/teams/${notif.related_id}/members`, { target_user_id: target });
            await api.put(`/notifications/${notif._id}/read?status=accepted`, {});
            setNotifications(prev => prev.map(n => n._id === notif._id ? { ...n, is_read: true, action_status: "accepted" } : n));
            window.dispatchEvent(new Event("dashboardUpdate"));
        } catch (err) { alert("Action failed"); } finally { setProcessingId(null); }
    };

    const handleReject = async (notif: Notification) => {
        if (!notif.related_id) return;
        if (!confirm("Reject this request?")) return;
        setProcessingId(notif._id);
        try {
            await api.post(`/teams/${notif.related_id}/reject`, { target_user_id: notif.sender_id });
            await api.put(`/notifications/${notif._id}/read?status=rejected`, {});
            setNotifications(prev => prev.map(n => n._id === notif._id ? { ...n, is_read: true, action_status: "rejected" } : n));
            window.dispatchEvent(new Event("dashboardUpdate"));
        } catch (err) { alert("Action failed"); } finally { setProcessingId(null); }
    };

    const getScoreColor = (score: number) => { if (score >= 8) return "text-green-400"; if (score >= 5) return "text-yellow-400"; return "text-red-400"; };

    if (!user) return <div className="h-20"></div>;

    return (
        <header className="border-b border-gray-800 mb-8 py-4 bg-gray-950/80 backdrop-blur-md sticky top-0 z-50">
            <div className="max-w-6xl mx-auto flex items-center justify-between px-8">
                <div className="flex items-center gap-8">
                    <Link href="/dashboard">
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent cursor-pointer">CollabQuest</h1>
                    </Link>
                    <nav className="hidden md:flex gap-6 text-sm font-medium text-gray-400">
                        <Link href="/dashboard" className="hover:text-white transition">Dashboard</Link>
                        <Link href="/find-team" className="hover:text-white transition">Marketplace</Link>
                        <Link href="/matches?type=users" className="hover:text-white transition">Recruit</Link>
                    </nav>
                </div>

                <div className="flex items-center gap-4">

                    {/* NOTIFICATIONS */}
                    <div className="relative" ref={notifRef}>
                        <button onClick={toggleNotifications} className="p-2.5 bg-gray-900 hover:bg-gray-800 rounded-full border border-gray-700 transition relative">
                            <Bell className="w-5 h-5 text-yellow-400" />
                            {notifications.filter(n => !n.is_read).length > 0 && <span className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">{notifications.filter(n => !n.is_read).length}</span>}
                        </button>
                        <AnimatePresence>
                            {showNotifDropdown && (
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute right-0 mt-2 w-80 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl z-50 overflow-hidden">
                                    <div className="p-3 border-b border-gray-800 font-bold text-sm bg-gray-950 flex justify-between">
                                        <span>Notifications</span>
                                        <button onClick={() => setShowNotifDropdown(false)}><X className="w-4 h-4 text-gray-500" /></button>
                                    </div>
                                    <div className="max-h-80 overflow-y-auto">
                                        {notifications.length === 0 ? <p className="p-4 text-gray-500 text-sm text-center">No notifications</p> : (
                                            notifications.map(n => {
                                                const isDecided = n.action_status === 'accepted' || n.action_status === 'rejected' || n.action_status === 'voted';
                                                const isInvite = n.type === 'team_invite' || n.type === 'join_request';
                                                const isVote = n.type === 'deletion_request' || n.type === 'completion_request';

                                                return (
                                                    <div key={n._id} className={`p-3 border-b border-gray-800 ${!n.is_read ? 'bg-gray-800/50' : ''}`}>
                                                        <p className="text-xs text-gray-300 mb-2">{n.message}</p>

                                                        {isInvite && !isDecided && (
                                                            <div className="flex gap-2 mt-2">
                                                                <button onClick={() => handleAccept(n)} disabled={processingId === n._id} className="flex-1 bg-green-600 hover:bg-green-500 text-white py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1">{processingId === n._id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Check className="w-3 h-3" /> Accept</>}</button>
                                                                <button onClick={() => handleReject(n)} disabled={processingId === n._id} className="flex-1 bg-red-600 hover:bg-red-500 text-white py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1"><X className="w-3 h-3" /> Reject</button>
                                                            </div>
                                                        )}

                                                        {isVote && !isDecided && (
                                                            <div className="flex gap-2 mt-2">
                                                                <button onClick={() => handleVote(n, 'approve')} disabled={processingId === n._id} className={`flex-1 ${n.type === 'completion_request' ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'} text-white py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1`}>
                                                                    {n.type === 'completion_request' ? <Check className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                                                                    {n.type === 'completion_request' ? 'Complete' : 'Delete'}
                                                                </button>
                                                                <button onClick={() => handleVote(n, 'reject')} disabled={processingId === n._id} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1">Reject</button>
                                                            </div>
                                                        )}

                                                        {isDecided && (
                                                            <div className={`text-xs mt-1 font-bold ${n.action_status === 'accepted' ? 'text-green-400' : n.action_status === 'voted' ? 'text-blue-400' : 'text-red-400'}`}>
                                                                {n.action_status === 'accepted' ? 'Accepted' : n.action_status === 'voted' ? 'Voted' : 'Rejected'}
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <Link href="/chat">
                        <button className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 px-4 py-2 rounded-full border border-gray-700 transition relative">
                            <MessageSquare className="w-4 h-4 text-blue-400" />
                            <span className="hidden sm:inline">Messages</span>
                            {unreadCount > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{unreadCount}</span>}
                        </button>
                    </Link>

                    {/* PROFILE */}
                    <div className="relative" ref={profileRef}>
                        <button onClick={() => setShowProfileDropdown(!showProfileDropdown)} className="focus:outline-none">
                            <img src={user.avatar_url || "https://github.com/shadcn.png"} alt="Profile" className="w-10 h-10 rounded-full border border-gray-700 hover:border-gray-500 transition object-cover" />
                        </button>
                        <AnimatePresence>
                            {showProfileDropdown && (
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute right-0 mt-2 w-56 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl z-50 overflow-hidden">
                                    <div className="p-4 border-b border-gray-800 flex items-center gap-3 bg-gray-950/50">
                                        <ShieldCheck className={getScoreColor(user.trust_score) + " h-6 w-6"} />
                                        <div className="flex flex-col"><span className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">Trust Score</span><span className="font-bold text-lg leading-none text-white">{user.trust_score.toFixed(1)}</span></div>
                                    </div>
                                    <div className="p-2">
                                        <Link href="/profile" onClick={() => setShowProfileDropdown(false)}><div className="p-3 hover:bg-gray-800 rounded-lg cursor-pointer flex items-center gap-3 text-sm text-gray-300 hover:text-white transition mb-1"><UserIcon className="w-4 h-4 text-blue-400" /> My Profile</div></Link>
                                        <button onClick={handleLogout} className="w-full text-left p-3 hover:bg-red-900/20 rounded-lg cursor-pointer flex items-center gap-3 text-sm text-red-400 hover:text-red-300 transition"><LogOut className="w-4 h-4" /> Logout</button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </header>
    );
}