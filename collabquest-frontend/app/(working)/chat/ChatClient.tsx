"use client";
import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Cookies from "js-cookie";
import api from "@/lib/api";
import { 
    Send, User, MessageSquare, Users, MoreVertical, UserIcon, Search, 
    ShieldAlert, Check, X, Lock, LogOut, Slash, Plus, Trash2, Ban, 
    Paperclip, File, FileText, Video, Phone, Mic, MicOff, 
    VideoOff, PhoneOff, Monitor, MonitorOff, ChevronLeft, Film, Music
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

const rtcConfig = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

// --- GLOSSY COLOR SYSTEM FOR GROUP CHAT ---
// Using specific border-t/l for highlights and shadow for glow
const USER_COLORS = [
    // Blue Theme
    { 
        bubble: "bg-gradient-to-br from-blue-500/20 to-blue-900/10 border-t-blue-400/50 border-l-blue-400/50 border-b-blue-900/30 border-r-blue-900/30 shadow-[0_0_15px_rgba(59,130,246,0.15)]", 
        text: "text-blue-100", 
        name: "text-blue-400 drop-shadow-[0_0_5px_rgba(59,130,246,0.5)]" 
    },
    // Emerald Theme
    { 
        bubble: "bg-gradient-to-br from-emerald-500/20 to-emerald-900/10 border-t-emerald-400/50 border-l-emerald-400/50 border-b-emerald-900/30 border-r-emerald-900/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]", 
        text: "text-emerald-100", 
        name: "text-emerald-400 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]" 
    },
    // Rose Theme
    { 
        bubble: "bg-gradient-to-br from-rose-500/20 to-rose-900/10 border-t-rose-400/50 border-l-rose-400/50 border-b-rose-900/30 border-r-rose-900/30 shadow-[0_0_15px_rgba(244,63,94,0.15)]", 
        text: "text-rose-100", 
        name: "text-rose-400 drop-shadow-[0_0_5px_rgba(244,63,94,0.5)]" 
    },
    // Amber Theme
    { 
        bubble: "bg-gradient-to-br from-amber-500/20 to-amber-900/10 border-t-amber-400/50 border-l-amber-400/50 border-b-amber-900/30 border-r-amber-900/30 shadow-[0_0_15px_rgba(245,158,11,0.15)]", 
        text: "text-amber-100", 
        name: "text-amber-400 drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]" 
    },
    // Cyan Theme
    { 
        bubble: "bg-gradient-to-br from-cyan-500/20 to-cyan-900/10 border-t-cyan-400/50 border-l-cyan-400/50 border-b-cyan-900/30 border-r-cyan-900/30 shadow-[0_0_15px_rgba(6,182,212,0.15)]", 
        text: "text-cyan-100", 
        name: "text-cyan-400 drop-shadow-[0_0_5px_rgba(6,182,212,0.5)]" 
    },
    // Fuchsia Theme
    { 
        bubble: "bg-gradient-to-br from-fuchsia-500/20 to-fuchsia-900/10 border-t-fuchsia-400/50 border-l-fuchsia-400/50 border-b-fuchsia-900/30 border-r-fuchsia-900/30 shadow-[0_0_15px_rgba(217,70,239,0.15)]", 
        text: "text-fuchsia-100", 
        name: "text-fuchsia-400 drop-shadow-[0_0_5px_rgba(217,70,239,0.5)]" 
    },
];

const getUserColor = (userId: string) => {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % USER_COLORS.length;
    return USER_COLORS[index];
};

const Tooltip = ({ children, text }: { children: React.ReactNode, text: string }) => (
  <div className="group relative">
    {children}
    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block px-3 py-1.5 bg-gray-900 border border-white/10 text-xs text-white font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none shadow-xl">
      {text}
    </span>
  </div>
);

export default function ChatClient() {
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

    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const initialTarget = searchParams.get("targetId");

    // --- MOUSE EFFECT STATE ---
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

    useEffect(() => { activeChatRef.current = activeChat?.id || null; }, [activeChat]);

    // Mouse Effect Listener
    useEffect(() => {
        const updateMousePosition = (ev: MouseEvent) => {
            setMousePosition({ x: ev.clientX, y: ev.clientY });
        };
        window.addEventListener("mousemove", updateMousePosition);
        return () => window.removeEventListener("mousemove", updateMousePosition);
    }, []);

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
        setIsInCall(true);
        setCallType(type);
        setIsMuted(false);
        setIsCameraOff(false);

        peerConnection.current = new RTCPeerConnection(rtcConfig);
        peerConnection.current.onicecandidate = (event) => {
            if (event.candidate) {
                ws.send(JSON.stringify({ event: 'ice-candidate', recipient_id: activeChat.id, data: event.candidate }));
            }
        };
        peerConnection.current.ontrack = (event) => { if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0]; };

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: type === 'video', audio: true });
            localStream.current = stream;
            if (localVideoRef.current) localVideoRef.current.srcObject = type === 'video' ? stream : null;

            stream.getTracks().forEach(track => { peerConnection.current?.addTrack(track, stream); });
            const offer = await peerConnection.current.createOffer();
            await peerConnection.current.setLocalDescription(offer);

            ws.send(JSON.stringify({ event: 'offer', recipient_id: activeChat.id, data: { offer, callType: type } }));
        } catch (err) { console.error("Error accessing media devices:", err); endCall(); alert("Could not access camera/microphone."); }
    };

    const acceptCall = async () => {
        if (!incomingCall || !ws) return;
        setIsInCall(true);
        setCallType(incomingCall.callType);
        setIsMuted(false);
        setIsCameraOff(false);
        if (activeChat?.id !== incomingCall.sender_id) handleSelectChat(incomingCall.sender_id);

        peerConnection.current = new RTCPeerConnection(rtcConfig);
        peerConnection.current.onicecandidate = (event) => {
            if (event.candidate) { ws.send(JSON.stringify({ event: 'ice-candidate', recipient_id: incomingCall.sender_id, data: event.candidate })); }
        };
        peerConnection.current.ontrack = (event) => { if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0]; };

        try {
            await peerConnection.current.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
            const stream = await navigator.mediaDevices.getUserMedia({ video: incomingCall.callType === 'video', audio: true });
            localStream.current = stream;
            if (localVideoRef.current) localVideoRef.current.srcObject = incomingCall.callType === 'video' ? stream : null;

            stream.getTracks().forEach(track => { peerConnection.current?.addTrack(track, stream); });
            const answer = await peerConnection.current.createAnswer();
            await peerConnection.current.setLocalDescription(answer);

            ws.send(JSON.stringify({ event: 'answer', recipient_id: incomingCall.sender_id, data: answer }));
            setIncomingCall(null);
        } catch (err) { console.error(err); endCall(); }
    };

    const endCall = () => {
        if (localStream.current) localStream.current.getTracks().forEach(track => track.stop());
        if (screenStreamRef.current) screenStreamRef.current.getTracks().forEach(track => track.stop());
        if (peerConnection.current) peerConnection.current.close();
        if (ws && activeChat && isInCall) ws.send(JSON.stringify({ event: 'hang-up', recipient_id: activeChat.id }));
        
        peerConnection.current = null; localStream.current = null; screenStreamRef.current = null;
        setIsInCall(false); setIncomingCall(null); setIsScreenSharing(false); setIsMuted(false); setIsCameraOff(false);
    };

    const toggleScreenShare = async () => {
        if (!peerConnection.current || !localStream.current) return;
        if (isScreenSharing) {
            try {
                if (screenStreamRef.current) { screenStreamRef.current.getTracks().forEach(track => track.stop()); screenStreamRef.current = null; }
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                const videoTrack = stream.getVideoTracks()[0]; const audioTrack = stream.getAudioTracks()[0];
                audioTrack.enabled = !isMuted; videoTrack.enabled = !isCameraOff; 
                const videoSender = peerConnection.current.getSenders().find(s => s.track?.kind === 'video'); if (videoSender) videoSender.replaceTrack(videoTrack);
                const audioSender = peerConnection.current.getSenders().find(s => s.track?.kind === 'audio'); if (audioSender) audioSender.replaceTrack(audioTrack);
                localStream.current = stream; if (localVideoRef.current) localVideoRef.current.srcObject = stream;
                setIsScreenSharing(false);
            } catch(e) { console.error("Error reverting to camera", e); }
        } else {
            try {
                const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                const screenTrack = stream.getVideoTracks()[0];
                screenStreamRef.current = stream; 
                const sender = peerConnection.current.getSenders().find(s => s.track?.kind === 'video'); if (sender) sender.replaceTrack(screenTrack);
                screenTrack.onended = () => toggleScreenShare(); 
                if (localVideoRef.current) localVideoRef.current.srcObject = stream;
                setIsScreenSharing(true);
            } catch (err: any) { console.error("Screen share error:", err); }
        }
    };

    const toggleMute = () => { if (localStream.current) { const newMutedState = !isMuted; localStream.current.getAudioTracks().forEach(t => t.enabled = !newMutedState); setIsMuted(newMutedState); } };
    const toggleCamera = () => { if (localStream.current) { const newCameraOffState = !isCameraOff; localStream.current.getVideoTracks().forEach(t => t.enabled = !newCameraOffState); setIsCameraOff(newCameraOffState); } };

    const fetchChatList = async () => { try { const res = await api.get("/chat/conversations"); const mapped = res.data.map((c: any) => ({ id: c.id, name: c.username || "Unknown", type: c.type, avatar: c.avatar_url || "https://github.com/shadcn.png", last_message: c.last_message || "", timestamp: c.last_timestamp, unread_count: c.unread_count || 0, is_online: c.is_online, member_count: c.member_count, is_team_group: c.is_team_group, admin_id: c.admin_id })); setChatList(mapped); } catch (e) { } };
    const handleSelectChat = async (targetId: string) => { 
        if (window.innerWidth < 768) setIsSidebarOpen(false);
        try { let chat = chatList.find(c => c.id === targetId); let isUser = false; if (!chat) { try { const uRes = await api.get(`/users/${targetId}`); if (uRes.data) { chat = { id: targetId, name: uRes.data.username || "User", type: "user", avatar: uRes.data.avatar_url || "https://github.com/shadcn.png", last_message: "", timestamp: "", unread_count: 0, is_online: false }; isUser = true; } } catch { try { const gRes = await api.get(`/chat/groups/${targetId}`); chat = { id: targetId, name: gRes.data.name || "Group", type: "group", avatar: gRes.data.avatar_url || "https://api.dicebear.com/7.x/initials/svg?seed=Group", last_message: "", timestamp: "", unread_count: 0, is_online: true, admin_id: gRes.data.admin_id }; isUser = false; } catch { return; } } } else { isUser = chat.type === 'user'; } setActiveChat(chat!); setShowGroupInfo(false); setShowProfileInfo(false); setShowChatMenu(false); setPendingAttachments([]); if (isUser) { api.get(`/users/${targetId}`).then(res => setActiveUserProfile(res.data)).catch(() => { }); } else { setChatStatus("accepted"); api.get(`/chat/groups/${targetId}`).then(res => setGroupMembers(res.data.members)).catch(() => { }); } api.get(`/chat/history/${targetId}`).then(res => { setMessages(res.data.messages || []); if (res.data.meta) { if (res.data.meta.blocked_by_me) setChatStatus("blocked_by_me"); else if (res.data.meta.blocked_by_them) setChatStatus("blocked_by_them"); else if (res.data.meta.is_pending) setChatStatus("pending_incoming"); else setChatStatus("accepted"); } fetchChatList(); window.dispatchEvent(new Event("triggerNotificationRefresh")); }); } catch (e) { } 
    };
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
    const addToGroup = async (targetId: string) => { if (!groupDetails) return; try { await api.put(`/chat/groups/${groupDetails.id}/members`, { user_id: targetId }); setShowAddMemberModal(false); const res = await api.get(`/chat/groups/${groupDetails.id}`); setGroupDetails(res.data); } catch (e: any) { if (e.response && e.response.status === 400) alert("Cannot add: User has blocked this group."); else alert("Failed to add member"); } }
    const openGroupModal = async () => { try { const res = await api.get("/chat/contacts"); setContacts(res.data); setShowGroupModal(true); } catch (e) { alert("Failed"); } };
    const toggleContact = (id: string) => { if (selectedContacts.includes(id)) setSelectedContacts(prev => prev.filter(c => c !== id)); else setSelectedContacts(prev => [...prev, id]); };
    const createGroup = async () => { if (!groupName || selectedContacts.length === 0) return alert("Invalid group"); try { await api.post("/chat/groups", { name: groupName, member_ids: selectedContacts }); setShowGroupModal(false); setGroupName(""); setSelectedContacts([]); fetchChatList(); } catch (e) { alert("Failed"); } };
    const formatTime = (iso: string) => { if (!iso) return ""; return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };
    const filteredChats = chatList.filter(chat => chat.name.toLowerCase().includes(searchQuery.toLowerCase()));

    // --- RENDER ---
    return (
        <div className="h-screen bg-transparent text-white flex overflow-hidden relative font-sans selection:bg-purple-500/30">
            {/* Mouse Glow */}
            <div 
                className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-300"
                style={{ background: `radial-gradient(800px at ${mousePosition.x}px ${mousePosition.y}px, rgba(168, 85, 247, 0.05), transparent 80%)` }}
            />
            {/* Ambient Static Blobs */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[60%] bg-purple-900/10 blur-[100px] rounded-full mix-blend-screen" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[50%] bg-blue-900/10 blur-[120px] rounded-full mix-blend-screen" />
            </div>

            <style jsx global>{` 
                .custom-scrollbar::-webkit-scrollbar { width: 5px; } 
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } 
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; border-radius: 4px; } 
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #4B5563; } 
            `}</style>

            {/* --- CALL OVERLAY --- */}
            <AnimatePresence>
                {isInCall && (
                    <motion.div initial={{ opacity: 0, backdropFilter: "blur(0px)" }} animate={{ opacity: 1, backdropFilter: "blur(12px)" }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/80 flex flex-col items-center justify-center">
                        <div className="absolute top-6 left-6 z-10 bg-[#13161C] p-4 rounded-xl backdrop-blur border border-white/10 shadow-2xl">
                            <h2 className="text-lg font-bold flex items-center gap-2 text-white">
                                {callType === 'video' ? <Video className="w-5 h-5 text-purple-400" /> : <Phone className="w-5 h-5 text-green-400" />}
                                {activeChat?.name}
                            </h2>
                            <p className="text-xs text-gray-400 font-mono mt-1">{callType === 'video' ? 'Video' : 'Voice'} Secured Connection</p>
                        </div>

                        <div className="relative w-full h-full max-w-7xl flex items-center justify-center p-4">
                            {callType === 'video' ? (
                                <div className="relative w-full h-full bg-[#13161C] rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
                                    <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-contain bg-black" />
                                    <div className="absolute bottom-6 right-6 w-64 aspect-video bg-[#1A1D21] rounded-xl overflow-hidden shadow-2xl border border-white/10 z-20">
                                        <video ref={localVideoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${isCameraOff ? 'hidden' : ''}`} />
                                        {isCameraOff && <div className="flex items-center justify-center h-full text-gray-500"><VideoOff className="w-8 h-8"/></div>}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center relative">
                                    <div className="absolute inset-0 bg-green-500/10 blur-[100px] rounded-full animate-pulse" />
                                    <div className="w-40 h-40 rounded-full bg-[#13161C] border-2 border-white/10 flex items-center justify-center relative z-10 shadow-[0_0_40px_rgba(74,222,128,0.2)]">
                                        <img src={activeChat?.avatar} className="w-full h-full object-cover rounded-full opacity-90" />
                                    </div>
                                    <p className="mt-6 text-2xl font-bold text-white">{activeChat?.name}</p>
                                    <p className="text-green-400 font-bold text-sm mt-2 animate-pulse tracking-wide">Voice Connected</p>
                                    <video ref={remoteVideoRef} autoPlay playsInline className="hidden" />
                                </div>
                            )}
                        </div>

                        <div className="absolute bottom-10 flex gap-4 bg-[#13161C]/90 p-4 rounded-3xl backdrop-blur-md border border-white/10 shadow-2xl">
                            <Tooltip text={isMuted ? "Unmute" : "Mute"}>
                                <button onClick={toggleMute} className={`p-4 rounded-2xl transition ${isMuted ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-white/5 hover:bg-white/10 text-white'}`}>
                                    {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                                </button>
                            </Tooltip>
                            {callType === 'video' && (
                                <>
                                    <Tooltip text={isCameraOff ? "Turn Camera On" : "Turn Camera Off"}>
                                        <button onClick={toggleCamera} className={`p-4 rounded-2xl transition ${isCameraOff ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-white/5 hover:bg-white/10 text-white'}`}>
                                            {isCameraOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
                                        </button>
                                    </Tooltip>
                                    <Tooltip text={isScreenSharing ? "Stop Sharing" : "Share Screen"}>
                                        <button onClick={toggleScreenShare} className={`p-4 rounded-2xl transition ${isScreenSharing ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-white/5 hover:bg-white/10 text-white'}`}>
                                            {isScreenSharing ? <Monitor className="w-6 h-6" /> : <MonitorOff className="w-6 h-6" />}
                                        </button>
                                    </Tooltip>
                                </>
                            )}
                            <div className="w-px h-10 bg-white/10 mx-2 self-center"></div>
                            <button onClick={endCall} className="p-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white transition shadow-lg shadow-red-600/30 hover:shadow-red-600/50">
                                <PhoneOff className="w-6 h-6 fill-current" />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            
            {/* --- INCOMING CALL TOAST --- */}
            <AnimatePresence>
                {incomingCall && !isInCall && (
                    <motion.div initial={{ y: -100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -100, opacity: 0 }} className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] bg-[#13161C] border border-white/10 p-4 pr-6 rounded-2xl shadow-2xl flex items-center gap-6 min-w-[340px]">
                        <div className="relative">
                            <div className="absolute inset-0 bg-purple-500 rounded-full animate-ping opacity-20"></div>
                            <div className="bg-white/5 p-3 rounded-full relative z-10 border border-white/10">
                                {incomingCall.callType === 'video' ? <Video className="w-6 h-6 text-purple-400" /> : <Phone className="w-6 h-6 text-green-400" />}
                            </div>
                        </div>
                        <div>
                            <h3 className="font-bold text-white">Incoming Call</h3>
                            <p className="text-xs text-gray-400">Requesting {incomingCall.callType} connection...</p>
                        </div>
                        <div className="flex gap-2 ml-auto">
                            <button onClick={acceptCall} className="bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 p-3 rounded-full transition shadow-lg shadow-green-500/10"><Phone className="w-5 h-5 text-green-400 fill-current" /></button>
                            <button onClick={() => setIncomingCall(null)} className="bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 p-3 rounded-full transition shadow-lg shadow-red-500/10"><PhoneOff className="w-5 h-5 text-red-400 fill-current" /></button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* --- MAIN LAYOUT --- */}
            <div className="flex-1 w-full max-w-[1920px] mx-auto p-0 md:p-6 flex gap-6 h-screen md:h-screen overflow-hidden z-20 relative">
                
                {/* --- SIDEBAR --- */}
                <motion.div 
                    initial={false}
                    animate={{ 
                        x: isSidebarOpen ? 0 : -100, 
                        width: isSidebarOpen ? (window.innerWidth < 768 ? '100%' : '380px') : '0px',
                        opacity: isSidebarOpen ? 1 : 0
                    }}
                    className={`
                        ${isSidebarOpen ? 'flex' : 'hidden md:flex'} 
                        flex-col bg-[#13161C]/90 backdrop-blur-xl border-r md:border border-white/10 
                        md:rounded-3xl overflow-hidden shadow-2xl shrink-0 absolute md:relative z-20 h-full
                    `}
                >
                    <div className="p-6 border-b border-white/5 bg-[#13161C]/50">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="font-black text-2xl tracking-tight text-white">
                                Connect <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">Hub</span>
                            </h2>
                            <button onClick={openGroupModal} className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-purple-600 hover:border-purple-500 transition-all text-gray-400 hover:text-white shadow-lg shadow-black/20 group">
                                <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                            </button>
                        </div>
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-purple-400 transition-colors" />
                            <input 
                                className="w-full bg-black/30 border border-white/10 rounded-xl py-3 pl-10 text-sm focus:outline-none focus:border-purple-500/50 focus:bg-black/50 transition-all placeholder:text-gray-600 text-gray-300" 
                                placeholder="Search conversations..." 
                                value={searchQuery} 
                                onChange={(e) => setSearchQuery(e.target.value)} 
                            />
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar py-2 space-y-1 px-3">
                        {filteredChats.map(chat => (
                            <div key={chat.id} onClick={() => handleSelectChat(chat.id)} className={`p-3 rounded-xl flex items-center gap-3 cursor-pointer transition-all border ${activeChat?.id === chat.id ? 'bg-gradient-to-r from-purple-500/10 to-transparent border-l-4 border-l-purple-500 border-y-transparent border-r-transparent' : 'border-transparent hover:bg-white/5 hover:border-white/5'}`}>
                                <div className="relative shrink-0">
                                    <img src={chat.avatar} className={`w-12 h-12 rounded-xl object-cover border ${activeChat?.id === chat.id ? 'border-purple-500/50' : 'border-white/10'}`} />
                                    {chat.is_online && chat.type === 'user' && <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-[#13161C] rounded-full flex items-center justify-center"><div className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_8px_rgba(74,222,128,0.8)]"></div></div>}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline mb-0.5">
                                        <h4 className={`font-bold text-sm truncate flex items-center gap-2 ${activeChat?.id === chat.id ? 'text-white' : 'text-gray-300'}`}>
                                            {chat.name}
                                            {chat.type === "group" && chat.is_team_group && <ShieldAlert className="w-3 h-3 text-yellow-500" />}
                                        </h4>
                                        <span className={`text-[10px] ${activeChat?.id === chat.id ? 'text-purple-300' : 'text-gray-500'}`}>{formatTime(chat.timestamp)}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <p className={`text-xs truncate max-w-[160px] ${activeChat?.id === chat.id ? 'text-purple-200/70' : 'text-gray-500'}`}>{chat.last_message || "Start chatting..."}</p>
                                        {chat.unread_count > 0 && <span className="bg-purple-600 text-white text-[10px] font-bold px-1.5 h-4 min-w-[16px] flex items-center justify-center rounded-md shadow-lg shadow-purple-900/50">{chat.unread_count}</span>}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* --- CHAT AREA --- */}
                <div className="flex-1 bg-[#13161C]/90 backdrop-blur-xl border md:border-white/10 md:rounded-3xl flex flex-col overflow-hidden relative shadow-2xl h-full">
                    {activeChat ? (
                        <>
                            {/* Header */}
                            <div className="h-20 border-b border-white/5 flex justify-between items-center px-6 bg-[#13161C]/50 backdrop-blur-md z-10 shrink-0">
                                <div className="flex items-center gap-4 cursor-pointer group" onClick={handleHeaderClick}>
                                    <button className="md:hidden text-gray-400 hover:text-white" onClick={(e) => { e.stopPropagation(); setIsSidebarOpen(true); }}>
                                        <ChevronLeft />
                                    </button>
                                    <div className="relative">
                                        <img src={activeChat.avatar} className="w-10 h-10 rounded-xl shadow-lg border border-white/10 group-hover:border-purple-500/50 transition-colors" />
                                        {activeChat.is_online && <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-[#13161C]"></div>}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg leading-tight flex items-center gap-2 text-white group-hover:text-purple-300 transition-colors">
                                            {activeChat.name}
                                            {activeChat.type === "group" && activeChat.is_team_group && <span className="text-yellow-500 bg-yellow-900/20 px-1.5 py-0.5 rounded text-[10px] border border-yellow-500/20">OFFICIAL</span>}
                                        </h3>
                                        <span className="text-xs text-gray-400 flex items-center gap-1 group-hover:text-gray-300">
                                            {activeChat.type === 'group' ? <><Users className="w-3 h-3" /> {groupMembers.length} members</> : "View Profile"}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Tooltip text="Voice Call"><button onClick={() => startCall('audio')} className="p-2.5 bg-white/5 hover:bg-green-500/10 border border-white/5 hover:border-green-500/30 rounded-xl transition text-gray-400 hover:text-green-400"><Phone className="w-5 h-5" /></button></Tooltip>
                                    <Tooltip text="Video Call"><button onClick={() => startCall('video')} className="p-2.5 bg-white/5 hover:bg-purple-500/10 border border-white/5 hover:border-purple-500/30 rounded-xl transition text-gray-400 hover:text-purple-400"><Video className="w-5 h-5" /></button></Tooltip>
                                    <div className="w-px h-6 bg-white/10 mx-2"></div>
                                    <div className="relative">
                                        <button onClick={() => setShowChatMenu(!showChatMenu)} className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-xl transition text-gray-400 hover:text-white"><MoreVertical className="w-5 h-5" /></button>
                                        <AnimatePresence>
                                            {showChatMenu && (
                                                <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="absolute right-0 top-14 bg-[#1A1D21] border border-white/10 rounded-xl shadow-2xl w-48 z-20 overflow-hidden">
                                                    <button onClick={handleHeaderClick} className="w-full text-left px-4 py-3 hover:bg-white/5 text-sm flex items-center gap-3 transition-colors text-gray-300"><User className="w-4 h-4" /> View Info</button>
                                                    {activeChat.type === 'user' && (chatStatus === 'blocked_by_me' 
                                                        ? <button onClick={() => handleAction('unblock')} className="w-full text-left px-4 py-3 hover:bg-white/5 text-sm flex items-center gap-3 text-green-400"><Check className="w-4 h-4" /> Unblock</button> 
                                                        : <button onClick={() => handleAction('block')} className="w-full text-left px-4 py-3 hover:bg-white/5 text-sm flex items-center gap-3 text-red-400"><Slash className="w-4 h-4" /> Block</button>
                                                    )}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar" ref={scrollRef}>
                                {messages.map((msg, i) => { 
                                    const isMe = msg.sender_id === userId; 
                                    const userColor = getUserColor(msg.sender_id);
                                    
                                    return (
                                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[85%] md:max-w-[70%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                                {!isMe && activeChat.type === 'group' && <p className={`text-[10px] ml-3 mb-1 font-bold tracking-wide drop-shadow-lg ${userColor.name}`}>{msg.sender_name}</p>}
                                                <div className={`px-5 py-3 shadow-lg relative rounded-2xl border backdrop-blur-sm ${isMe ? 'bg-gradient-to-br from-violet-600/80 via-purple-600/80 to-fuchsia-500/80 border-purple-400/50 text-white rounded-tr-sm shadow-purple-500/30' : `${userColor.bubble} rounded-tl-sm ${userColor.text}`}`}>
                                                    {msg.attachments && msg.attachments.length > 0 && (
                                                        <div className="flex flex-wrap gap-2 mb-2">
                                                            {msg.attachments.map((att, idx) => (
                                                                <div key={idx} className="rounded-lg overflow-hidden bg-black/20 border border-white/10 max-w-full">
                                                                    {att.file_type === 'image' ? <img src={att.url} className="max-w-full max-h-60 object-cover" /> 
                                                                    : att.file_type === 'video' ? <video src={att.url} controls className="max-w-full max-h-60 rounded" /> 
                                                                    : <a href={att.url} target="_blank" className="flex items-center gap-2 p-2 hover:bg-white/10 transition">
                                                                        {att.file_type === 'audio' ? <Music className="w-5 h-5 text-amber-400" /> : <FileText className="w-5 h-5 text-cyan-400" />}
                                                                        <span className="text-xs underline text-white/90">{att.name}</span>
                                                                      </a>}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    <p className="text-sm whitespace-pre-wrap leading-relaxed drop-shadow-sm">{msg.content}</p>
                                                    <div className={`text-[9px] flex items-center justify-end gap-1 mt-1 ${isMe ? 'text-purple-100 opacity-80' : 'text-white/60'}`}>
                                                        {formatTime(msg.timestamp)} {isMe && <Check className="w-3 h-3" />}
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ); 
                                })}
                                {chatStatus === 'blocked_by_them' && <div className="text-center text-red-500 text-xs mt-4 bg-red-900/10 py-2 rounded-lg border border-red-500/20 mx-auto max-w-xs">User is unavailable</div>}
                            </div>

                            {/* Input Area */}
                            <div className="p-6 pt-2 bg-[#13161C]/50 border-t border-white/5 shrink-0">
                                {['blocked_by_me', 'blocked_by_them', 'pending_incoming'].includes(chatStatus) ? (
                                    <div className="text-center text-gray-500 text-sm bg-white/5 p-4 rounded-2xl border border-white/5 flex items-center justify-center gap-2"><Lock className="w-4 h-4" /> Conversation locked</div>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        {pendingAttachments.length > 0 && (
                                            <div className="flex gap-2 overflow-x-auto pb-1">
                                                {pendingAttachments.map((att, i) => (
                                                    <div key={i} className="relative bg-[#1E2229] rounded-xl w-16 h-16 flex items-center justify-center shrink-0 border border-white/10 group">
                                                        <button onClick={() => removeAttachment(i)} className="absolute -top-2 -right-2 bg-red-500 rounded-full p-0.5 shadow-lg border border-[#13161C] hover:scale-110 transition"><X className="w-3 h-3 text-white" /></button>
                                                        {att.file_type === 'image' ? <img src={att.url} className="w-full h-full object-cover rounded-lg" /> 
                                                        : att.file_type === 'video' ? <Film className="w-6 h-6 text-rose-400" /> 
                                                        : att.file_type === 'audio' ? <Music className="w-6 h-6 text-amber-400" />
                                                        : <FileText className="w-6 h-6 text-cyan-400" />}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <div className="flex gap-3 items-end">
                                            <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                                            <button onClick={() => fileInputRef.current?.click()} className={`p-3.5 bg-black/30 hover:bg-purple-900/20 text-gray-400 hover:text-purple-400 rounded-xl transition border border-white/10 hover:border-purple-500/30 ${isUploading ? 'animate-pulse opacity-50' : ''}`} disabled={isUploading}> 
                                                <Paperclip className="w-5 h-5" /> 
                                            </button>
                                            <div className="flex-1 bg-black/30 border border-white/10 focus-within:border-purple-500/50 focus-within:bg-black/50 rounded-xl flex items-center transition-all">
                                                <input className="w-full bg-transparent border-none text-sm text-gray-200 px-4 py-3.5 focus:ring-0 outline-none placeholder:text-gray-600" placeholder={isUploading ? "Uploading..." : "Type a message..."} value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} />
                                            </div>
                                            <button onClick={sendMessage} className="p-3.5 bg-gradient-to-br from-purple-600 to-pink-600 hover:opacity-90 text-white rounded-xl transition shadow-lg shadow-purple-900/30 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100" disabled={!newMessage.trim() && pendingAttachments.length === 0}> 
                                                <Send className="w-5 h-5 fill-current" /> 
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500 relative">
                             <div className="w-24 h-24 bg-white/5 rounded-3xl flex items-center justify-center mb-6 border border-white/5 animate-pulse">
                                <MessageSquare className="w-10 h-10 opacity-30 text-purple-400" />
                             </div>
                             <h3 className="text-xl font-bold text-gray-200 mb-2">Select a Conversation</h3>
                             <p className="max-w-xs text-center text-sm text-gray-500">Choose a chat from the sidebar or start a new group to begin messaging.</p>
                             <button onClick={() => setIsSidebarOpen(true)} className="md:hidden mt-6 px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl shadow-lg shadow-purple-900/20">Open Chats</button>
                        </div>
                    )}
                </div>

            </div>

            {/* --- MODALS (Updated Styles) --- */}
            
            <AnimatePresence>
                {showGroupInfo && activeChat?.type === 'group' && (
                    <motion.div initial={{ x: 300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 300, opacity: 0 }} className="absolute top-0 right-0 h-full w-80 bg-[#13161C] border-l border-white/10 z-30 p-6 shadow-2xl overflow-y-auto custom-scrollbar">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-lg text-white">Team Members</h3>
                            <button onClick={() => setShowGroupInfo(false)} className="bg-white/5 p-1.5 rounded-full hover:bg-white/10"><X className="w-4 h-4 text-gray-400" /></button>
                        </div>
                        <div className="space-y-3">
                            {groupMembers.map(m => (
                                <div key={m.id} onClick={() => { if (m.id !== userId) handleSelectChat(m.id); }} className={`flex items-center gap-3 p-3 rounded-xl border border-transparent ${m.id !== userId ? 'hover:bg-white/5 hover:border-white/5 cursor-pointer' : 'opacity-70'}`}>
                                    <img src={m.avatar_url || "https://github.com/shadcn.png"} className="w-10 h-10 rounded-xl object-cover" />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-gray-200">{m.username}</span>
                                            {m.id === activeChat.admin_id && <span className="text-[10px] bg-yellow-900/20 text-yellow-500 px-1.5 py-0.5 rounded border border-yellow-700/30">ADMIN</span>}
                                        </div>
                                        {m.id === userId && <span className="text-xs text-purple-400">You</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showProfileInfo && activeUserProfile && activeChat?.type === 'user' && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-[#13161C] border border-white/10 rounded-3xl w-full max-w-sm p-8 relative shadow-2xl">
                            <button onClick={() => setShowProfileInfo(false)} className="absolute top-4 right-4 bg-white/5 p-2 rounded-full text-gray-400 hover:text-white transition"><X className="w-4 h-4" /></button>
                            <div className="flex flex-col items-center mb-6">
                                <div className="relative">
                                    <img src={activeUserProfile.avatar_url} className="w-28 h-28 rounded-full border-4 border-[#13161C] shadow-xl" />
                                    <div className="absolute bottom-1 right-1 bg-green-500 w-5 h-5 rounded-full border-4 border-[#13161C]"></div>
                                </div>
                                <h2 className="text-2xl font-bold mt-4 text-white">{activeUserProfile.username}</h2>
                                <p className="text-gray-400 text-sm mb-3">{activeUserProfile.email}</p>
                                <div className="bg-purple-900/20 text-purple-400 px-4 py-1.5 rounded-full text-xs font-bold border border-purple-500/30">
                                    Trust Score: {activeUserProfile.trust_score.toFixed(1)}
                                </div>
                            </div>
                            <button onClick={() => router.push(`/profile/${activeUserProfile.id || activeUserProfile._id}`)} className="w-full mb-6 py-3 bg-white text-black hover:bg-gray-200 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition transform hover:scale-[1.02]">
                                <UserIcon className="w-4 h-4" /> View Full Profile
                            </button>
                            <div className="space-y-4 bg-black/20 p-4 rounded-2xl border border-white/5">
                                <div><h4 className="text-[10px] font-bold text-gray-500 uppercase mb-2 tracking-wider">Skills</h4><div className="flex flex-wrap gap-2">{activeUserProfile.skills.map((s, i) => <span key={i} className="text-xs bg-white/5 px-2 py-1 rounded text-gray-300 border border-white/5">{s.name}</span>)}</div></div>
                                <div><h4 className="text-[10px] font-bold text-gray-500 uppercase mb-2 tracking-wider">About</h4><p className="text-sm text-gray-400 leading-relaxed line-clamp-3">{activeUserProfile.about || "No bio available."}</p></div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {showInfoModal && groupDetails && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#13161C] border border-white/10 p-6 rounded-3xl w-full max-w-md shadow-2xl">
                        <div className="flex justify-between items-start mb-6">
                            <div><h2 className="text-xl font-bold text-white">Group Settings</h2>{groupDetails.is_team_group && <p className="text-xs text-blue-400 mt-1 flex items-center gap-1"><ShieldAlert className="w-3 h-3"/> Official Team Chat</p>}</div>
                            <button onClick={() => setShowInfoModal(false)} className="bg-white/5 p-2 rounded-full hover:bg-white/10"><X className="w-4 h-4 text-gray-400" /></button>
                        </div>
                        <div className="mb-6"><label className="text-xs text-gray-500 uppercase font-bold tracking-wider ml-1">Group Name</label><div className="flex gap-2 mt-2"><input className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-purple-500 transition text-white" value={editingGroupName} onChange={e => setEditingGroupName(e.target.value)} disabled={groupDetails.admin_id !== userId} />{groupDetails.admin_id === userId && (<button onClick={updateGroup} className="bg-purple-600/20 text-purple-400 p-3 rounded-xl hover:bg-purple-600 hover:text-white transition"><Check className="w-5 h-5" /></button>)}</div></div>
                        <div className="mb-6"><div className="flex justify-between items-center mb-3"><label className="text-xs text-gray-500 uppercase font-bold tracking-wider ml-1">Members ({groupDetails.members.length})</label>{groupDetails.admin_id === userId && (<button onClick={() => { setShowInfoModal(false); openAddMemberModal(); }} className="text-xs text-purple-400 hover:text-white flex items-center gap-1 bg-purple-900/10 border border-purple-500/20 px-2 py-1 rounded transition"><Plus className="w-3 h-3" /> Add</button>)}</div><div className="max-h-48 overflow-y-auto space-y-2 pr-2 custom-scrollbar">{groupDetails.members.map(m => (<div key={m.id} className="flex justify-between items-center bg-white/5 border border-white/5 p-3 rounded-xl"><div className="flex items-center gap-3"><img src={m.avatar_url} className="w-8 h-8 rounded-full" /><span className="text-sm font-medium text-gray-200">{m.username}</span>{m.id === groupDetails.admin_id && <span className="text-[10px] bg-yellow-500/20 text-yellow-500 px-1.5 rounded border border-yellow-500/20">ADMIN</span>}</div>{groupDetails.admin_id === userId && m.id !== groupDetails.admin_id && (<button onClick={() => removeGroupMember(m.id)} className="text-gray-500 hover:text-red-500 bg-black/20 p-1.5 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>)}</div>))}</div></div>
                        <div className="flex gap-3 pt-4 border-t border-white/10">
                            <button onClick={leaveGroup} className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition border border-white/5"><LogOut className="w-4 h-4" /> Leave</button>
                            <button onClick={blockGroup} className="flex-1 py-3 bg-red-900/10 hover:bg-red-900/20 text-red-400 border border-red-500/20 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition"><Ban className="w-4 h-4" /> Block</button>
                        </div>
                    </motion.div>
                </div>
            )}

            <AnimatePresence>
                {showGroupModal && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-[#13161C] border border-white/10 p-6 rounded-3xl w-full max-w-md shadow-2xl">
                            <h2 className="text-xl font-bold mb-4 text-white">Create New Group</h2>
                            <input className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 mb-4 outline-none focus:border-purple-500 transition placeholder:text-gray-600 text-white" placeholder="Enter group name..." value={groupName} onChange={e => setGroupName(e.target.value)} />
                            <p className="text-xs text-gray-500 uppercase font-bold mb-2 ml-1">Select Members</p>
                            <div className="max-h-56 overflow-y-auto space-y-2 mb-6 custom-scrollbar pr-2">
                                {contacts.map(c => (
                                    <div key={c.id} onClick={() => toggleContact(c.id)} className={`p-3 rounded-xl cursor-pointer flex items-center justify-between border transition-all ${selectedContacts.includes(c.id) ? "bg-purple-900/10 border-purple-500/30" : "bg-white/5 border-white/5 hover:bg-white/10"}`}>
                                        <div className="flex items-center gap-3">
                                            <img src={c.avatar_url} className="w-8 h-8 rounded-full" />
                                            <span className="text-sm font-medium text-gray-200">{c.username}</span>
                                        </div>
                                        {selectedContacts.includes(c.id) ? <div className="bg-purple-500 rounded-full p-1"><Check className="w-3 h-3 text-white" /></div> : <div className="w-5 h-5 rounded-full border border-gray-600"></div>}
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setShowGroupModal(false)} className="flex-1 bg-white/5 hover:bg-white/10 text-gray-400 py-3 rounded-xl font-medium transition border border-white/5">Cancel</button>
                                <button onClick={createGroup} className="flex-1 bg-white text-black py-3 rounded-xl font-bold transition shadow-lg hover:bg-gray-200">Create Group</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showAddMemberModal && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#13161C] border border-white/10 p-6 rounded-3xl w-full max-w-sm">
                            <h2 className="text-lg font-bold mb-4 text-white">Add Member</h2>
                            <div className="max-h-60 overflow-y-auto space-y-2 mb-4 custom-scrollbar pr-2">
                                {contacts.length === 0 ? <p className="text-gray-500 text-center py-4">No new contacts available.</p> : contacts.map(c => (
                                    <div key={c.id} onClick={() => addToGroup(c.id)} className="p-3 rounded-xl cursor-pointer flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/5 transition">
                                        <img src={c.avatar_url} className="w-8 h-8 rounded-full" />
                                        <span className="text-sm font-medium flex-1 text-gray-200">{c.username}</span>
                                        <div className="bg-green-500/10 p-1.5 rounded-lg border border-green-500/20"><Plus className="w-4 h-4 text-green-400" /></div>
                                    </div>
                                ))}
                            </div>
                            <button onClick={() => setShowAddMemberModal(false)} className="w-full bg-white/5 text-white py-3 rounded-xl font-medium hover:bg-white/10 transition border border-white/5">Cancel</button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

        </div>
    );
}