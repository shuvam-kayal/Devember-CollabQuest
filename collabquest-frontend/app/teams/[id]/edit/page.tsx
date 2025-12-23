"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Cookies from "js-cookie";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import GlobalHeader from "@/components/GlobalHeader";
import Link from "next/link";
import {
    Bot, Calendar, Code2, Layers, LayoutDashboard, Loader2, UserPlus, ClipboardList, CheckCircle2, RotateCcw,
    Sparkles, X, Plus, RefreshCw, Trash2, Check, AlertTriangle, MessageSquare, Mail, ThumbsUp, XCircle, Clock, Send, Edit2, Save, Users, Trophy, Star, Megaphone, Play, LogOut, UserMinus, Timer, CalendarClock
} from "lucide-react";

interface Member { id: string; username: string; avatar_url: string; email: string; }
interface DeletionRequest { is_active: boolean; votes: { [key: string]: string }; }
interface CompletionRequest { is_active: boolean; votes: { [key: string]: string }; }
interface MemberRequest { id: string; target_user_id: string; type: "leave" | "remove"; explanation: string; is_active: boolean; votes: { [key: string]: string }; }

interface Team {
    id: string; name: string; description: string; leader_id: string;
    members: Member[];
    needed_skills: string[];
    active_needed_skills: string[];
    is_looking_for_members: boolean;
    project_roadmap?: any; chat_group_id?: string;
    target_members: number; target_completion_date?: string;
    deletion_request?: DeletionRequest;
    completion_request?: CompletionRequest;
    member_requests: MemberRequest[];
    status: string;
    has_liked?: boolean;
}

interface TaskItem {
    id: string; description: string; assignee_id: string; assignee_name: string; assignee_avatar: string; deadline: string;
    status: "pending" | "review" | "completed" | "rework";
    verification_votes: number; required_votes: number; rework_votes: number; required_rework: number; is_overdue: boolean;
    extension_active: boolean; extension_votes: number; extension_required: number; was_extended: boolean;
    extension_requested_date?: string;
}

interface Candidate { id: string; name: string; avatar: string; contact: string; role: string; status: string; rejected_by?: string; }

