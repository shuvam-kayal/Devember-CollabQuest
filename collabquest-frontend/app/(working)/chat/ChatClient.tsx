"use client";
import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Cookies from "js-cookie";
import api from "@/lib/api";
import GlobalHeader from "@/components/GlobalHeader";
import { Send, User, MessageSquare, Users, MoreVertical, UserIcon, Search, ShieldAlert, Check, X, Lock, Unlock, LogOut, Slash, Plus, Trash2, Ban } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ChatItem {
    id: string;
    name: string;
    type: "user" | "group";
    avatar: string;
    last_message: string;
    timestamp: string;
    unread_count: number;
    is_online: boolean;
    member_count?: number;
    is_team_group?: boolean;
    admin_id?: string; // Add admin_id to interface
}



interface Message { sender_id: string; recipient_id?: string; content: string; timestamp: string; sender_name?: string; }
interface UserDetail {
    id: string;
    _id?: string; // Add this line to satisfy TypeScript
    username: string;
    avatar_url: string;
    trust_score: number;
    skills: { name: string, level: string }[];
    about?: string;
    email?: string;
}
interface GroupDetails {
    id: string; name: string; avatar_url: string; admin_id: string; is_team_group: boolean; members: { id: string, username: string, avatar_url: string }[];
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

export default function ChatPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [userId, setUserId] = useState("");
    const [chatList, setChatList] = useState<ChatItem[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [activeChat, setActiveChat] = useState<ChatItem | null>(null);
    const [newMessage, setNewMessage] = useState("");
    const [ws, setWs] = useState<WebSocket | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    const activeChatRef = useRef<string | null>(null);

    // Modal States
    const [showChatMenu, setShowChatMenu] = useState(false);
    const [showGroupInfo, setShowGroupInfo] = useState(false);
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [showAddMemberModal, setShowAddMemberModal] = useState(false);
    const [showInfoModal, setShowInfoModal] = useState(false);

    const [groupMembers, setGroupMembers] = useState<any[]>([]);
    const [groupDetails, setGroupDetails] = useState<GroupDetails | null>(null);
    const [showProfileInfo, setShowProfileInfo] = useState(false);
    const [activeUserProfile, setActiveUserProfile] = useState<UserDetail | null>(null);
    const [chatStatus, setChatStatus] = useState<"accepted" | "pending_incoming" | "pending_outgoing" | "blocked_by_me" | "blocked_by_them" | "none">("accepted");

    // Group Creation/Edit State
    const [groupName, setGroupName] = useState("");
    const [editingGroupName, setEditingGroupName] = useState("");
    const [contacts, setContacts] = useState<any[]>([]);
    const [selectedContacts, setSelectedContacts] = useState<string[]>([]);

    const scrollRef = useRef<HTMLDivElement>(null);
    const initialTarget = searchParams.get("targetId");

    useEffect(() => { activeChatRef.current = activeChat?.id || null; }, [activeChat]);

    useEffect(() => {
        const token = Cookies.get("token");
        if (!token) { router.push("/"); return; }
        api.get("/users/me")
            .then(res => { setUserId(res.data._id || res.data.id); connectWs(res.data._id || res.data.id); });
        fetchChatList();
    }, []);

    useEffect(() => {
        const token = Cookies.get("token");
        if (initialTarget && token) handleSelectChat(initialTarget);
    }, [initialTarget]);

    useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);

