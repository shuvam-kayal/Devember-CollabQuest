"use client";
import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Cookies from "js-cookie";
import api from "@/lib/api";
import { 
    Send, User, MessageSquare, Users, MoreVertical, UserIcon, Search, 
    ShieldAlert, Check, X, Lock, LogOut, Plus, Trash2, Ban, 
    Paperclip, File, Film, Music, Video, Phone, Mic, MicOff, VideoOff, PhoneOff, Monitor, MonitorOff, ChevronLeft
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// --- INTERFACES ---
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
    admin_id?: string;
}

interface Attachment {
    url: string;
    file_type: "image" | "video" | "audio" | "document";
    name: string;
}

interface Message { 
    sender_id: string; 
    recipient_id?: string; 
    content: string; 
    timestamp: string; 
    sender_name?: string; 
    attachments?: Attachment[];
}

interface UserDetail {
    id: string;
    _id?: string;
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
const rtcConfig = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

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

    // Attachments State
    const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Call State
    const [isInCall, setIsInCall] = useState(false);
    const [incomingCall, setIncomingCall] = useState<{ sender_id: string, offer: any, callType: 'video'|'audio' } | null>(null);
    const [callType, setCallType] = useState<'video'|'audio'>('video');
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    
    // WebRTC Refs
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const peerConnection = useRef<RTCPeerConnection | null>(null);
    const localStream = useRef<MediaStream | null>(null);
    const screenStreamRef = useRef<MediaStream | null>(null); 