export default function TeamDetails() {
    const params = useParams();
    const router = useRouter();
    const [team, setTeam] = useState<Team | null>(null);
    const [currentUserId, setCurrentUserId] = useState("");
    const [loading, setLoading] = useState(true);
    const [candidates, setCandidates] = useState<Candidate[]>([]);

    const [isRecruiting, setIsRecruiting] = useState(true);

    const [deletionProcessing, setDeletionProcessing] = useState(false);
    const [completionProcessing, setCompletionProcessing] = useState(false);
    const [ratingProcessing, setRatingProcessing] = useState<string | null>(null);
    const [ratedMembers, setRatedMembers] = useState<string[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);

    const [showEmailModal, setShowEmailModal] = useState(false);
    const [emailRecipient, setEmailRecipient] = useState<{ id: string, name: string } | null>(null);
    const [emailSubject, setEmailSubject] = useState("");
    const [emailBody, setEmailBody] = useState("");

    const [showExplainModal, setShowExplainModal] = useState(false);
    const [actionType, setActionType] = useState<"leave" | "remove" | null>(null);
    const [actionTargetId, setActionTargetId] = useState<string | null>(null);
    const [explanation, setExplanation] = useState("");

    const [showRatingModal, setShowRatingModal] = useState(false);
    const [ratingExplanation, setRatingExplanation] = useState("");

    const [showExtensionModal, setShowExtensionModal] = useState(false);
    const [extensionTaskId, setExtensionTaskId] = useState<string | null>(null);
    const [extensionDate, setExtensionDate] = useState("");

    const teamId = params.id as string;

    const [tasks, setTasks] = useState<TaskItem[]>([]);
    const [newTaskDesc, setNewTaskDesc] = useState("");
    const [newTaskAssignee, setNewTaskAssignee] = useState("");
    const [newTaskDeadline, setNewTaskDeadline] = useState("");
    const [isTaskLoading, setIsTaskLoading] = useState(false);

    useEffect(() => {
        const token = Cookies.get("token");
        if (!token) return router.push("/");
        axios.get("http://localhost:8000/users/me", { headers: { Authorization: `Bearer ${token}` } })
            .then(res => setCurrentUserId(res.data._id || res.data.id));
        fetchTeamData(token);

        const handleRefresh = () => { if (token) { fetchTeamData(token); fetchCandidates(token, teamId); } };
        window.addEventListener("dashboardUpdate", handleRefresh);
        return () => window.removeEventListener("dashboardUpdate", handleRefresh);
    }, [teamId]);

    const fetchTeamData = async (token: string) => {
        try {
            const res = await axios.get(`http://localhost:8000/teams/${teamId}`, { headers: { Authorization: `Bearer ${token}` } });
            setTeam(res.data);
            setIsRecruiting(res.data.is_looking_for_members);
            if (res.data.leader_id) fetchCandidates(token, res.data.id);
            fetchTasks(token);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const fetchTasks = async (token: string) => { try { const res = await axios.get(`http://localhost:8000/teams/${teamId}/tasks`, { headers: { Authorization: `Bearer ${token}` } }); setTasks(res.data); } catch (e) { } }

    const isLeader = team && currentUserId === team.leader_id;
    const isMember = team && team.members.some(m => m.id === currentUserId);

    // --- CANDIDATE FETCHING FIX ---
    const fetchCandidates = async (token: string, tid: string) => {
        try {
            const res = await axios.get(`http://localhost:8000/matches/team/${tid}`, { headers: { Authorization: `Bearer ${token}` } });
            // FIX: Map response to ensure ID is present for actions
            const mapped = res.data.map((c: any) => ({
                id: c.id || c.user_id || c._id, // Fallback for ID
                name: c.name || c.username || "Candidate",
                avatar: c.avatar || c.avatar_url || "https://github.com/shadcn.png",
                contact: c.contact || "",
                role: c.role || "Developer",
                status: c.status,
                rejected_by: c.rejected_by
            }));
            setCandidates(mapped.filter((c: Candidate) => c.status !== "joined"));
        } catch (e) { }
    }

    const toggleRecruiting = async () => { const token = Cookies.get("token"); const newState = !isRecruiting; setIsRecruiting(newState); try { await axios.put(`http://localhost:8000/teams/${teamId}`, { is_looking_for_members: newState }, { headers: { Authorization: `Bearer ${token}` } }); } catch (e) { alert("Failed to toggle status"); setIsRecruiting(!newState); } }
    const handleStartProject = async () => { if (!confirm("Start the project? This enables task management.")) return; const token = Cookies.get("token"); try { await axios.put(`http://localhost:8000/teams/${teamId}`, { status: "active" }, { headers: { Authorization: `Bearer ${token}` } }); fetchTeamData(token!); } catch (e) { alert("Failed to start project"); } }
    const handleLeave = () => { setActionType("leave"); setExplanation(""); setShowExplainModal(true); };
    const handleRemove = (memberId: string) => { setActionType("remove"); setActionTargetId(memberId); setExplanation(""); setShowExplainModal(true); };
    const handleConfirmAction = async () => { if (!explanation.trim()) return alert("Explanation required."); const token = Cookies.get("token"); try { if (actionType === "leave") { const res = await axios.post(`http://localhost:8000/teams/${teamId}/leave`, { explanation }, { headers: { Authorization: `Bearer ${token}` } }); if (res.data.status === "left") { alert("You left the team."); router.push("/dashboard"); } else { alert("Leave vote initiated."); fetchTeamData(token!); } } else if (actionType === "remove" && actionTargetId) { const res = await axios.post(`http://localhost:8000/teams/${teamId}/members/${actionTargetId}/remove`, { explanation }, { headers: { Authorization: `Bearer ${token}` } }); if (res.data.status === "removed") { alert("Member removed."); fetchTeamData(token!); } else { alert("Removal vote initiated."); fetchTeamData(token!); } } setShowExplainModal(false); } catch (e) { alert("Action failed"); } };
    const handleVoteRequest = async (reqId: string, decision: 'approve' | 'reject') => { const token = Cookies.get("token"); try { await axios.post(`http://localhost:8000/teams/${teamId}/member-request/${reqId}/vote`, { decision }, { headers: { Authorization: `Bearer ${token}` } }); alert("Vote recorded."); fetchTeamData(token!); } catch (e) { alert("Vote failed"); } };
    const handleAssignTask = async () => { if (!newTaskDesc || !newTaskAssignee || !newTaskDeadline) return alert("Fill all fields"); const token = Cookies.get("token"); setIsTaskLoading(true); try { await axios.post(`http://localhost:8000/teams/${teamId}/tasks`, { description: newTaskDesc, assignee_id: newTaskAssignee, deadline: newTaskDeadline }, { headers: { Authorization: `Bearer ${token}` } }); setNewTaskDesc(""); setNewTaskDeadline(""); fetchTasks(token!); } catch (e) { alert("Failed to assign"); } finally { setIsTaskLoading(false); } };
    const handleDeleteTask = async (taskId: string) => { if (!confirm("Delete this task?")) return; const token = Cookies.get("token"); try { await axios.delete(`http://localhost:8000/teams/${teamId}/tasks/${taskId}`, { headers: { Authorization: `Bearer ${token}` } }); fetchTasks(token!); } catch (e) { alert("Failed to delete"); } }
    const handleVerifyTask = async (taskId: string) => { const token = Cookies.get("token"); try { await axios.post(`http://localhost:8000/teams/${teamId}/tasks/${taskId}/verify`, {}, { headers: { Authorization: `Bearer ${token}` } }); fetchTasks(token!); } catch (e) { alert("Action Failed"); } };
    const handleReworkTask = async (taskId: string) => { const token = Cookies.get("token"); try { await axios.post(`http://localhost:8000/teams/${teamId}/tasks/${taskId}/rework`, {}, { headers: { Authorization: `Bearer ${token}` } }); fetchTasks(token!); } catch (e) { alert("Action Failed"); } };
    const handleSubmitTask = async (taskId: string) => { const token = Cookies.get("token"); try { await axios.post(`http://localhost:8000/teams/${teamId}/tasks/${taskId}/submit`, {}, { headers: { Authorization: `Bearer ${token}` } }); fetchTasks(token!); } catch (e) { alert("Failed"); } };
    const openExtensionModal = (taskId: string) => { setExtensionTaskId(taskId); setExtensionDate(""); setShowExtensionModal(true); };
    const confirmExtensionRequest = async () => { if (!extensionDate || !extensionTaskId) return alert("Select a date."); const token = Cookies.get("token"); try { await axios.post(`http://localhost:8000/teams/${teamId}/tasks/${extensionTaskId}/extend/initiate`, { new_deadline: extensionDate }, { headers: { Authorization: `Bearer ${token}` } }); alert("Extension vote initiated."); setShowExtensionModal(false); fetchTasks(token!); } catch (e) { alert("Failed to request extension"); } };
    const handleVoteExtension = async (taskId: string, decision: 'approve' | 'reject') => { const token = Cookies.get("token"); try { await axios.post(`http://localhost:8000/teams/${teamId}/tasks/${taskId}/extend/vote`, { decision }, { headers: { Authorization: `Bearer ${token}` } }); alert("Vote recorded."); fetchTasks(token!); } catch (e) { alert("Failed to vote"); } }
    const handleInitiateDelete = async () => { if (!confirm("Start vote?")) return; const token = Cookies.get("token"); try { setDeletionProcessing(true); const res = await axios.post(`http://localhost:8000/teams/${teamId}/delete/initiate`, {}, { headers: { Authorization: `Bearer ${token}` } }); if (res.data.status === "deleted") { alert("Team deleted!"); router.push("/dashboard"); return; } alert("Vote initiated!"); fetchTeamData(token!); } catch (e) { alert("Failed"); } finally { setDeletionProcessing(false); } };
    const handleVoteDelete = async (decision: 'approve' | 'reject') => { const token = Cookies.get("token"); try { setDeletionProcessing(true); const res = await axios.post(`http://localhost:8000/teams/${teamId}/delete/vote`, { decision }, { headers: { Authorization: `Bearer ${token}` } }); if (res.data.status === "deleted") { alert("Team deleted!"); router.push("/dashboard"); } else { alert("Vote recorded."); fetchTeamData(token!); } } catch (e) { alert("Failed"); } finally { setDeletionProcessing(false); } };
    const handleInitiateComplete = async () => { if (!confirm("Mark project completed? \n\nWARNING: This will LOCK the project. You will no longer be able to edit team details, members, or tasks.")) return; const token = Cookies.get("token"); try { setCompletionProcessing(true); const res = await axios.post(`http://localhost:8000/teams/${teamId}/complete/initiate`, {}, { headers: { Authorization: `Bearer ${token}` } }); if (res.data.status === 'completed') { alert("Completed!"); } else { alert("Vote initiated!"); } fetchTeamData(token!); } catch (e) { alert("Failed"); } finally { setCompletionProcessing(false); } }
    const handleVoteComplete = async (decision: 'approve' | 'reject') => { const token = Cookies.get("token"); try { setCompletionProcessing(true); const res = await axios.post(`http://localhost:8000/teams/${teamId}/complete/vote`, { decision }, { headers: { Authorization: `Bearer ${token}` } }); if (res.data.status === "completed") alert("Completed!"); else alert("Vote recorded."); fetchTeamData(token!); } catch (e) { alert("Failed"); } finally { setCompletionProcessing(false); } };
    const handleRateMember = async (targetId: string, score: number) => { const token = Cookies.get("token"); setRatingProcessing(targetId); try { await axios.post(`http://localhost:8000/teams/${teamId}/rate`, { target_user_id: targetId, score, explanation: ratingExplanation }, { headers: { Authorization: `Bearer ${token}` } }); setRatedMembers([...ratedMembers, targetId]); setRatingExplanation(""); alert("Rated!"); } catch (e) { alert("Failed"); } finally { setRatingProcessing(null); } }

    // --- ACCEPT/REJECT LOGIC ---
    const sendInvite = async (c: Candidate) => { const token = Cookies.get("token"); try { setCandidates(prev => prev.map(m => m.id === c.id ? { ...m, status: "invited" } : m)); await axios.post(`http://localhost:8000/teams/${teamId}/invite`, { target_user_id: c.id }, { headers: { Authorization: `Bearer ${token}` } }); } catch (err) { alert("Failed"); fetchCandidates(token!, teamId); } }

    const acceptRequest = async (c: Candidate) => {
        const token = Cookies.get("token");
        try {
            await axios.post(`http://localhost:8000/teams/${teamId}/members`, { target_user_id: c.id }, { headers: { Authorization: `Bearer ${token}` } });
            fetchTeamData(token!);
            fetchCandidates(token!, teamId);
            window.dispatchEvent(new Event("dashboardUpdate"));
        } catch (err) { alert("Failed"); }
    }

    const rejectRequest = async (c: Candidate) => {
        if (!confirm("Reject?")) return;
        const token = Cookies.get("token");
        try {
            await axios.post(`http://localhost:8000/teams/${teamId}/reject`, { target_user_id: c.id }, { headers: { Authorization: `Bearer ${token}` } });
            fetchCandidates(token!, teamId);
            window.dispatchEvent(new Event("dashboardUpdate"));
        } catch (err) { alert("Failed"); }
    }

    const deleteCandidate = async (c: Candidate) => { if (!confirm("Remove?")) return; const token = Cookies.get("token"); try { await axios.delete(`http://localhost:8000/matches/delete/${teamId}/${c.id}`, { headers: { Authorization: `Bearer ${token}` } }); fetchCandidates(token!, teamId); } catch (err) { alert("Failed"); } }
    const createTeamChat = async () => { const token = Cookies.get("token"); try { const res = await axios.post(`http://localhost:8000/chat/groups/team/${teamId}`, {}, { headers: { Authorization: `Bearer ${token}` } }); router.push(`/chat?targetId=${res.data._id || res.data.id}`); } catch (err) { alert("Failed"); } };
    const removeMember = async (memberId: string) => { if (!confirm("Remove?")) return; const token = Cookies.get("token"); try { await axios.delete(`http://localhost:8000/teams/${teamId}/members/${memberId}`, { headers: { Authorization: `Bearer ${token}` } }); if (token) fetchTeamData(token); } catch (err) { alert("Failed"); } };
    const likeProject = async () => {
        const token = Cookies.get("token");
        try {
            const res = await axios.post("http://localhost:8000/matches/swipe", {
                target_id: teamId,
                direction: "right",
                type: "project",
                related_id: teamId
            }, { headers: { Authorization: `Bearer ${token}` } });

            if (res.data.status === "cooldown") {
                alert("Wait cooldown.");
            } else {
                alert("Interest Sent! The team leader has been notified.");
                if (team) setTeam({ ...team, has_liked: true });

                // FIX: Refresh the candidate list for leader if they are viewing their own project
                // and notify GlobalHeader to update badges.
                window.dispatchEvent(new Event("dashboardUpdate"));
                window.dispatchEvent(new Event("triggerNotificationRefresh"));
            }
        } catch (err) {
            alert("Failed to send interest.");
        }
    }
    const openEmailComposer = (u: any) => { setEmailRecipient({ id: u.id, name: u.username || u.name }); setShowEmailModal(true); }
    const handleSendEmail = async () => { const token = Cookies.get("token"); if (!emailRecipient) return; try { await axios.post("http://localhost:8000/communication/send-email", { recipient_id: emailRecipient.id, subject: emailSubject, body: emailBody }, { headers: { Authorization: `Bearer ${token}` } }); alert("Email sent!"); setShowEmailModal(false); } catch (err) { alert("Failed"); } }
    const generateRoadmap = async () => { setIsGenerating(true); const token = Cookies.get("token"); try { await axios.post(`http://localhost:8000/teams/${teamId}/roadmap`, {}, { headers: { Authorization: `Bearer ${token}` } }); if (token) fetchTeamData(token); } catch (err) { alert("Failed"); } finally { setIsGenerating(false); } };

    if (loading || !team) return <div className="flex h-screen items-center justify-center bg-gray-950 text-white"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            <GlobalHeader />
            <div className="max-w-6xl mx-auto p-8">
                {/* ... (Vote Panels) ... */}
                {team.member_requests && team.member_requests.filter(r => r.is_active).map(req => { const hasVoted = req.votes[currentUserId]; const approv = Object.values(req.votes).filter(v => v === 'approve').length; const needed = Math.ceil(team.members.length * 0.7); const targetName = team.members.find(m => m.id === req.target_user_id)?.username || "Member"; return (<div key={req.id} className="mb-8 bg-yellow-900/20 border border-yellow-500/50 p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4"><div className="flex items-center gap-4"><div className="p-3 bg-yellow-500/20 rounded-full text-yellow-400"><UserMinus className="w-6 h-6" /></div><div><h3 className="text-lg font-bold text-yellow-400">Vote: {req.type === "leave" ? `Member wants to leave` : `Remove Member`}</h3><p className="text-sm text-gray-300 italic">"{req.explanation}"</p><p className="text-xs text-gray-500 mt-1">{approv} / {needed} votes needed.</p></div></div>{hasVoted ? (<div className="text-gray-400 text-sm font-bold bg-gray-800 px-4 py-2 rounded-lg">Voted</div>) : (<div className="flex gap-3"><button onClick={() => handleVoteRequest(req.id, 'approve')} className="px-4 py-2 bg-green-600 rounded-lg font-bold text-sm">Approve</button><button onClick={() => handleVoteRequest(req.id, 'reject')} className="px-4 py-2 bg-gray-700 rounded-lg font-bold text-sm">Reject</button></div>)}</div>); })}
                {team?.deletion_request?.is_active && (<div className="mb-8 bg-red-900/20 border border-red-500/50 p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4"><div className="flex items-center gap-4"><div className="p-3 bg-red-500/20 rounded-full text-red-400"><AlertTriangle className="w-6 h-6" /></div><div><h3 className="text-lg font-bold text-red-400">Deletion Vote Active</h3><p className="text-sm text-gray-400">{Object.values(team.deletion_request.votes).filter(v => v === 'approve').length} / {Math.ceil(team.members.length * 0.7)} votes needed.</p></div></div>{team.deletion_request.votes[currentUserId] ? <div className="text-gray-400 text-sm font-bold bg-gray-800 px-4 py-2 rounded-lg">Voted: <span className={team.deletion_request.votes[currentUserId] === 'approve' ? "text-red-400" : "text-green-400"}>{team.deletion_request.votes[currentUserId].toUpperCase()}</span></div> : <div className="flex gap-3"><button onClick={() => handleVoteDelete('approve')} disabled={deletionProcessing} className="px-4 py-2 bg-red-600 rounded-lg font-bold text-sm">Delete</button><button onClick={() => handleVoteDelete('reject')} disabled={deletionProcessing} className="px-4 py-2 bg-gray-700 rounded-lg font-bold text-sm">Keep</button></div>}</div>)}
                {team.status === 'active' && team.completion_request?.is_active && (<div className="mb-8 bg-green-900/20 border border-green-500/50 p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4"><div className="flex items-center gap-4"><div className="p-3 bg-green-500/20 rounded-full text-green-400"><Check className="w-6 h-6" /></div><div><h3 className="text-lg font-bold text-green-400">Completion Vote</h3><p className="text-sm text-gray-400">{Object.values(team.completion_request.votes).filter(v => v === 'approve').length} / {Math.ceil(team.members.length * 0.7)} votes needed.</p></div></div>{team.completion_request.votes[currentUserId] ? <div className="text-gray-400 text-sm font-bold bg-gray-800 px-4 py-2 rounded-lg">Voted: <span className={team.completion_request.votes[currentUserId] === 'approve' ? "text-green-400" : "text-red-400"}>{team.completion_request.votes[currentUserId].toUpperCase()}</span></div> : <div className="flex gap-3"><button onClick={() => handleVoteComplete('approve')} disabled={completionProcessing} className="px-4 py-2 bg-green-600 rounded-lg font-bold text-sm">Confirm</button><button onClick={() => handleVoteComplete('reject')} disabled={completionProcessing} className="px-4 py-2 bg-gray-700 rounded-lg font-bold text-sm">Reject</button></div>}</div>)}

                <header className="mb-8 border-b border-gray-800 pb-8">
                    <div className="flex justify-between items-start mb-6">
                        <div className="flex-1">
                            {/* ... */}
                            <div className="flex flex-col gap-1 mb-4">
                                <div className="flex items-center gap-3">
                                    <h1 className="text-4xl font-extrabold bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent">{team.name}</h1>
                                    {isLeader && team.status !== "completed" && <Link href={`/teams/${team.id}/edit`}><button className="text-gray-500 hover:text-purple-400 bg-gray-900 p-2 rounded-full border border-gray-800"><Edit2 className="w-5 h-5" /></button></Link>}
                                </div>
                                <div className="flex items-center gap-4">
                                    {isRecruiting ? <span className="text-xs font-bold bg-green-900/30 text-green-400 border border-green-500/50 px-2 py-0.5 rounded-full flex items-center gap-1"><Megaphone className="w-3 h-3" /> Recruiting</span> : <span className="text-xs font-bold bg-gray-800 text-gray-500 border border-gray-700 px-2 py-0.5 rounded-full">Positions Filled</span>}
                                    {team.status === "completed" && <span className="text-xs font-bold bg-blue-900/30 text-blue-400 border border-blue-500/50 px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> COMPLETED & LOCKED</span>}
                                </div>
                            </div>
                            {/* ... */}
                            <p className="text-gray-400 max-w-2xl text-lg mb-4">{team.description}</p>
                            {team.active_needed_skills && team.active_needed_skills.length > 0 ? (<div className="mb-4"><p className="text-xs text-blue-400 font-bold uppercase mb-2">Open Roles</p><div className="flex flex-wrap gap-2">{team.active_needed_skills.map(s => <span key={s} className="bg-blue-900/20 text-blue-300 border border-blue-500/30 px-3 py-1 rounded-full text-sm font-medium">{s}</span>)}</div></div>) : (<div className="mb-4"><p className="text-xs text-blue-400 font-bold uppercase mb-2">Open Roles</p><p className="text-sm text-gray-500 italic">No Active Positions</p></div>)}
                            <div className="flex gap-6 text-sm text-gray-500 mb-4"><div className="flex items-center gap-2"><Users className="w-4 h-4 text-purple-400" /> {team.members.length} / {team.target_members} Members</div>{team.target_completion_date && <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-blue-400" /> Target: {new Date(team.target_completion_date).toLocaleDateString()}</div>}</div>
                        </div>

                        <div className="flex flex-col gap-2 items-end">
                            {/* ... Buttons ... */}
                            {team.status === 'completed' && (<button onClick={() => setShowRatingModal(true)} className="w-full px-6 py-3 bg-yellow-600 text-white rounded-lg font-bold hover:bg-yellow-500 transition flex items-center justify-center gap-2 shadow-lg mb-2"><Star className="w-5 h-5" /> Rate Team</button>)}
                            {isLeader && team.status !== "completed" && (<><Link href={`/matches?type=users&projectId=${team.id}`}><button className="w-full px-6 py-3 bg-white text-black rounded-lg font-bold hover:bg-gray-200 transition flex items-center justify-center gap-2 shadow-lg"><UserPlus className="w-5 h-5 text-purple-600" /> Recruit</button></Link><button onClick={team.chat_group_id ? () => router.push(`/chat?targetId=${team.chat_group_id}`) : createTeamChat} className="w-full px-6 py-3 bg-gray-800 text-blue-400 border border-blue-900 rounded-lg font-bold hover:bg-gray-700 transition flex items-center justify-center gap-2"><MessageSquare className="w-5 h-5" /> {team.chat_group_id ? "Open Team Chat" : "Create Team Chat"}</button></>)}
                            {isLeader && team.status !== "completed" && (<>{team.status === 'planning' ? (<button onClick={handleStartProject} className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-500 transition flex items-center justify-center gap-2 shadow-lg mt-2 animate-pulse"><Play className="w-5 h-5" /> Start Project</button>) : (team.status === 'active' && <button disabled className="w-full px-6 py-3 bg-green-500/20 text-green-400 border border-green-500/50 rounded-lg font-bold flex items-center justify-center gap-2 mt-2 cursor-default"><CheckCircle2 className="w-5 h-5" /> Project Online</button>)}</>)}
                            {team.status === "completed" && team.chat_group_id && <button onClick={() => router.push(`/chat?targetId=${team.chat_group_id}`)} className="w-full px-6 py-3 bg-gray-800 text-blue-400 border border-blue-900 rounded-lg font-bold hover:bg-gray-700 transition flex items-center justify-center gap-2"><MessageSquare className="w-5 h-5" /> Team Chat</button>}
                            {!isMember && (<button onClick={likeProject} disabled={team.has_liked} className={`w-full px-6 py-3 rounded-lg font-bold transition flex items-center justify-center gap-2 shadow-lg ${team.has_liked ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-purple-600 text-white hover:bg-purple-500'}`}><ThumbsUp className="w-5 h-5" /> {team.has_liked ? "Interest Sent" : "I'm Interested"}</button>)}
                            {isMember && !isLeader && (<>{team.chat_group_id && team.status !== "completed" && <button onClick={() => router.push(`/chat?targetId=${team.chat_group_id}`)} className="w-full px-6 py-3 bg-gray-800 text-blue-400 border border-blue-900 rounded-lg font-bold hover:bg-gray-700 transition flex items-center justify-center gap-2"><MessageSquare className="w-5 h-5" /> Team Chat</button>}{team.status !== "completed" && <button onClick={handleLeave} className="w-full mt-2 px-6 py-3 bg-red-900/20 text-red-400 border border-red-900/50 rounded-lg font-bold hover:bg-red-900/40 transition flex items-center justify-center gap-2"><LogOut className="w-5 h-5" /> Leave Team</button>}</>)}
                        </div>
                    </div>
                    {/* ... (Tech Stack & Members - Unchanged) ... */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-2 bg-gray-900/50 p-6 rounded-2xl border border-gray-800"><div className="flex justify-between items-center mb-4"><h3 className="font-bold flex items-center gap-2"><Code2 className="text-purple-400 w-5 h-5" /> Tech Stack</h3></div><div className="flex flex-wrap gap-2">{team.needed_skills.map((skill, k) => <span key={k} className="bg-gray-800 px-3 py-1 rounded-full text-sm border border-gray-700 flex items-center gap-2">{skill}</span>)}</div></div>
                        <div className="bg-gray-900/50 p-6 rounded-2xl border border-gray-800"><h3 className="font-bold flex items-center gap-2 mb-4"><UserPlus className="text-green-400 w-5 h-5" /> Team ({team.members.length})</h3><div className="space-y-3">{team.members.map((m: any, i: number) => (<div key={m.id || i} className="flex items-center justify-between group">
                            <div
                                className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition"
                                onClick={() => router.push(`/profile/${m.id}`)} // Redirect to Public Profile
                            >
                                <img src={m.avatar_url || "https://github.com/shadcn.png"} className="w-8 h-8 rounded-full bg-gray-800" />
                                <div>
                                    <p className="text-sm font-bold leading-none">{m.username}</p>
                                    {m.id === team.leader_id && <span className="text-[10px] text-yellow-500 font-mono">LEADER</span>}
                                </div>
                            </div><div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">{(isMember && m.id !== currentUserId) || (!isMember && m.id === team.leader_id) ? <><Link href={`/chat?targetId=${m.id}`} title="Chat"><button className="text-gray-500 hover:text-blue-400 p-1"><MessageSquare className="w-4 h-4" /></button></Link><button onClick={() => openEmailComposer(m)} title="Email" className="text-gray-500 hover:text-green-400 p-1"><Mail className="w-4 h-4" /></button></> : null}{isLeader && m.id !== team.leader_id && team.status !== "completed" && <button onClick={() => handleRemove(m.id)} title="Remove" className="text-gray-500 hover:text-red-500 p-1"><Trash2 className="w-4 h-4" /></button>}</div></div>))}</div></div>
                    </div>
                </header>

                {/* --- CANDIDATES LIST SECTION --- */}
                {isLeader && candidates.length > 0 && (
                    <div className="mb-12 bg-gray-900 border border-blue-900/30 p-8 rounded-2xl">
                        <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-blue-300"><UserPlus className="w-5 h-5" /> Interested Candidates</h3>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">{candidates.map(c => (<div key={c.id} className="bg-gray-800 p-6 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between border border-gray-700 gap-4"><div className="flex items-center gap-4"><img src={c.avatar} className="w-12 h-12 rounded-full" /><div><h4 className="font-bold text-base">{c.name}</h4><p className="text-xs text-gray-400">Match Score</p></div></div><div className="flex gap-2 flex-wrap justify-end w-full sm:w-auto">{c.status === "matched" && (<><button onClick={() => sendInvite(c)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm flex items-center gap-2 font-bold"><Plus className="w-4 h-4" /> Invite</button><button onClick={() => deleteCandidate(c)} className="bg-gray-700 hover:bg-red-900 px-3 rounded text-red-400"><Trash2 className="w-4 h-4" /></button></>)}{c.status === "requested" && (<><button onClick={() => acceptRequest(c)} className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded text-sm flex items-center gap-2 font-bold"><Check className="w-4 h-4" /> Accept</button><button onClick={() => rejectRequest(c)} className="bg-red-900 hover:bg-red-800 text-red-200 px-3 py-2 rounded text-sm"><X className="w-4 h-4" /></button></>)}{c.status === "invited" && <span className="text-sm text-gray-500 flex items-center gap-1 px-2"><Clock className="w-4 h-4" /> Pending</span>}{c.status === "rejected" && <span className="text-sm text-red-400 bg-red-900/20 px-3 py-1 rounded font-bold">Rejected</span>}<Link href={`/chat?targetId=${c.id}`}><button className="bg-gray-700 p-2 rounded hover:text-blue-300"><MessageSquare className="w-4 h-4" /></button></Link><button onClick={() => openEmailComposer(c)} className="bg-gray-700 p-2 rounded hover:text-green-300"><Mail className="w-4 h-4" /></button>{c.status !== "matched" && c.status !== "requested" && (<button onClick={() => deleteCandidate(c)} className="bg-gray-700 p-2 rounded hover:text-red-400"><Trash2 className="w-4 h-4" /></button>)}</div></div>))}</div>
                    </div>
                )}

                {/* ... (Roadmap, Workflow - Unchanged) ... */}
                <div className="space-y-6 mb-12"><div className="flex items-center justify-between"><h2 className="text-2xl font-bold flex items-center gap-3"><Calendar className="text-purple-500" /> Execution Roadmap</h2>{isLeader && team.status !== "completed" && team.project_roadmap && team.project_roadmap.phases && <button onClick={generateRoadmap} disabled={isGenerating} className="text-xs flex items-center gap-2 text-gray-400 hover:text-white transition">{isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Regenerate</button>}</div>{!team.project_roadmap || !team.project_roadmap.phases ? <div className="text-center py-20 bg-gray-900/30 rounded-3xl border border-gray-800/50"><Bot className="w-16 h-16 mx-auto text-gray-700 mb-4" /><p className="text-gray-500 mb-6">No roadmap yet.</p>{isLeader ? <button onClick={generateRoadmap} disabled={isGenerating} className="px-8 py-4 bg-purple-600 hover:bg-purple-700 rounded-full font-bold transition flex items-center gap-2 mx-auto">{isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles className="w-5 h-5" />} Generate Plan</button> : <p className="text-sm text-gray-600">Waiting for team leader to generate plan.</p>}</div> : <div className="relative border-l-2 border-gray-800 ml-4 space-y-12 pb-12">{team.project_roadmap.phases.map((phase: any, i: number) => <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.2 }} className="relative pl-10"><div className="absolute -left-[9px] top-0 w-4 h-4 bg-purple-500 rounded-full border-4 border-gray-950 shadow-[0_0_10px_rgba(168,85,247,0.5)]"></div><div className="mb-2 flex items-center gap-3"><span className="text-purple-400 font-bold font-mono text-lg">Week {phase.week}</span><span className="text-gray-600">|</span><h3 className="text-xl font-semibold text-white">{phase.goal}</h3></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">{phase.tasks.map((task: any, j: number) => <div key={j} className="bg-gray-900 border border-gray-800 p-4 rounded-xl flex gap-4 hover:border-gray-700 transition"><div className="mt-1">{task.role.toLowerCase().includes('front') ? <LayoutDashboard className="w-5 h-5 text-blue-400" /> : task.role.toLowerCase().includes('back') ? <Code2 className="w-5 h-5 text-green-400" /> : <Layers className="w-5 h-5 text-orange-400" />}</div><div><span className="text-xs font-mono text-gray-500 uppercase tracking-wider block mb-1">{task.role}</span><p className="text-gray-300 text-sm leading-relaxed">{task.task}</p></div></div>)}</div></motion.div>)}</div>}</div>

                {team.status !== 'planning' && team.status !== 'completed' && (
                    <div className="mb-12">
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><ClipboardList className="text-blue-400" /> Project Workflow</h2>
                        {isLeader && (<div className="bg-gray-900 border border-gray-800 p-4 rounded-xl mb-6 flex flex-col md:flex-row gap-4 items-end"><div className="flex-grow w-full"><label className="text-xs text-gray-500 mb-1 block">Task Description</label><input className="w-full bg-gray-950 border border-gray-700 rounded p-2 text-sm" placeholder="e.g. Design Database Schema" value={newTaskDesc} onChange={e => setNewTaskDesc(e.target.value)} /></div><div className="w-full md:w-48"><label className="text-xs text-gray-500 mb-1 block">Assign To</label><select className="w-full bg-gray-950 border border-gray-700 rounded p-2 text-sm cursor-pointer" value={newTaskAssignee} onChange={e => setNewTaskAssignee(e.target.value)}><option value="">Select Member</option>{team.members.map(m => <option key={m.id} value={m.id}>{m.username}</option>)}</select></div><div className="w-full md:w-48"><label className="text-xs text-gray-500 mb-1 block">Deadline</label><input type="datetime-local" className="w-full bg-gray-950 border border-gray-700 rounded p-2 text-sm text-gray-400" style={{ colorScheme: 'dark' }} value={newTaskDeadline} onChange={e => setNewTaskDeadline(e.target.value)} /></div><button onClick={handleAssignTask} disabled={isTaskLoading} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm font-bold flex items-center gap-2 h-10">{isTaskLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <Plus className="w-4 h-4" />} Assign</button></div>)}
                        <div className="space-y-6">{team?.members.map(member => {
                            const memberTasks = tasks.filter(t => t.assignee_id === member.id);
                            if (memberTasks.length === 0) return null;
                            return (
                                <div key={member.id} className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
                                    <div className="flex items-center gap-2 mb-4 border-b border-gray-800 pb-2"><img src={member.avatar_url || "https://github.com/shadcn.png"} className="w-6 h-6 rounded-full" /><h3 className="font-bold text-gray-300">{member.username}'s Tasks</h3></div>
                                    <div className="space-y-3">{memberTasks.map(task => {
                                        const isMyTask = task.assignee_id === currentUserId;

                                        // --- STYLING LOGIC ---
                                        let statusColor = "border-gray-800 bg-gray-900";
                                        const timeLeft = new Date(task.deadline).getTime() - Date.now();
                                        const isEndingSoon = timeLeft > 0 && timeLeft < 86400000; // < 24h

                                        if (task.status === 'rework') statusColor = "border-red-500/50 bg-red-900/10";
                                        else if (task.is_overdue) statusColor = "border-red-900/50 bg-red-900/10 shadow-[0_0_10px_rgba(239,68,68,0.2)]";
                                        else if (task.status === 'completed') statusColor = "border-green-900/50 bg-green-900/10 opacity-70";
                                        else if (task.was_extended && !task.is_overdue) statusColor = "border-purple-500/50 bg-purple-900/10 shadow-[0_0_10px_rgba(168,85,247,0.2)]";
                                        else if (isEndingSoon && !task.status.includes('completed')) statusColor = "border-orange-500/50 bg-orange-900/10";
                                        else if (task.status === 'review') statusColor = "border-yellow-600/50 bg-yellow-900/10";

                                        return (
                                            <div key={task.id} className={`border p-4 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4 ${statusColor}`}>
                                                <div className="flex items-start gap-4 flex-1">
                                                    <div className={`mt-1 p-2 rounded-full ${task.status === 'completed' ? 'bg-green-500/20 text-green-400' : task.status === 'rework' ? 'bg-red-500/20 text-red-400' : 'bg-gray-800 text-gray-400'}`}>{task.status === 'completed' ? <CheckCircle2 className="w-5 h-5" /> : task.status === 'rework' ? <RotateCcw className="w-5 h-5" /> : <Clock className="w-5 h-5" />}</div>
                                                    <div>
                                                        <h4 className={`font-bold ${task.status === 'completed' ? 'line-through text-gray-500' : 'text-white'}`}>{task.description}</h4>
                                                        <div className="flex flex-wrap gap-4 mt-1 text-xs text-gray-400">
                                                            <span className={`flex items-center gap-1 ${task.is_overdue ? 'text-red-400 font-bold' : ''}`}>
                                                                <Calendar className="w-3 h-3" /> {new Date(task.deadline).toLocaleString()}
                                                                {task.is_overdue && " (LATE)"}
                                                                {task.was_extended && !task.is_overdue && <span className="text-purple-400 font-bold ml-1 flex items-center gap-1"><CalendarClock className="w-3 h-3" /> Extended</span>}
                                                                {isEndingSoon && !task.is_overdue && <span className="text-orange-400 font-bold ml-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Ending Soon</span>}
                                                            </span>

                                                            {task.is_overdue && !task.status.includes('completed') && (
                                                                task.extension_active
                                                                    ? <span className="text-yellow-400 font-bold flex items-center gap-1"><Timer className="w-3 h-3" /> Extension to {new Date(task.extension_requested_date || "").toLocaleDateString()} ({task.extension_votes}/{task.extension_required})</span>
                                                                    : (isMyTask && <button onClick={() => openExtensionModal(task.id)} className="text-blue-400 hover:underline">Request Extension</button>)
                                                            )}
                                                            {task.extension_active && !isMyTask && (
                                                                <div className="flex gap-2 ml-2">
                                                                    <button onClick={() => handleVoteExtension(task.id, 'approve')} className="text-green-400 hover:underline">Approve Ext.</button>
                                                                    <button onClick={() => handleVoteExtension(task.id, 'reject')} className="text-red-400 hover:underline">Reject Ext.</button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                {/* ACTION BUTTONS (Standard) */}
                                                <div className="flex items-center gap-2">{(task.status === 'pending' || task.status === 'rework') && isMyTask && (<button onClick={() => handleSubmitTask(task.id)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-bold">Mark Done</button>)}{task.status === 'review' && !isMyTask && (<div className="flex gap-2"><button onClick={() => handleVerifyTask(task.id)} className="bg-green-600 hover:bg-green-500 text-white px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1" title="Verify Work"><Check className="w-3 h-3" /> Verify</button><button onClick={() => handleReworkTask(task.id)} className="bg-red-600 hover:bg-red-500 text-white px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1" title="Request Rework"><RotateCcw className="w-3 h-3" /> Rework</button></div>)}{task.status === 'review' && isMyTask && (<span className="text-xs text-yellow-500 animate-pulse font-mono px-2">In Review...</span>)}{isLeader && (<button onClick={() => handleDeleteTask(task.id)} className="text-gray-600 hover:text-red-500 p-2"><Trash2 className="w-4 h-4" /></button>)}</div>
                                            </div>
                                        );
                                    })}</div>
                                </div>
                            );
                        })}</div>
                    </div>
                )}
            </div>

            {/* ... (Modals: Email, Explanation, Rating, Extension - Unchanged) ... */}
            <AnimatePresence>{showEmailModal && emailRecipient && (<div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"><motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-gray-900 border border-gray-800 p-8 rounded-2xl w-full max-w-md relative"><div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold flex items-center gap-2"><Mail className="w-5 h-5" /> Send Secure Message</h2><button onClick={() => setShowEmailModal(false)}><X className="text-gray-500 hover:text-white" /></button></div><div className="space-y-4 mt-4"><div className="bg-gray-800/50 p-3 rounded-lg text-sm text-gray-400">To: <span className="text-white font-bold">{emailRecipient.name}</span> (Email Hidden)</div><input className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 outline-none focus:border-green-500" placeholder="Subject" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} /><textarea className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 h-32 outline-none focus:border-green-500 resize-none" placeholder="Message" value={emailBody} onChange={e => setEmailBody(e.target.value)} /><button onClick={handleSendEmail} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2"><Send className="w-4 h-4" /> Send Message</button></div></motion.div></div>)}</AnimatePresence>
            <AnimatePresence>{showExplainModal && (<div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"><motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-gray-900 border border-gray-800 p-6 rounded-2xl w-full max-w-md"><h2 className="text-xl font-bold mb-4">{actionType === "leave" ? "Leave Project" : "Remove Member"}</h2><p className="text-sm text-gray-400 mb-4">Please provide a reason for this action. {team?.status === "active" ? "This will initiate a team vote." : "This will happen immediately."}</p><textarea className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 h-24 mb-4 outline-none resize-none" placeholder="Reason..." value={explanation} onChange={e => setExplanation(e.target.value)} /><div className="flex gap-2"><button onClick={handleConfirmAction} className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2 rounded-lg font-bold">Confirm</button><button onClick={() => setShowExplainModal(false)} className="flex-1 bg-gray-800 text-gray-400 py-2 rounded-lg">Cancel</button></div></motion.div></div>)}</AnimatePresence>
            {/* --- PROJECT COMPLETED: MERGED RATING UI --- */}
            {team.status === 'completed' && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-br from-yellow-900/20 via-gray-900 to-purple-900/20 border border-yellow-500/30 p-8 rounded-3xl text-center shadow-2xl space-y-6">
                    <div className="inline-block p-4 bg-yellow-500/20 rounded-full shadow-[0_0_20px_rgba(234,179,8,0.2)]"><Trophy className="w-12 h-12 text-yellow-400" /></div>
                    <h2 className="text-3xl font-extrabold">Project Officially Completed!</h2>
                    <p className="text-gray-400 max-w-xl mx-auto">To finalize the process, please rate your collaborators.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                        {team.members.filter(m => m.id !== currentUserId).map(m => (
                            <div key={m.id} className="bg-gray-950/50 border border-gray-800 p-6 rounded-2xl flex flex-col gap-4">
                                <div className="flex items-center gap-3">
                                    <img src={m.avatar_url || "https://github.com/shadcn.png"} className="w-12 h-12 rounded-full border-2 border-gray-800" />
                                    <div><span className="font-bold text-lg block">{m.username}</span><span className="text-xs text-gray-500">Collaborator</span></div>
                                    {ratedMembers.includes(m.id) && <span className="ml-auto text-green-400 text-xs font-bold flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Rated</span>}
                                </div>
                                {!ratedMembers.includes(m.id) && (
                                    <div className="space-y-4">
                                        <textarea className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 text-sm focus:border-yellow-500/50 outline-none resize-none h-20" placeholder={`Feedback for ${m.username}...`} value={ratingExplanation} onChange={e => setRatingExplanation(e.target.value)} />
                                        <div className="flex flex-col gap-2">
                                            <span className="text-[10px] uppercase text-gray-500 font-bold">Select Trust Rating (1-10)</span>
                                            <div className="flex flex-wrap gap-1">
                                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(s => (
                                                    <button key={s} onClick={() => handleRateMember(m.id, s)} disabled={ratingProcessing === m.id} className={`flex-1 min-w-[30px] h-8 rounded-lg flex items-center justify-center text-xs font-black transition-all transform hover:scale-110 ${s >= 8 ? 'bg-green-900/30 text-green-400 hover:bg-green-500 hover:text-white' : s >= 5 ? 'bg-yellow-900/30 text-yellow-400 hover:bg-yellow-500 hover:text-white' : 'bg-red-900/30 text-red-400 hover:bg-red-500 hover:text-white'}`}>{s}</button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}
            <AnimatePresence>{showExtensionModal && (<div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"><motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-gray-900 border border-gray-800 p-6 rounded-2xl w-full max-w-sm"><h2 className="text-xl font-bold mb-4">Extend Deadline</h2><p className="text-sm text-gray-400 mb-4">Requesting an extension will require a team vote.</p><input type="datetime-local" className="w-full bg-gray-950 border border-gray-700 rounded p-2 text-sm text-gray-400 mb-4" style={{ colorScheme: 'dark' }} value={extensionDate} onChange={e => setExtensionDate(e.target.value)} /><div className="flex gap-2"><button onClick={confirmExtensionRequest} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg font-bold">Request</button><button onClick={() => setShowExtensionModal(false)} className="flex-1 bg-gray-800 text-gray-400 py-2 rounded-lg">Cancel</button></div></motion.div></div>)}</AnimatePresence>
        </div>
    );
}