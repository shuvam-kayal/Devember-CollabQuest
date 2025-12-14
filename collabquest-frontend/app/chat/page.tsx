"use client";
import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Cookies from "js-cookie";
import axios from "axios";
import { Send, Search, MessageSquare, Loader2, ArrowLeft, X, Users, Plus, Check, ShieldCheck, Settings, Trash2, Edit2 } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

// ... Interfaces ...
interface ChatEntity {
    id: string;
    username: string;
    avatar_url: string;
    is_online?: boolean; 
    unread_count?: number; 
    type: "user" | "group";
    admin_id?: string;
}

interface Message {
    sender_id: string;
    sender_name?: string;
    recipient_id: string;
    content: string;
    timestamp: string;
}

interface FullUserProfile {
    username: string;
    avatar_url: string;
    trust_score: number;
    is_verified_student: boolean;
    skills: { name: string; level: string }[];
}

interface GroupDetails {
    id: string;
    name: string;
    avatar_url: string;
    admin_id: string;
    is_team_group: boolean;
    members: { id: string, username: string, avatar_url: string }[];
}

export default function ChatPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [conversations, setConversations] = useState<ChatEntity[]>([]);
    const [activeChat, setActiveChat] = useState<ChatEntity | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputMessage, setInputMessage] = useState("");
    const [socket, setSocket] = useState<WebSocket | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    
    // Modals
    const [showGroupModal, setShowGroupModal] = useState(false); // Create
    const [showInfoModal, setShowInfoModal] = useState(false); // View/Edit
    const [showAddMemberModal, setShowAddMemberModal] = useState(false); // Add to existing

    const [contacts, setContacts] = useState<any[]>([]);
    const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
    const [groupName, setGroupName] = useState("");
    
    const [viewingProfile, setViewingProfile] = useState<FullUserProfile | null>(null);
    const [groupDetails, setGroupDetails] = useState<GroupDetails | null>(null);
    const [editingGroupName, setEditingGroupName] = useState("");

    const scrollRef = useRef<HTMLDivElement>(null);
    const isFetchingRef = useRef(false);
    const loadedIdsRef = useRef<Set<string>>(new Set());
    const [loadingChat, setLoadingChat] = useState(false);
    const activeChatRef = useRef<ChatEntity | null>(null);

    useEffect(() => { activeChatRef.current = activeChat; }, [activeChat]);

    useEffect(() => {
        const token = Cookies.get("token");
        if (!token) return router.push("/");

        axios.get("http://localhost:8000/users/me", { headers: { Authorization: `Bearer ${token}` } })
            .then(res => {
                const myData = res.data;
                setCurrentUser(myData);
                connectWebSocket(myData._id || myData.id);
            });

        fetchConversations(token);
        const interval = setInterval(() => fetchConversations(token, true), 5000);
        return () => clearInterval(interval);
    }, []);

    // ... (fetchConversations Logic - Same as before) ...
    const fetchConversations = async (token: string, isBackgroundUpdate = false) => {
        try {
            const res = await axios.get("http://localhost:8000/chat/conversations", { headers: { Authorization: `Bearer ${token}` } });
            if (isBackgroundUpdate) {
                setConversations(prev => prev.map(c => {
                    const updated = res.data.find((u: any) => u.id === c.id);
                    return updated ? { ...c, is_online: updated.is_online, unread_count: updated.unread_count } : c;
                }));
                return;
            }
            setConversations(res.data);
            res.data.forEach((c: any) => loadedIdsRef.current.add(c.id));

            const tid = searchParams.get("targetId");
            if (tid) {
                const existing = res.data.find((c: any) => c.id === tid);
                if (existing) setActiveChat(existing);
                else if (!loadedIdsRef.current.has(tid) && !isFetchingRef.current) {
                    isFetchingRef.current = true;
                    setLoadingChat(true);
                    loadedIdsRef.current.add(tid);
                    try {
                        const userRes = await axios.get(`http://localhost:8000/users/${tid}`, { headers: { Authorization: `Bearer ${token}` } });
                        const newUser = { id: userRes.data._id || userRes.data.id, username: userRes.data.username, avatar_url: userRes.data.avatar_url || "https://github.com/shadcn.png", is_online: false, type: "user" as const, unread_count: 0 };
                        setConversations(prev => [newUser, ...prev]);
                        setActiveChat(newUser);
                    } catch (e) { console.error(e); } 
                    finally { setLoadingChat(false); isFetchingRef.current = false; }
                }
            }
        } catch (e) { console.error(e); }
    };

    // --- GROUP MANAGEMENT LOGIC ---

    const handleHeaderClick = async () => {
        if (!activeChat) return;
        const token = Cookies.get("token");
        if (activeChat.type === "user") {
            try {
                const res = await axios.get(`http://localhost:8000/users/${activeChat.id}`, { headers: { Authorization: `Bearer ${token}` } });
                setViewingProfile(res.data);
            } catch (e) { console.error(e); }
        } else {
            // Fetch Group Details
            try {
                const res = await axios.get(`http://localhost:8000/chat/groups/${activeChat.id}`, { headers: { Authorization: `Bearer ${token}` } });
                setGroupDetails(res.data);
                setEditingGroupName(res.data.name);
                setShowInfoModal(true);
            } catch (e) { console.error(e); }
        }
    };

    const updateGroup = async () => {
        if (!groupDetails || !editingGroupName) return;
        const token = Cookies.get("token");
        try {
            await axios.put(`http://localhost:8000/chat/groups/${groupDetails.id}`, { name: editingGroupName }, { headers: { Authorization: `Bearer ${token}` } });
            setGroupDetails({ ...groupDetails, name: editingGroupName });
            fetchConversations(token!);
            alert("Group updated!");
        } catch (e) { alert("Update failed"); }
    };

    const removeGroupMember = async (userId: string) => {
        if (!groupDetails) return;
        const token = Cookies.get("token");
        try {
            await axios.delete(`http://localhost:8000/chat/groups/${groupDetails.id}/members/${userId}`, { headers: { Authorization: `Bearer ${token}` } });
            // Refresh details
            const res = await axios.get(`http://localhost:8000/chat/groups/${groupDetails.id}`, { headers: { Authorization: `Bearer ${token}` } });
            setGroupDetails(res.data);
        } catch (e) { alert("Failed to remove member"); }
    };
    
    // Add Member to Existing Group
    const openAddMemberModal = async () => {
        const token = Cookies.get("token");
        try {
            const res = await axios.get("http://localhost:8000/chat/contacts", { headers: { Authorization: `Bearer ${token}` } });
            // Filter out existing members
            const existingIds = groupDetails?.members.map(m => m.id) || [];
            setContacts(res.data.filter((c: any) => !existingIds.includes(c.id)));
            setShowAddMemberModal(true);
        } catch(e) { alert("Failed"); }
    };

    const addToGroup = async (userId: string) => {
        if (!groupDetails) return;
        const token = Cookies.get("token");
        try {
            await axios.put(`http://localhost:8000/chat/groups/${groupDetails.id}/members`, { user_id: userId }, { headers: { Authorization: `Bearer ${token}` } });
            setShowAddMemberModal(false);
            const res = await axios.get(`http://localhost:8000/chat/groups/${groupDetails.id}`, { headers: { Authorization: `Bearer ${token}` } });
            setGroupDetails(res.data);
        } catch (e) { alert("Failed to add member"); }
    }


    // --- STANDARD CHAT LOGIC (Same as before) ---
    useEffect(() => {
        if (!activeChat) return;
        const token = Cookies.get("token");
        setConversations(prev => prev.map(c => c.id === activeChat.id ? { ...c, unread_count: 0 } : c));
        axios.get(`http://localhost:8000/chat/history/${activeChat.id}`, { headers: { Authorization: `Bearer ${token}` } }).then(res => { setMessages(res.data); scrollToBottom(); });
    }, [activeChat]);

    const connectWebSocket = (userId: string) => {
        if (socket) return;
        const ws = new WebSocket(`ws://localhost:8000/chat/ws/${userId}`);
        ws.onmessage = (event) => {
            try {
                const newMsg = JSON.parse(event.data);
                const currentChat = activeChatRef.current;
                if (currentChat) {
                     const isGroupMsg = currentChat.type === "group" && newMsg.recipient_id === currentChat.id;
                     const isUserMsg = currentChat.type === "user" && (newMsg.sender_id === currentChat.id || newMsg.recipient_id === currentChat.id);
                     if (isGroupMsg || isUserMsg) { setMessages(prev => [...prev, newMsg]); scrollToBottom(); } 
                     else { setConversations(prev => prev.map(c => { const isMsgForThis = (c.type === 'group' && newMsg.recipient_id === c.id) || (c.type === 'user' && newMsg.sender_id === c.id); return isMsgForThis ? { ...c, unread_count: (c.unread_count || 0) + 1 } : c; })); }
                }
            } catch (e) { console.error(e); }
        };
        setSocket(ws);
    };

    const sendMessage = () => { if (!inputMessage.trim() || !activeChat || !socket || !currentUser) return; const payload = { recipient_id: activeChat.id, content: inputMessage }; socket.send(JSON.stringify(payload)); const myMsg = { sender_id: currentUser._id || currentUser.id, sender_name: currentUser.username, recipient_id: activeChat.id, content: inputMessage, timestamp: new Date().toISOString() }; setMessages(prev => [...prev, myMsg]); setInputMessage(""); scrollToBottom(); };
    const scrollToBottom = () => { setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100); };
    
    // Group Creation Helpers
    const openGroupModal = async () => { const token = Cookies.get("token"); try { const res = await axios.get("http://localhost:8000/chat/contacts", { headers: { Authorization: `Bearer ${token}` } }); setContacts(res.data); setShowGroupModal(true); } catch(e) { alert("Failed to load contacts"); } };
    const toggleContact = (id: string) => { if (selectedContacts.includes(id)) setSelectedContacts(prev => prev.filter(c => c !== id)); else setSelectedContacts(prev => [...prev, id]); };
    const createGroup = async () => { if (!groupName || selectedContacts.length === 0) return alert("Invalid group"); const token = Cookies.get("token"); try { await axios.post("http://localhost:8000/chat/groups", { name: groupName, member_ids: selectedContacts }, { headers: { Authorization: `Bearer ${token}` } }); setShowGroupModal(false); setGroupName(""); setSelectedContacts([]); fetchConversations(token!); } catch (e) { alert("Failed"); } };

    const getScoreColor = (score: number) => { if (score >= 8) return "text-green-400"; if (score >= 5) return "text-yellow-400"; return "text-red-400"; };
    const filteredConversations = conversations.filter(c => c.username.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <div className="flex h-screen bg-black text-white overflow-hidden">
            {/* SIDEBAR */}
            <div className="w-1/3 bg-gray-900 border-r border-gray-800 flex flex-col">
                <div className="p-4 border-b border-gray-800"><div className="flex items-center justify-between mb-4"><Link href="/dashboard" className="text-gray-400 hover:text-white flex items-center gap-2 text-sm font-bold"><ArrowLeft className="w-4 h-4"/> Dashboard</Link><button onClick={openGroupModal} className="text-xs bg-purple-600 hover:bg-purple-500 px-3 py-1 rounded-full flex items-center gap-1"><Plus className="w-3 h-3"/> New Group</button></div><h1 className="text-xl font-bold mb-4">Chats</h1><div className="relative"><input className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 pl-9 outline-none focus:border-purple-500" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /><Search className="w-4 h-4 text-gray-500 absolute left-3 top-3" /></div></div>
                <div className="flex-1 overflow-y-auto">{filteredConversations.map(c => (<div key={c.id} onClick={() => setActiveChat(c)} className={`p-4 flex items-center gap-3 cursor-pointer hover:bg-gray-800 transition ${activeChat?.id === c.id ? "bg-gray-800 border-l-4 border-purple-500" : ""}`}><div className="relative"><img src={c.avatar_url} className="w-10 h-10 rounded-full bg-gray-700" />{c.type === "user" && c.is_online && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-900"></div>}</div><div className="flex-1"><div className="flex justify-between items-center"><h3 className="font-bold text-sm flex items-center gap-2">{c.username}{c.type === "group" && <Users className="w-3 h-3 text-gray-500"/>}</h3>{c.unread_count && c.unread_count > 0 ? <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{c.unread_count}</span> : null}</div><p className="text-xs text-gray-500">Click to chat</p></div></div>))}</div>
            </div>

            {/* CHAT AREA */}
            <div className="flex-1 flex flex-col bg-gray-950">
                {activeChat ? (
                    <>
                        <div className="p-4 border-b border-gray-800 bg-gray-900 flex items-center justify-between">
                            <div className="flex items-center gap-3 cursor-pointer" onClick={handleHeaderClick}>
                                <img src={activeChat.avatar_url} className="w-10 h-10 rounded-full" />
                                <div><h2 className="font-bold flex items-center gap-2">{activeChat.username}{activeChat.type === "group" && <span className="text-[10px] bg-gray-700 px-2 rounded text-gray-300">GROUP</span>}</h2>{activeChat.type === "user" && (activeChat.is_online ? <span className="text-xs text-green-400 flex items-center gap-1">● Online</span> : <span className="text-xs text-gray-500">○ Offline</span>)}</div>
                            </div>
                            <button onClick={() => setActiveChat(null)}><X className="w-5 h-5 text-gray-500 hover:text-white"/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">{messages.map((m, i) => { const isMe = m.sender_id === (currentUser?._id || currentUser?.id); return (<div key={i} className={`flex ${isMe ? "justify-end" : "justify-start"}`}><div className={`max-w-md p-3 rounded-2xl text-sm ${isMe ? "bg-purple-600 text-white rounded-br-none" : "bg-gray-800 text-gray-200 rounded-bl-none"}`}>{activeChat.type === "group" && !isMe && <p className="text-[10px] text-gray-300 mb-1 font-bold">{m.sender_name || `User ${m.sender_id.slice(-4)}`}</p>}{m.content}</div></div>); })}<div ref={scrollRef} /></div>
                        <div className="p-4 bg-gray-900 border-t border-gray-800 flex gap-2"><input className="flex-1 bg-gray-950 border border-gray-800 rounded-full px-4 py-2 outline-none focus:border-purple-500" placeholder="Type a message..." value={inputMessage} onChange={e => setInputMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} /><button onClick={sendMessage} className="p-2 bg-purple-600 rounded-full hover:bg-purple-500 text-white"><Send className="w-5 h-5" /></button></div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-600"><MessageSquare className="w-16 h-16 mb-4 opacity-50" /><p>{loadingChat ? "Loading chat..." : "Select a conversation to start chatting"}</p></div>
                )}
            </div>

            {/* Modals */}
            <AnimatePresence>
                {/* 1. Create Group Modal */}
                {showGroupModal && (<div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"><motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-gray-900 border border-gray-800 p-6 rounded-2xl w-full max-w-md"><h2 className="text-xl font-bold mb-4">Create Group Chat</h2><input className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 mb-4 outline-none" placeholder="Group Name" value={groupName} onChange={e => setGroupName(e.target.value)} /><p className="text-sm text-gray-400 mb-2">Select Members:</p><div className="max-h-40 overflow-y-auto space-y-2 mb-4">{contacts.map(c => (<div key={c.id} onClick={() => toggleContact(c.id)} className={`p-2 rounded cursor-pointer flex items-center justify-between ${selectedContacts.includes(c.id) ? "bg-purple-900/50 border border-purple-500" : "bg-gray-800"}`}><div className="flex items-center gap-2"><img src={c.avatar_url} className="w-6 h-6 rounded-full"/><span>{c.username}</span></div>{selectedContacts.includes(c.id) && <Check className="w-4 h-4 text-purple-400"/>}</div>))}</div><div className="flex gap-2"><button onClick={createGroup} className="flex-1 bg-purple-600 text-white py-2 rounded-lg font-bold">Create</button><button onClick={() => setShowGroupModal(false)} className="flex-1 bg-gray-800 text-gray-400 py-2 rounded-lg">Cancel</button></div></motion.div></div>)}
                
                {/* 2. User Profile Modal */}
                {viewingProfile && (<div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"><motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-gray-900 border border-gray-800 p-8 rounded-2xl w-full max-w-sm relative shadow-2xl"><button onClick={() => setViewingProfile(null)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X className="w-5 h-5"/></button><div className="flex flex-col items-center text-center"><img src={viewingProfile.avatar_url || "https://github.com/shadcn.png"} className="w-24 h-24 rounded-full border-4 border-gray-800 mb-4 shadow-lg" /><h2 className="text-2xl font-bold">{viewingProfile.username}</h2>{viewingProfile.is_verified_student && <span className="text-xs text-green-400 font-mono mt-1 mb-4 block">Verified Hacker</span>}<div className="flex items-center gap-2 bg-black/40 px-4 py-2 rounded-full border border-gray-800 mb-6"><ShieldCheck className={getScoreColor(viewingProfile.trust_score) + " w-5 h-5"} /><div className="text-left"><p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Trust Score</p><p className="text-sm font-bold leading-none">{viewingProfile.trust_score.toFixed(1)} / 10.0</p></div></div><div className="w-full text-left"><p className="text-xs text-gray-500 uppercase font-bold mb-3">Top Skills</p><div className="flex flex-wrap gap-2">{viewingProfile.skills.length > 0 ? viewingProfile.skills.map((s, i) => <span key={i} className="text-xs bg-gray-800 px-3 py-1 rounded-full text-gray-300 border border-gray-700">{s.name}</span>) : <span className="text-gray-600 text-sm italic">No skills listed.</span>}</div></div></div></motion.div></div>)}
                
                {/* 3. Group Info / Management Modal */}
                {showInfoModal && groupDetails && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                        <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-gray-900 border border-gray-800 p-6 rounded-2xl w-full max-w-md">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h2 className="text-xl font-bold">Group Details</h2>
                                    {groupDetails.is_team_group && <p className="text-xs text-blue-400 mt-1">Official Team Chat</p>}
                                </div>
                                <button onClick={() => setShowInfoModal(false)}><X className="text-gray-500 hover:text-white"/></button>
                            </div>

                            {/* Editable Name */}
                            <div className="mb-6">
                                <label className="text-xs text-gray-500 uppercase font-bold">Group Name</label>
                                <div className="flex gap-2 mt-1">
                                    <input 
                                        className="flex-1 bg-gray-950 border border-gray-800 rounded-lg p-2 outline-none" 
                                        value={editingGroupName} 
                                        onChange={e => setEditingGroupName(e.target.value)}
                                        disabled={groupDetails.admin_id !== (currentUser?._id || currentUser?.id)}
                                    />
                                    {groupDetails.admin_id === (currentUser?._id || currentUser?.id) && (
                                        <button onClick={updateGroup} className="bg-gray-800 p-2 rounded hover:text-green-400"><Check className="w-4 h-4"/></button>
                                    )}
                                </div>
                            </div>

                            {/* Members List */}
                            <div className="mb-6">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs text-gray-500 uppercase font-bold">Members ({groupDetails.members.length})</label>
                                    {groupDetails.admin_id === (currentUser?._id || currentUser?.id) && (
                                        <button onClick={() => { setShowInfoModal(false); openAddMemberModal(); }} className="text-xs text-purple-400 hover:text-white flex items-center gap-1">
                                            <Plus className="w-3 h-3"/> Add Member
                                        </button>
                                    )}
                                </div>
                                <div className="max-h-40 overflow-y-auto space-y-2">
                                    {groupDetails.members.map(m => (
                                        <div key={m.id} className="flex justify-between items-center bg-gray-800 p-2 rounded">
                                            <div className="flex items-center gap-2">
                                                <img src={m.avatar_url} className="w-6 h-6 rounded-full"/>
                                                <span className="text-sm">{m.username}</span>
                                                {m.id === groupDetails.admin_id && <span className="text-[10px] text-yellow-500 font-mono">ADMIN</span>}
                                            </div>
                                            {/* Remove Button (Admin only, cannot remove self) */}
                                            {groupDetails.admin_id === (currentUser?._id || currentUser?.id) && m.id !== groupDetails.admin_id && (
                                                <button onClick={() => removeGroupMember(m.id)} className="text-gray-500 hover:text-red-500">
                                                    <Trash2 className="w-4 h-4"/>
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
                
                {/* 4. Add Member Modal */}
                {showAddMemberModal && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                        <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-gray-900 border border-gray-800 p-6 rounded-2xl w-full max-w-sm">
                            <h2 className="text-lg font-bold mb-4">Add Member</h2>
                            <div className="max-h-60 overflow-y-auto space-y-2 mb-4">
                                {contacts.length === 0 ? <p className="text-gray-500">No new contacts to add.</p> : contacts.map(c => (
                                    <div key={c.id} onClick={() => addToGroup(c.id)} className="p-2 rounded cursor-pointer flex items-center gap-2 bg-gray-800 hover:bg-gray-700">
                                        <img src={c.avatar_url} className="w-6 h-6 rounded-full"/>
                                        <span>{c.username}</span>
                                        <Plus className="w-4 h-4 ml-auto text-green-400"/>
                                    </div>
                                ))}
                            </div>
                            <button onClick={() => setShowAddMemberModal(false)} className="w-full bg-gray-800 text-white py-2 rounded-lg">Cancel</button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}