    const activeChatRef = useRef<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

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
    const [groupName, setGroupName] = useState("");
    const [editingGroupName, setEditingGroupName] = useState("");
    const [contacts, setContacts] = useState<any[]>([]);
    const [selectedContacts, setSelectedContacts] = useState<string[]>([]);

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
        socket.onmessage = async (event) => {
            const data = JSON.parse(event.data);
            
            if (data.event === 'offer') {
                if (isInCall) return; 
                setIncomingCall({ sender_id: data.sender_id, offer: data.data.offer, callType: data.data.callType });
            } 
            else if (data.event === 'answer') {
                if (peerConnection.current && peerConnection.current.signalingState !== "stable") {
                    await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.data));
                }
            }
            else if (data.event === 'ice-candidate') {
                if (peerConnection.current) {
                    try { await peerConnection.current.addIceCandidate(new RTCIceCandidate(data.data)); } catch(e) { }
                }
            }
            else if (data.event === 'hang-up') { endCall(); }
            else if (data.event === "message") {
                const incomingMsg = data.message;
                const currentChatId = activeChatRef.current;
                const isRelevantChat = currentChatId && (incomingMsg.sender_id === currentChatId || incomingMsg.recipient_id === currentChatId);
                if (isRelevantChat) {
                    setMessages(prev => [...prev, incomingMsg]);
                    api.post(`/chat/read/${currentChatId}`, {}).then(() => window.dispatchEvent(new Event("triggerNotificationRefresh")));
                } else {
                    fetchChatList();
                    window.dispatchEvent(new Event("triggerNotificationRefresh"));
                }
            }
        };
        setWs(socket);
    };

    const startCall = async (type: 'video' | 'audio') => {
        if (!activeChat || !ws) return;
        setIsInCall(true); setCallType(type); setIsMuted(false); setIsCameraOff(false);
        peerConnection.current = new RTCPeerConnection(rtcConfig);
        peerConnection.current.onicecandidate = (event) => {
            if (event.candidate) ws.send(JSON.stringify({ event: 'ice-candidate', recipient_id: activeChat.id, data: event.candidate }));
        };
        peerConnection.current.ontrack = (event) => {
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
        };
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: type === 'video', audio: true });
            localStream.current = stream;
            if (localVideoRef.current) localVideoRef.current.srcObject = type === 'video' ? stream : null;
            stream.getTracks().forEach(track => peerConnection.current?.addTrack(track, stream));
            const offer = await peerConnection.current.createOffer();
            await peerConnection.current.setLocalDescription(offer);
            ws.send(JSON.stringify({ event: 'offer', recipient_id: activeChat.id, data: { offer, callType: type } }));
        } catch (err) { endCall(); alert("Could not access camera/microphone."); }
    };

    const acceptCall = async () => {
        if (!incomingCall || !ws) return;
        setIsInCall(true); setCallType(incomingCall.callType); setIsMuted(false); setIsCameraOff(false);
        if (activeChat?.id !== incomingCall.sender_id) handleSelectChat(incomingCall.sender_id);
        peerConnection.current = new RTCPeerConnection(rtcConfig);
        peerConnection.current.onicecandidate = (event) => {
            if (event.candidate) ws.send(JSON.stringify({ event: 'ice-candidate', recipient_id: incomingCall.sender_id, data: event.candidate }));
        };
        peerConnection.current.ontrack = (event) => {
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
        };
        try {
            await peerConnection.current.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
            const stream = await navigator.mediaDevices.getUserMedia({ video: incomingCall.callType === 'video', audio: true });
            localStream.current = stream;
            if (localVideoRef.current) localVideoRef.current.srcObject = incomingCall.callType === 'video' ? stream : null;
            stream.getTracks().forEach(track => peerConnection.current?.addTrack(track, stream));
            const answer = await peerConnection.current.createAnswer();
            await peerConnection.current.setLocalDescription(answer);
            ws.send(JSON.stringify({ event: 'answer', recipient_id: incomingCall.sender_id, data: answer }));
            setIncomingCall(null);
        } catch (err) { endCall(); }
    };

    const endCall = () => {
        if (localStream.current) localStream.current.getTracks().forEach(track => track.stop());
        if (screenStreamRef.current) screenStreamRef.current.getTracks().forEach(track => track.stop());
        if (peerConnection.current) peerConnection.current.close();
        if (ws && activeChat && isInCall) ws.send(JSON.stringify({ event: 'hang-up', recipient_id: activeChat.id }));
        peerConnection.current = null; localStream.current = null; screenStreamRef.current = null;
        setIsInCall(false); setIncomingCall(null); setIsScreenSharing(false);
    };

    const toggleScreenShare = async () => {
        if (!peerConnection.current || !localStream.current) return;
        if (isScreenSharing) {
            try {
                if (screenStreamRef.current) { screenStreamRef.current.getTracks().forEach(track => track.stop()); screenStreamRef.current = null; }
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                const videoTrack = stream.getVideoTracks()[0];
                const audioTrack = stream.getAudioTracks()[0];
                audioTrack.enabled = !isMuted; videoTrack.enabled = !isCameraOff; 
                const videoSender = peerConnection.current.getSenders().find(s => s.track?.kind === 'video');
                if (videoSender) videoSender.replaceTrack(videoTrack);
                const audioSender = peerConnection.current.getSenders().find(s => s.track?.kind === 'audio');
                if (audioSender) audioSender.replaceTrack(audioTrack);
                localStream.current = stream; 
                if (localVideoRef.current) localVideoRef.current.srcObject = stream;
                setIsScreenSharing(false);
            } catch(e) { console.error("Error reverting to camera", e); }
        } else {
            try {
                const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                const screenTrack = stream.getVideoTracks()[0];
                screenStreamRef.current = stream; 
                const sender = peerConnection.current.getSenders().find(s => s.track?.kind === 'video');
                if (sender) sender.replaceTrack(screenTrack);
                screenTrack.onended = () => toggleScreenShare(); 
                if (localVideoRef.current) localVideoRef.current.srcObject = stream;
                setIsScreenSharing(true);
            } catch (err: any) { console.error("Screen share error:", err); }
        }
    };

    const toggleMute = () => { if (localStream.current) { const state = !isMuted; localStream.current.getAudioTracks().forEach(t => t.enabled = !state); setIsMuted(state); } };
    const toggleCamera = () => { if (localStream.current) { const state = !isCameraOff; localStream.current.getVideoTracks().forEach(t => t.enabled = !state); setIsCameraOff(state); } };

    // --- CHAT LOGIC ---
    const fetchChatList = async () => { try { const res = await api.get("/chat/conversations"); const mapped = res.data.map((c: any) => ({ id: c.id, name: c.username || "Unknown", type: c.type, avatar: c.avatar_url || "https://github.com/shadcn.png", last_message: c.last_message || "", timestamp: c.last_timestamp, unread_count: c.unread_count || 0, is_online: c.is_online, member_count: c.member_count, is_team_group: c.is_team_group, admin_id: c.admin_id })); setChatList(mapped); } catch (e) { } };
    const handleSelectChat = async (targetId: string) => { try { let chat = chatList.find(c => c.id === targetId); let isUser = false; if (!chat) { try { const uRes = await api.get(`/users/${targetId}`); if (uRes.data) { chat = { id: targetId, name: uRes.data.username || "User", type: "user", avatar: uRes.data.avatar_url || "https://github.com/shadcn.png", last_message: "", timestamp: "", unread_count: 0, is_online: false }; isUser = true; } } catch { try { const gRes = await api.get(`/chat/groups/${targetId}`); chat = { id: targetId, name: gRes.data.name || "Group", type: "group", avatar: gRes.data.avatar_url || "https://api.dicebear.com/7.x/initials/svg?seed=Group", last_message: "", timestamp: "", unread_count: 0, is_online: true, admin_id: gRes.data.admin_id }; isUser = false; } catch { return; } } } else { isUser = chat.type === 'user'; } setActiveChat(chat!); setShowGroupInfo(false); setShowProfileInfo(false); setShowChatMenu(false); setPendingAttachments([]); if (isUser) { api.get(`/users/${targetId}`).then(res => setActiveUserProfile(res.data)).catch(() => { }); } else { setChatStatus("accepted"); api.get(`/chat/groups/${targetId}`).then(res => setGroupMembers(res.data.members)).catch(() => { }); } api.get(`/chat/history/${targetId}`).then(res => { setMessages(res.data.messages || []); if (res.data.meta) { if (res.data.meta.blocked_by_me) setChatStatus("blocked_by_me"); else if (res.data.meta.blocked_by_them) setChatStatus("blocked_by_them"); else if (res.data.meta.is_pending) setChatStatus("pending_incoming"); else setChatStatus("accepted"); } fetchChatList(); window.dispatchEvent(new Event("triggerNotificationRefresh")); }); } catch (e) { } };
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { if (!e.target.files || e.target.files.length === 0) return; setIsUploading(true); const formData = new FormData(); formData.append("file", e.target.files[0]); try { const res = await api.post("/chat/upload", formData, { headers: { "Content-Type": "multipart/form-data" } }); setPendingAttachments(prev => [...prev, res.data]); } catch (err) { alert("Upload failed"); } finally { setIsUploading(false); if (fileInputRef.current) fileInputRef.current.value = ""; } };
    const removeAttachment = (index: number) => { setPendingAttachments(prev => prev.filter((_, i) => i !== index)); };
    const sendMessage = () => { if (!ws || !activeChat) return; if (!newMessage.trim() && pendingAttachments.length === 0) return; const msgPayload = { recipient_id: activeChat.id, content: newMessage, attachments: pendingAttachments }; ws.send(JSON.stringify(msgPayload)); setMessages(prev => [...prev, { sender_id: userId, content: newMessage, timestamp: new Date().toISOString(), attachments: pendingAttachments }]); setNewMessage(""); setPendingAttachments([]); if (chatStatus === 'none' && activeChat.type === 'user') setChatStatus('pending_outgoing'); };
    const handleAction = async (action: 'accept' | 'block' | 'unblock') => { if (!activeChat) return; try { if (action === 'accept') { await api.post(`/chat/request/${activeChat.id}/accept`, {}); setChatStatus('accepted'); } else { await api.post(`/chat/${action}/${activeChat.id}`, {}); setChatStatus(action === 'block' ? 'blocked_by_me' : 'accepted'); } setShowChatMenu(false); } catch (e) { alert("Action failed"); } };
    const handleHeaderClick = async () => { if (!activeChat) return; if (activeChat.type === "user") { try { const res = await api.get(`/users/${activeChat.id}`); setActiveUserProfile(res.data); setShowProfileInfo(true); } catch (e: any) { if (e.response && e.response.status === 403) alert("Error: You cannot view this profile."); } } else { try { const res = await api.get(`/chat/groups/${activeChat.id}`); setGroupDetails(res.data); setEditingGroupName(res.data.name); setShowInfoModal(true); } catch (e) { console.error(e); } } };
    const updateGroup = async () => { if (!groupDetails || !editingGroupName) return; try { await api.put(`/chat/groups/${groupDetails.id}`, { name: editingGroupName }); setGroupDetails({ ...groupDetails, name: editingGroupName }); fetchChatList(); alert("Group updated!"); } catch (e) { alert("Update failed"); } };
    const removeGroupMember = async (targetId: string) => { if (!groupDetails) return; try { await api.delete(`/chat/groups/${groupDetails.id}/members/${targetId}`); const res = await api.get(`/chat/groups/${groupDetails.id}`); setGroupDetails(res.data); } catch (e) { alert("Failed to remove member"); } };
    const leaveGroup = async () => { if (!groupDetails || !confirm("Are you sure you want to leave?")) return; try { await api.post(`/chat/groups/${groupDetails.id}/leave`, {}); window.location.reload(); } catch (e) { alert("Failed to leave group"); } };
    const blockGroup = async () => { if (!groupDetails || !confirm("Block this group? You will leave and cannot be added back.")) return; try { await api.post(`/chat/groups/${groupDetails.id}/block`, {}); window.location.reload(); } catch (e) { alert("Failed to block group"); } };
    const openAddMemberModal = async () => { try { const res = await api.get("/chat/contacts"); const existingIds = groupDetails?.members.map(m => m.id) || []; setContacts(res.data.filter((c: any) => !existingIds.includes(c.id))); setShowAddMemberModal(true); } catch (e) { alert("Failed"); } };
    const addToGroup = async (targetId: string) => { if (!groupDetails) return; try { await api.put(`/chat/groups/${groupDetails.id}/members`, { user_id: targetId }); setShowAddMemberModal(false); const res = await api.get(`/chat/groups/${groupDetails.id}`); setGroupDetails(res.data); } catch (e: any) { alert("Failed to add member"); } }
    const openGroupModal = async () => { try { const res = await api.get("/chat/contacts"); setContacts(res.data); setShowGroupModal(true); } catch (e) { alert("Failed"); } };
    const toggleContact = (id: string) => { if (selectedContacts.includes(id)) setSelectedContacts(prev => prev.filter(c => c !== id)); else setSelectedContacts(prev => [...prev, id]); };
    const createGroup = async () => { if (!groupName || selectedContacts.length === 0) return alert("Invalid group"); try { await api.post("/chat/groups", { name: groupName, member_ids: selectedContacts }); setShowGroupModal(false); setGroupName(""); setSelectedContacts([]); fetchChatList(); } catch (e) { alert("Failed"); } };
    const formatTime = (iso: string) => { if (!iso) return ""; return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };
    const filteredChats = chatList.filter(chat => chat.name.toLowerCase().includes(searchQuery.toLowerCase()));

    // --- FIX: CALCULATED HEIGHT TO PREVENT SCROLL ---
    return (
        <div className="flex flex-col h-[calc(100vh-140px)] text-white overflow-hidden relative">
            <style jsx global>{` .custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; border-radius: 4px; } `}</style>

            {/* --- CALL OVERLAY --- */}
            <AnimatePresence>
                {isInCall && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center">
                        <div className="absolute top-6 left-6 z-10 bg-white/10 p-4 rounded-xl border border-white/5 backdrop-blur-md">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                {callType === 'video' ? <Video className="w-5 h-5 text-purple-400" /> : <Phone className="w-5 h-5 text-green-400" />}
                                {activeChat?.name}
                            </h2>
                            <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">{callType === 'video' ? 'Video' : 'Audio'} Call</p>
                        </div>

                        <div className="relative w-full h-full flex items-center justify-center p-8 max-w-6xl mx-auto">
                            {callType === 'video' ? (
                                <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-contain rounded-3xl bg-black border border-white/10 shadow-2xl" />
                            ) : (
                                <div className="flex flex-col items-center justify-center animate-pulse">
                                    <div className="w-40 h-40 rounded-full bg-gradient-to-tr from-purple-600 to-blue-600 p-1">
                                        <div className="w-full h-full rounded-full bg-gray-900 flex items-center justify-center">
                                            <User className="w-20 h-20 text-gray-400" />
                                        </div>
                                    </div>
                                    <p className="mt-6 text-2xl font-bold">{activeChat?.name}</p>
                                    <p className="text-green-400 font-mono mt-2">00:00</p>
                                    <video ref={remoteVideoRef} autoPlay playsInline className="hidden" />
                                </div>
                            )}
                            
                            {callType === 'video' && (
                                <div className="absolute bottom-32 right-10 w-60 h-40 bg-gray-800 rounded-2xl overflow-hidden shadow-2xl border border-white/20">
                                    <video ref={localVideoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${isCameraOff ? 'hidden' : ''}`} />
                                    {isCameraOff && <div className="flex items-center justify-center h-full text-gray-500"><VideoOff className="w-8 h-8"/></div>}
                                </div>
                            )}
                        </div>

                        <div className="absolute bottom-10 flex gap-6 bg-white/10 p-4 rounded-3xl backdrop-blur-xl border border-white/10 shadow-2xl">
                            <button onClick={toggleMute} className={`p-4 rounded-2xl transition-all hover:scale-110 ${isMuted ? 'bg-red-500 text-white' : 'bg-white/10 hover:bg-white/20'}`}>
                                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                            </button>
                            {callType === 'video' && (
                                <button onClick={toggleCamera} className={`p-4 rounded-2xl transition-all hover:scale-110 ${isCameraOff ? 'bg-red-500 text-white' : 'bg-white/10 hover:bg-white/20'}`}>
                                    {isCameraOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
                                </button>
                            )}
                            {callType === 'video' && (
                                <button onClick={toggleScreenShare} className={`p-4 rounded-2xl transition-all hover:scale-110 ${isScreenSharing ? 'bg-green-500 hover:bg-green-600 text-black' : 'bg-white/10 hover:bg-white/20'}`}>
                                    {isScreenSharing ? <Monitor className="w-6 h-6" /> : <MonitorOff className="w-6 h-6" />}
                                </button>
                            )}
                            <button onClick={endCall} className="p-4 rounded-2xl bg-red-600 hover:bg-red-700 hover:scale-110 transition-all shadow-lg shadow-red-900/50">
                                <PhoneOff className="w-6 h-6" />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            
            {/* INCOMING CALL NOTIFICATION */}
            <AnimatePresence>
                {incomingCall && !isInCall && (
                    <motion.div initial={{ y: -100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -100, opacity: 0 }} className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] bg-[#1A1E26]/90 backdrop-blur-xl border border-purple-500/30 p-4 rounded-3xl shadow-2xl flex items-center gap-6 min-w-[350px]">
                        <div className="relative">
                            <div className="absolute inset-0 bg-purple-500 rounded-full animate-ping opacity-30"></div>
                            <div className="bg-gray-800 p-4 rounded-full relative z-10 border border-white/10">
                                {incomingCall.callType === 'video' ? <Video className="w-6 h-6 text-purple-400" /> : <Phone className="w-6 h-6 text-green-400" />}
                            </div>
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-white">Incoming Call</h3>
                            <p className="text-xs text-gray-400 font-mono tracking-wide uppercase">Requesting Connection...</p>
                        </div>
                        <div className="flex gap-3 ml-auto">
                            <button onClick={acceptCall} className="bg-green-500 hover:bg-green-400 p-3 rounded-full transition shadow-lg shadow-green-900/20"><Phone className="w-5 h-5 text-black fill-current" /></button>
                            <button onClick={() => setIncomingCall(null)} className="bg-red-500 hover:bg-red-400 p-3 rounded-full transition shadow-lg shadow-red-900/20"><PhoneOff className="w-5 h-5 text-white fill-current" /></button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* --- MAIN CHAT LAYOUT --- */}
            <div className="flex-1 max-w-[1600px] w-full mx-auto flex gap-6 h-full overflow-hidden">
                
                {/* SIDEBAR (Chat List) */}
                <div className={`w-full md:w-80 lg:w-96 flex flex-col bg-[#13161C] border border-white/5 rounded-3xl overflow-hidden shadow-xl ${activeChat ? 'hidden md:flex' : 'flex'}`}>
                    <div className="p-5 border-b border-white/5 space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="font-black text-xl tracking-tight">Messages</h2>
                            <button onClick={openGroupModal} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition"><Plus className="w-5 h-5 text-gray-400" /></button>
                        </div>
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-purple-400 transition" />
                            <input className="w-full bg-black/30 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none focus:border-purple-500/50 transition placeholder:text-gray-600" placeholder="Search conversations..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                        {filteredChats.map(chat => (
                            <div key={chat.id} onClick={() => handleSelectChat(chat.id)} className={`p-3 flex items-center gap-3 rounded-2xl cursor-pointer transition-all ${activeChat?.id === chat.id ? 'bg-purple-600/10 border border-purple-500/20' : 'hover:bg-white/5 border border-transparent'}`}>
                                <div className="relative">
                                    <img src={chat.avatar || "https://github.com/shadcn.png"} className="w-12 h-12 rounded-full object-cover border border-white/10" />
                                    {chat.is_online && chat.type === 'user' && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#13161C]"></div>}
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <div className="flex justify-between items-center">
                                        <h4 className={`font-bold text-sm truncate ${activeChat?.id === chat.id ? 'text-white' : 'text-gray-300'}`}>{chat.name}</h4>
                                        <span className="text-[10px] text-gray-500 font-mono">{formatTime(chat.timestamp)}</span>
                                    </div>
                                    <div className="flex justify-between items-center mt-0.5">
                                        <p className="text-xs text-gray-500 truncate max-w-[70%]">{chat.last_message || "Start chatting..."}</p>
                                        {chat.unread_count > 0 && <span className="bg-purple-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{chat.unread_count}</span>}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* CHAT AREA */}
                <div className={`flex-1 bg-[#13161C] border border-white/5 rounded-3xl flex flex-col overflow-hidden relative shadow-xl ${!activeChat ? 'hidden md:flex' : 'flex'}`}>
                    {activeChat ? (
                        <>
                            {/* Chat Header */}
                            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-[#13161C] z-10">
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setActiveChat(null)} className="md:hidden p-2 -ml-2 text-gray-400"><ChevronLeft/></button>
                                    <div className="relative cursor-pointer" onClick={handleHeaderClick}>
                                        <img src={activeChat.avatar || "https://github.com/shadcn.png"} className="w-10 h-10 rounded-full object-cover border border-white/10" />
                                        {activeChat.is_online && activeChat.type === 'user' && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-[#13161C]"></div>}
                                    </div>
                                    <div onClick={handleHeaderClick} className="cursor-pointer">
                                        <h3 className="font-bold text-white flex items-center gap-2 text-sm">{activeChat.name} {activeChat.is_team_group && <span className="bg-yellow-500/10 text-yellow-500 text-[9px] px-1.5 rounded border border-yellow-500/20">TEAM</span>}</h3>
                                        <span className="text-xs text-gray-500">{activeChat.type === 'group' ? `${groupMembers.length} members` : activeChat.is_online ? "Active now" : "Offline"}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => startCall('audio')} className="p-2.5 hover:bg-white/5 rounded-xl text-gray-400 hover:text-green-400 transition"><Phone className="w-5 h-5" /></button>
                                    <button onClick={() => startCall('video')} className="p-2.5 hover:bg-white/5 rounded-xl text-gray-400 hover:text-purple-400 transition"><Video className="w-5 h-5" /></button>
                                    <div className="w-px h-6 bg-white/10 mx-1"></div>
                                    <button onClick={() => setShowChatMenu(!showChatMenu)} className="p-2.5 hover:bg-white/5 rounded-xl text-gray-400 hover:text-white transition relative">
                                        <MoreVertical className="w-5 h-5" />
                                        <AnimatePresence>
                                            {showChatMenu && (
                                                <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute right-0 top-12 bg-[#1A1E26] border border-white/10 rounded-xl shadow-2xl w-48 z-50 overflow-hidden ring-1 ring-black/50">
                                                    <button onClick={handleHeaderClick} className="w-full text-left px-4 py-3 hover:bg-white/5 text-xs font-bold flex items-center gap-2"><User className="w-4 h-4" /> Info</button>
                                                    {activeChat.type === 'user' && <button onClick={() => handleAction('block')} className="w-full text-left px-4 py-3 hover:bg-white/5 text-xs font-bold flex items-center gap-2 text-red-400"><Ban className="w-4 h-4" /> Block</button>}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </button>
                                </div>
                            </div>

                            {/* Messages List */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar" ref={scrollRef}>
                                {messages.map((msg, i) => { 
                                    const isMe = msg.sender_id === userId; 
                                    return (
                                        <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[75%] px-5 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${isMe ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-[#1A1E26] text-gray-200 border border-white/5 rounded-bl-none'}`}>
                                                {!isMe && activeChat.type === 'group' && <p className="text-[10px] text-indigo-400 font-bold mb-1">{msg.sender_name}</p>}
                                                
                                                {/* Attachments */}
                                                {msg.attachments && msg.attachments.length > 0 && (
                                                    <div className="space-y-2 mb-2">
                                                        {msg.attachments.map((att, idx) => (
                                                            <div key={idx} className="rounded-lg overflow-hidden bg-black/20">
                                                                {att.file_type === 'image' ? <img src={att.url} className="max-w-full h-auto rounded-lg max-h-60" /> : <a href={att.url} target="_blank" className="flex items-center gap-2 p-2"><File className="w-4 h-4"/> {att.name}</a>}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                <p className="whitespace-pre-wrap">{msg.content}</p>
                                                <span className={`text-[10px] block text-right mt-1 font-mono opacity-50`}>{formatTime(msg.timestamp)}</span>
                                            </div>
                                        </div>
                                    ); 
                                })}
                            </div>

                            {/* Input Area */}
                            <div className="p-4 border-t border-white/5 bg-[#13161C]">
                                {pendingAttachments.length > 0 && (
                                    <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
                                        {pendingAttachments.map((att, i) => (
                                            <div key={i} className="relative bg-gray-800 rounded-lg p-1 w-16 h-16 flex items-center justify-center shrink-0 border border-gray-700">
                                                <button onClick={() => removeAttachment(i)} className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5"><X className="w-3 h-3" /></button>
                                                {att.file_type === 'image' ? <img src={att.url} className="w-full h-full object-cover rounded" /> : <File className="w-6 h-6 text-gray-400" />}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="flex gap-2 items-end bg-[#0B0E14] border border-white/10 rounded-2xl p-2 transition-all focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/50">
                                    <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                                    <button onClick={() => fileInputRef.current?.click()} className="p-2.5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl transition"><Paperclip className="w-5 h-5" /></button>
                                    <textarea className="flex-1 bg-transparent text-sm text-white px-2 py-3 outline-none resize-none max-h-32 custom-scrollbar placeholder:text-gray-600" placeholder="Type a message..." rows={1} value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} />
                                    <button onClick={sendMessage} disabled={!newMessage.trim() && pendingAttachments.length === 0} className="p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"><Send className="w-5 h-5" /></button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500">
                            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-4">
                                <MessageSquare className="w-10 h-10 opacity-30" />
                            </div>
                            <p className="font-medium">Select a conversation to start chatting</p>
                        </div>
                    )}
                </div>
            </div>

            {/* --- MODALS (Simplified) --- */}
            <AnimatePresence>
                {showGroupModal && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-[#13161C] border border-white/10 p-6 rounded-3xl w-full max-w-md shadow-2xl">
                            <h2 className="text-xl font-black mb-6">Create New Squad</h2>
                            <input className="w-full bg-black/50 border border-white/10 rounded-xl p-3 mb-4 outline-none focus:border-indigo-500 transition" placeholder="Group Name" value={groupName} onChange={e => setGroupName(e.target.value)} />
                            <p className="text-xs font-bold text-gray-500 uppercase mb-2">Select Members</p>
                            <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-1 mb-6">
                                {contacts.map(c => (
                                    <div key={c.id} onClick={() => toggleContact(c.id)} className={`p-3 rounded-xl cursor-pointer flex items-center justify-between border transition-all ${selectedContacts.includes(c.id) ? "bg-indigo-500/10 border-indigo-500/50" : "bg-transparent border-transparent hover:bg-white/5"}`}>
                                        <div className="flex items-center gap-3"><img src={c.avatar_url} className="w-8 h-8 rounded-full" /><span className="text-sm font-medium">{c.username}</span></div>
                                        {selectedContacts.includes(c.id) && <Check className="w-4 h-4 text-indigo-400" />}
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setShowGroupModal(false)} className="flex-1 py-3 rounded-xl font-bold text-sm hover:bg-white/5 transition">Cancel</button>
                                <button onClick={createGroup} className="flex-1 bg-indigo-600 hover:bg-indigo-500 py-3 rounded-xl font-bold text-sm transition">Create Group</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}