    const connectWs = (uid: string) => {
        const socket = new WebSocket(`${WS_URL}/chat/ws/${uid}`);
        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.event === "message") {
                const incomingMsg = data.message;
                const currentChatId = activeChatRef.current;
                const isRelevantChat = currentChatId && (incomingMsg.sender_id === currentChatId || incomingMsg.recipient_id === currentChatId);
                if (isRelevantChat) {
                    setMessages(prev => [...prev, incomingMsg]);
                    api.post(`/chat/read/${currentChatId}`, {})
                        .then(() => window.dispatchEvent(new Event("triggerNotificationRefresh")));
                } else {
                    fetchChatList();
                    window.dispatchEvent(new Event("triggerNotificationRefresh"));
                }
            }
        };
        setWs(socket);
    };

    const fetchChatList = async () => {
        try {
            const res = await api.get("/chat/conversations");
            const mapped = res.data.map((c: any) => ({
                id: c.id,
                name: c.username || "Unknown",
                type: c.type,
                avatar: c.avatar_url || "https://github.com/shadcn.png",
                last_message: c.last_message || "",
                timestamp: c.last_timestamp,
                unread_count: c.unread_count || 0,
                is_online: c.is_online,
                member_count: c.member_count,
                is_team_group: c.is_team_group,
                admin_id: c.admin_id // Pass this through
            }));
            setChatList(mapped);
        } catch (e) { }
    };

    const handleSelectChat = async (targetId: string) => {
        try {
            let chat = chatList.find(c => c.id === targetId);
            let isUser = false;

            if (!chat) {
                try {
                    const uRes = await api.get(`/users/${targetId}`);
                    if (uRes.data) {
                        chat = { id: targetId, name: uRes.data.username || "User", type: "user", avatar: uRes.data.avatar_url || "https://github.com/shadcn.png", last_message: "", timestamp: "", unread_count: 0, is_online: false };
                        isUser = true;
                    }
                } catch {
                    try {
                        const gRes = await api.get(`/chat/groups/${targetId}`);
                        chat = { id: targetId, name: gRes.data.name || "Group", type: "group", avatar: gRes.data.avatar_url || "https://api.dicebear.com/7.x/initials/svg?seed=Group", last_message: "", timestamp: "", unread_count: 0, is_online: true, admin_id: gRes.data.admin_id };
                        isUser = false;
                    } catch { return; }
                }
            } else { isUser = chat.type === 'user'; }

            setActiveChat(chat!);
            setShowGroupInfo(false); setShowProfileInfo(false); setShowChatMenu(false);

            if (isUser) {
                api.get(`/users/${targetId}`).then(res => setActiveUserProfile(res.data)).catch(() => { });
            } else {
                setChatStatus("accepted");
                api.get(`/chat/groups/${targetId}`).then(res => setGroupMembers(res.data.members)).catch(() => { });
            }

            api.get(`/chat/history/${targetId}`)
                .then(res => {
                    setMessages(res.data.messages || []);
                    const meta = res.data.meta;
                    if (meta) {
                        if (meta.blocked_by_me) setChatStatus("blocked_by_me");
                        else if (meta.blocked_by_them) setChatStatus("blocked_by_them");
                        else if (meta.is_pending) setChatStatus("pending_incoming");
                        else setChatStatus("accepted");
                    }
                    fetchChatList();
                    window.dispatchEvent(new Event("triggerNotificationRefresh"));
                });
        } catch (e) { }
    };

    const sendMessage = () => {
        if (!ws || !newMessage.trim() || !activeChat) return;
        const msg = { recipient_id: activeChat.id, content: newMessage };
        ws.send(JSON.stringify(msg));
        setMessages(prev => [...prev, { sender_id: userId, content: newMessage, timestamp: new Date().toISOString() }]);
        setNewMessage("");
        if (chatStatus === 'none' && activeChat.type === 'user') setChatStatus('pending_outgoing');
    };

    const handleAction = async (action: 'accept' | 'block' | 'unblock') => {
        if (!activeChat) return;
        try {
            if (action === 'accept') {
                await api.post(`/chat/request/${activeChat.id}/accept`, {});
                setChatStatus('accepted');
            } else {
                await api.post(`/chat/${action}/${activeChat.id}`, {});
                setChatStatus(action === 'block' ? 'blocked_by_me' : 'accepted');
            }
            setShowChatMenu(false);
        } catch (e) { alert("Action failed"); }
    };

    const handleHeaderClick = async () => {
        if (!activeChat) return;
        if (activeChat.type === "user") {
            try {
                const res = await api.get(`/users/${activeChat.id}`);
                setActiveUserProfile(res.data);
                setShowProfileInfo(true);
            } catch (e: any) {
                if (e.response && e.response.status === 403) alert("Error: You cannot view this profile.");
            }
        } else {
            try {
                const res = await api.get(`/chat/groups/${activeChat.id}`);
                setGroupDetails(res.data);
                setEditingGroupName(res.data.name);
                setShowInfoModal(true);
            } catch (e) { console.error(e); }
        }
    };

    // --- GROUP ACTIONS ---
    const updateGroup = async () => {
        if (!groupDetails || !editingGroupName) return;
        try {
            await api.put(`/chat/groups/${groupDetails.id}`, { name: editingGroupName });
            setGroupDetails({ ...groupDetails, name: editingGroupName });
            fetchChatList();
            alert("Group updated!");
        } catch (e) { alert("Update failed"); }
    };

    const removeGroupMember = async (targetId: string) => {
        if (!groupDetails) return;
        try {
            await api.delete(`/chat/groups/${groupDetails.id}/members/${targetId}`);
            const res = await api.get(`/chat/groups/${groupDetails.id}`);
            setGroupDetails(res.data);
        } catch (e) { alert("Failed to remove member"); }
    };

    const leaveGroup = async () => {
        if (!groupDetails || !confirm("Are you sure you want to leave?")) return;
        try {
            await api.post(`/chat/groups/${groupDetails.id}/leave`, {});
            window.location.reload();
        } catch (e) { alert("Failed to leave group"); }
    };

    const blockGroup = async () => {
        if (!groupDetails || !confirm("Block this group? You will leave and cannot be added back.")) return;
        try {
            await api.post(`/chat/groups/${groupDetails.id}/block`, {});
            window.location.reload();
        } catch (e) { alert("Failed to block group"); }
    };

    // Add Member
    const openAddMemberModal = async () => {
        try {
            const res = await api.get("/chat/contacts");
            const existingIds = groupDetails?.members.map(m => m.id) || [];
            setContacts(res.data.filter((c: any) => !existingIds.includes(c.id)));
            setShowAddMemberModal(true);
        } catch (e) { alert("Failed"); }
    };

    const addToGroup = async (targetId: string) => {
        if (!groupDetails) return;
        try {
            await api.put(`/chat/groups/${groupDetails.id}/members`, { user_id: targetId });
            setShowAddMemberModal(false);
            const res = await api.get(`/chat/groups/${groupDetails.id}`);
            setGroupDetails(res.data);
        } catch (e: any) {
            if (e.response && e.response.status === 400) alert("Cannot add: User has blocked this group.");
            else alert("Failed to add member");
        }
    }

    // Create Group
    const openGroupModal = async () => { try { const res = await api.get("/chat/contacts"); setContacts(res.data); setShowGroupModal(true); } catch (e) { alert("Failed"); } };
    const toggleContact = (id: string) => { if (selectedContacts.includes(id)) setSelectedContacts(prev => prev.filter(c => c !== id)); else setSelectedContacts(prev => [...prev, id]); };
    const createGroup = async () => { if (!groupName || selectedContacts.length === 0) return alert("Invalid group"); try { await api.post("/chat/groups", { name: groupName, member_ids: selectedContacts }); setShowGroupModal(false); setGroupName(""); setSelectedContacts([]); fetchChatList(); } catch (e) { alert("Failed"); } };

    const formatTime = (iso: string) => { if (!iso) return ""; return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };
    const toggleInfo = () => { if (activeChat?.type === 'group') { setShowGroupInfo(!showGroupInfo); setShowProfileInfo(false); } else if (activeChat?.type === 'user') { setShowProfileInfo(!showProfileInfo); setShowGroupInfo(false); } setShowChatMenu(false); }
    const filteredChats = chatList.filter(chat => chat.name.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <div className="h-screen bg-gray-950 text-white flex flex-col overflow-hidden">
            <style jsx global>{` .custom-scrollbar::-webkit-scrollbar { width: 6px; } .custom-scrollbar::-webkit-scrollbar-track { background: #111827; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; border-radius: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #4B5563; } `}</style>
            <GlobalHeader />
            <div className="flex-1 max-w-6xl w-full mx-auto p-4 flex gap-4 h-[calc(100vh-80px)] overflow-hidden">
                <div className="w-full md:w-1/3 bg-gray-900 border border-gray-800 rounded-2xl flex flex-col overflow-hidden h-full shadow-lg">
                    <div className="p-4 border-b border-gray-800 bg-gray-900 shrink-0">
                        <div className="flex items-center justify-between mb-4"><h2 className="font-bold text-xl">Chats</h2><button onClick={openGroupModal} className="text-xs bg-purple-600 hover:bg-purple-500 px-3 py-1.5 rounded-full flex items-center gap-1 transition"><Plus className="w-3 h-3" /> New Group</button></div>
                        <div className="bg-gray-950 border border-gray-800 rounded-lg flex items-center px-3 py-2"><Search className="w-4 h-4 text-gray-500 mr-2" /><input className="bg-transparent outline-none text-sm w-full" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {filteredChats.map(chat => (<div key={chat.id} onClick={() => handleSelectChat(chat.id)} className={`p-4 flex items-center gap-3 hover:bg-gray-800 cursor-pointer border-b border-gray-800/50 ${activeChat?.id === chat.id ? 'bg-gray-800 border-l-4 border-l-purple-500' : ''}`}><div className="relative"><img src={chat.avatar || "https://github.com/shadcn.png"} className="w-12 h-12 rounded-full object-cover" />{chat.is_online && chat.type === 'user' && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-900"></div>}</div><div className="flex-1 overflow-hidden"><div className="flex justify-between items-center"><h4 className="font-bold text-sm truncate flex items-center gap-2">{chat.name || "Unknown"}{chat.type === "group" && chat.is_team_group && (<span className="bg-yellow-900/40 text-yellow-500 text-[9px] font-bold px-1.5 py-0.5 rounded border border-yellow-600/50 tracking-wider">OFFICIAL</span>)}</h4><span className="text-[10px] text-gray-500">{formatTime(chat.timestamp)}</span></div><div className="flex justify-between items-center mt-1"><p className="text-xs text-gray-400 truncate max-w-[70%]">{chat.last_message || "Start chatting..."}</p>{chat.unread_count > 0 && <span className="bg-purple-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{chat.unread_count}</span>}</div>{chat.type === 'group' && chat.member_count !== undefined && <p className="text-[10px] text-gray-500 mt-1 flex items-center gap-1"><Users className="w-3 h-3" /> {chat.member_count} members</p>}</div></div>))}
                    </div>
                </div>

                <div className="hidden md:flex flex-1 bg-gray-900 border border-gray-800 rounded-2xl flex-col overflow-hidden relative h-full shadow-lg">
                    {activeChat ? (
                        <>
                            <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900 z-10 shrink-0">
                                <div className="flex items-center gap-3 cursor-pointer hover:opacity-80" onClick={handleHeaderClick}>
                                    <img src={activeChat.avatar || "https://github.com/shadcn.png"} className="w-10 h-10 rounded-full" />
                                    <div><h3 className="font-bold flex items-center gap-2">{activeChat.name || "Unknown"}{activeChat.type === "group" && activeChat.is_team_group && <span className="text-yellow-500"><ShieldAlert className="w-3 h-3 inline" /></span>}</h3><span className="text-xs text-gray-400 flex items-center gap-1">{activeChat.type === 'group' ? <><Users className="w-3 h-3" /> {groupMembers.length} members</> : "View Profile"}</span></div>
                                </div>
                                <div className="relative"><button onClick={() => setShowChatMenu(!showChatMenu)} className="p-2 hover:bg-gray-800 rounded-full"><MoreVertical className="w-5 h-5 text-gray-400" /></button>{showChatMenu && (<div className="absolute right-0 top-10 bg-gray-800 border border-gray-700 rounded-lg shadow-xl w-48 z-20 overflow-hidden"><button onClick={handleHeaderClick} className="w-full text-left px-4 py-3 hover:bg-gray-700 text-sm flex items-center gap-2"><User className="w-4 h-4" /> View Info</button>{activeChat.type === 'user' && (chatStatus === 'blocked_by_me' ? <button onClick={() => handleAction('unblock')} className="w-full text-left px-4 py-3 hover:bg-gray-700 text-sm flex items-center gap-2 text-green-400"><Check className="w-4 h-4" /> Unblock</button> : <button onClick={() => handleAction('block')} className="w-full text-left px-4 py-3 hover:bg-gray-700 text-sm flex items-center gap-2 text-red-400"><Slash className="w-4 h-4" /> Block</button>)}</div>)}</div>
                            </div>

                            {chatStatus === 'pending_incoming' && (<div className="absolute top-20 left-4 right-4 z-20 bg-gray-800 border border-gray-700 p-4 rounded-xl flex items-center justify-between shadow-xl"><div className="flex items-center gap-3"><ShieldAlert className="w-6 h-6 text-yellow-400" /><div className="text-sm"><span className="font-bold text-white block">Message Request</span><span className="text-gray-400">Accept messages from {activeChat.name}?</span></div></div><div className="flex gap-2"><button onClick={() => handleAction('accept')} className="bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded text-sm font-bold flex items-center gap-1"><Check className="w-3 h-3" /> Accept</button><button onClick={() => handleAction('block')} className="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded text-sm font-bold flex items-center gap-1"><X className="w-3 h-3" /> Block</button></div></div>)}
                            {chatStatus === 'blocked_by_me' && (<div className="absolute top-20 left-4 right-4 z-20 bg-red-900/50 border border-red-500/50 p-4 rounded-xl flex items-center justify-between shadow-xl"><div className="flex items-center gap-3"><Lock className="w-6 h-6 text-red-400" /><div className="text-sm"><span className="font-bold text-white block">Blocked</span><span className="text-gray-400">You blocked this user.</span></div></div><button onClick={() => handleAction('unblock')} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2"><Unlock className="w-4 h-4" /> Unblock</button></div>)}

                            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-gray-900/50" ref={scrollRef}>
                                {messages.map((msg, i) => { const isMe = msg.sender_id === userId; return (<div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[70%] px-4 py-2 rounded-2xl ${isMe ? 'bg-purple-600 text-white rounded-br-none' : 'bg-gray-800 text-gray-200 rounded-bl-none'}`}>{!isMe && activeChat.type === 'group' && <p className="text-[10px] text-purple-300 font-bold mb-1 opacity-80">{msg.sender_name || "Member"}</p>}<p className="text-sm">{msg.content}</p><span className={`text-[10px] block text-right mt-1 ${isMe ? 'text-purple-200' : 'text-gray-500'}`}>{formatTime(msg.timestamp)}</span></div></div>); })}
                                {chatStatus === 'blocked_by_them' && <div className="text-center text-red-500 text-xs mt-4">This user is unavailable.</div>}
                            </div>

                            <div className="p-4 border-t border-gray-800 bg-gray-900 shrink-0">
                                {['blocked_by_me', 'blocked_by_them', 'pending_incoming'].includes(chatStatus) ? <div className="text-center text-gray-500 text-sm bg-gray-950 p-3 rounded-xl flex items-center justify-center gap-2"><Lock className="w-4 h-4" /> Chat is locked.</div> : <div className="flex gap-2"><input className="flex-1 bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 outline-none focus:border-purple-500 transition" placeholder="Type a message..." value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} /><button onClick={sendMessage} className="bg-purple-600 hover:bg-purple-500 text-white p-3 rounded-xl transition"><Send className="w-5 h-5" /></button></div>}
                            </div>

                            <AnimatePresence>
                                {showGroupInfo && activeChat.type === 'group' && (<motion.div initial={{ x: 300 }} animate={{ x: 0 }} exit={{ x: 300 }} className="absolute top-0 right-0 h-full w-72 bg-gray-900 border-l border-gray-800 z-30 p-4 shadow-2xl overflow-y-auto custom-scrollbar"><div className="flex justify-between items-center mb-6"><h3 className="font-bold">Team Members</h3><button onClick={() => setShowGroupInfo(false)}><X className="w-4 h-4 text-gray-500 hover:text-white" /></button></div><div className="space-y-3">{groupMembers.map(m => (<div key={m.id} onClick={() => { if (m.id !== userId) handleSelectChat(m.id); }} className={`flex items-center gap-3 p-2 rounded-lg ${m.id !== userId ? 'hover:bg-gray-800 cursor-pointer' : 'opacity-50'}`}><img src={m.avatar_url || "https://github.com/shadcn.png"} className="w-8 h-8 rounded-full" /><span className="text-sm font-medium">{m.username} {m.id === userId && "(You)"}</span>{m.id === activeChat.admin_id && <span className="text-[10px] text-yellow-500 ml-2 font-mono">ADMIN</span>}</div>))}</div></motion.div>)}
                            </AnimatePresence>

                            <AnimatePresence>
                                {showProfileInfo && activeUserProfile && activeChat.type === 'user' && (
                                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="absolute inset-0 bg-black/60 z-40 flex items-center justify-center p-4">
                                        <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-sm p-6 relative shadow-2xl">
                                            <button onClick={() => setShowProfileInfo(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
                                            <div className="flex flex-col items-center mb-6">
                                                <img src={activeUserProfile.avatar_url} className="w-24 h-24 rounded-full border-4 border-gray-800 shadow-lg mb-4" />
                                                <h2 className="text-2xl font-bold">{activeUserProfile.username}</h2>
                                                <p className="text-gray-400 text-sm">{activeUserProfile.email}</p>
                                                <div className="mt-2 bg-purple-900/30 text-purple-400 px-3 py-1 rounded-full text-xs font-bold border border-purple-500/30">Trust Score: {activeUserProfile.trust_score.toFixed(1)}</div>
                                            </div>

                                            {/* NEW: SEE FULL PROFILE BUTTON */}
                                            <button
                                                onClick={() => router.push(`/profile/${activeUserProfile.id || activeUserProfile._id}`)}
                                                className="w-full mb-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition"
                                            >
                                                <UserIcon className="w-4 h-4" /> See Full Profile
                                            </button>

                                            <div className="space-y-4">
                                                <div><h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Skills</h4><div className="flex flex-wrap gap-2">{activeUserProfile.skills.map((s, i) => <span key={i} className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-300 border border-gray-700">{s.name}</span>)}</div></div>
                                                <div><h4 className="text-xs font-bold text-gray-500 uppercase mb-2">About</h4><p className="text-sm text-gray-300 leading-relaxed truncate">{activeUserProfile.about || "No bio available."}</p></div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Group Details Modal (Info/Edit/Leave/Block) */}
                            {showInfoModal && groupDetails && (
                                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                                    <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-gray-900 border border-gray-800 p-6 rounded-2xl w-full max-w-md">
                                        <div className="flex justify-between items-start mb-6">
                                            <div><h2 className="text-xl font-bold">Group Details</h2>{groupDetails.is_team_group && <p className="text-xs text-blue-400 mt-1">Official Team Chat</p>}</div>
                                            <button onClick={() => setShowInfoModal(false)}><X className="text-gray-500 hover:text-white" /></button>
                                        </div>
                                        <div className="mb-6"><label className="text-xs text-gray-500 uppercase font-bold">Group Name</label><div className="flex gap-2 mt-1"><input className="flex-1 bg-gray-950 border border-gray-800 rounded-lg p-2 outline-none" value={editingGroupName} onChange={e => setEditingGroupName(e.target.value)} disabled={groupDetails.admin_id !== (userId)} />{groupDetails.admin_id === (userId) && (<button onClick={updateGroup} className="bg-gray-800 p-2 rounded hover:text-green-400"><Check className="w-4 h-4" /></button>)}</div></div>
                                        <div className="mb-6"><div className="flex justify-between items-center mb-2"><label className="text-xs text-gray-500 uppercase font-bold">Members ({groupDetails.members.length})</label>{groupDetails.admin_id === (userId) && (<button onClick={() => { setShowInfoModal(false); openAddMemberModal(); }} className="text-xs text-purple-400 hover:text-white flex items-center gap-1"><Plus className="w-3 h-3" /> Add Member</button>)}</div><div className="max-h-40 overflow-y-auto space-y-2">{groupDetails.members.map(m => (<div key={m.id} className="flex justify-between items-center bg-gray-800 p-2 rounded"><div className="flex items-center gap-2"><img src={m.avatar_url} className="w-6 h-6 rounded-full" /><span className="text-sm">{m.username}</span>{m.id === groupDetails.admin_id && <span className="text-[10px] text-yellow-500 font-mono">ADMIN</span>}</div>{groupDetails.admin_id === (userId) && m.id !== groupDetails.admin_id && (<button onClick={() => removeGroupMember(m.id)} className="text-gray-500 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>)}</div>))}</div></div>

                                        {/* Leave / Block Actions */}
                                        <div className="flex gap-3 pt-4 border-t border-gray-800">
                                            <button onClick={leaveGroup} className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-bold flex items-center justify-center gap-2"><LogOut className="w-4 h-4" /> Leave Group</button>
                                            <button onClick={blockGroup} className="flex-1 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-900/50 rounded-lg text-sm font-bold flex items-center justify-center gap-2"><Ban className="w-4 h-4" /> Block & Leave</button>
                                        </div>
                                    </motion.div>
                                </div>
                            )}

                            {/* ... (Create Group Modal / Add Member Modal logic remains the same) ... */}
                            <AnimatePresence>{showGroupModal && (<div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"><motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-gray-900 border border-gray-800 p-6 rounded-2xl w-full max-w-md"><h2 className="text-xl font-bold mb-4">Create Group Chat</h2><input className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 mb-4 outline-none" placeholder="Group Name" value={groupName} onChange={e => setGroupName(e.target.value)} /><p className="text-sm text-gray-400 mb-2">Select Members:</p><div className="max-h-40 overflow-y-auto space-y-2 mb-4 custom-scrollbar">{contacts.map(c => (<div key={c.id} onClick={() => toggleContact(c.id)} className={`p-2 rounded cursor-pointer flex items-center justify-between ${selectedContacts.includes(c.id) ? "bg-purple-900/50 border border-purple-500" : "bg-gray-800"}`}><div className="flex items-center gap-2"><img src={c.avatar_url} className="w-6 h-6 rounded-full" /><span>{c.username}</span></div>{selectedContacts.includes(c.id) && <Check className="w-4 h-4 text-purple-400" />}</div>))}</div><div className="flex gap-2"><button onClick={createGroup} className="flex-1 bg-purple-600 text-white py-2 rounded-lg font-bold">Create</button><button onClick={() => setShowGroupModal(false)} className="flex-1 bg-gray-800 text-gray-400 py-2 rounded-lg">Cancel</button></div></motion.div></div>)}</AnimatePresence>
                            <AnimatePresence>{showAddMemberModal && (<div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"><motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-gray-900 border border-gray-800 p-6 rounded-2xl w-full max-w-sm"><h2 className="text-lg font-bold mb-4">Add Member</h2><div className="max-h-60 overflow-y-auto space-y-2 mb-4 custom-scrollbar">{contacts.length === 0 ? <p className="text-gray-500">No new contacts to add.</p> : contacts.map(c => (<div key={c.id} onClick={() => addToGroup(c.id)} className="p-2 rounded cursor-pointer flex items-center gap-2 bg-gray-800 hover:bg-gray-700"><img src={c.avatar_url} className="w-6 h-6 rounded-full" /><span>{c.username}</span><Plus className="w-4 h-4 ml-auto text-green-400" /></div>))}</div><button onClick={() => setShowAddMemberModal(false)} className="w-full bg-gray-800 text-white py-2 rounded-lg">Cancel</button></motion.div></div>)}</AnimatePresence>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500"><MessageSquare className="w-16 h-16 mb-4 opacity-20" /><p>Select a chat to start messaging</p></div>
                    )}
                </div>
            </div>
        </div>
    );
}