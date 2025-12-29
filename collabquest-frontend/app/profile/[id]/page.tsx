"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import GlobalHeader from "@/components/GlobalHeader";
import { 
    ArrowLeft, Code2, Heart, User as UserIcon, GraduationCap, 
    Link as LinkIcon, Award, Star, Loader2, ShieldCheck, 
    Github, Linkedin, Code, Mail, MessageSquare, Send, X,
    Sparkles, Ban
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function PublicProfile() {
    const params = useParams();
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [compatibility, setCompatibility] = useState<number | null>(null);

    // Email Modal State
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [emailSubject, setEmailSubject] = useState("");
    const [emailBody, setEmailBody] = useState("");
    const [sendingEmail, setSendingEmail] = useState(false);

    useEffect(() => {
        if (params.id) {
            // 1. Fetch User Profile
            api.get(`/users/${params.id}`)
                .then(res => setUser(res.data))
                .catch((err) => {
                    if (err.response?.status === 403) {
                        alert("Profile Unavailable.");
                        router.push("/dashboard");
                    } else {
                        console.error("Profile load error", err);
                    }
                })
                .finally(() => setLoading(false));

            // 2. Fetch AI Compatibility Score
            api.get(`/users/${params.id}/compatibility`)
                .then(res => setCompatibility(res.data.score))
                .catch(err => console.error("Failed to fetch compatibility", err));
        }
    }, [params.id]);

    const isVisible = (key: string) => {
        if (!user || !user.visibility_settings) return true; 
        return user.visibility_settings[key];
    };

    const handleStartChat = () => {
        router.push(`/chat?targetId=${user.id || user._id}`);
    };

    const handleSendEmail = async () => {
        if (!emailSubject.trim() || !emailBody.trim()) return alert("Please fill in all fields.");
        setSendingEmail(true);
        try {
            await api.post("/communication/send-email", {
                recipient_id: user.id || user._id,
                subject: emailSubject,
                body: emailBody
            });
            alert("Email sent successfully!");
            setShowEmailModal(false);
            setEmailSubject("");
            setEmailBody("");
        } catch (e) {
            alert("Failed to send email. You may be blocked or the user is invalid.");
        } finally {
            setSendingEmail(false);
        }
    };

    const handleBlockUser = async () => {
        if (!confirm(`Are you sure you want to BLOCK ${user.username}?\n\nThey will be removed from your connections, matches, and chats. You won't see them anymore.`)) return;
        
        try {
            await api.post(`/users/${user.id || user._id}/block`);
            alert("User blocked.");
            router.push("/dashboard");
        } catch (e) {
            alert("Failed to block user.");
        }
    };

    if (loading) return <div className="h-screen bg-black text-white flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
    if (!user) return null;

    // Filter GitHub details for cleaner display
    const githubDetails = user.trust_score_breakdown?.details?.filter((d: string) => d.includes("GitHub")) || [];

    return (
        <div className="min-h-screen bg-gray-950 text-white relative">
            <GlobalHeader />
            <div className="max-w-5xl mx-auto p-8">
                <div className="flex justify-between items-center mb-6">
                    <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-400 hover:text-white transition">
                        <ArrowLeft className="w-4 h-4"/> Back
                    </button>
                    {/* BLOCK BUTTON */}
                    <button onClick={handleBlockUser} className="text-xs text-red-500 hover:text-red-400 font-bold border border-red-900/50 hover:bg-red-900/20 px-3 py-1.5 rounded-lg flex items-center gap-2 transition">
                        <Ban className="w-3 h-3" /> Block User
                    </button>
                </div>

                <div className="bg-gray-900 border border-gray-800 rounded-3xl p-8 mb-8">
                    <div className="flex flex-col md:flex-row items-center gap-8">
                        <img src={user.avatar_url || "https://github.com/shadcn.png"} className="w-32 h-32 rounded-full border-4 border-gray-800" />
                        <div className="text-center md:text-left flex-1">
                            <h1 className="text-4xl font-bold">{user.username}</h1>
                            
                            {/* FULL NAME */}
                            {isVisible('full_name') && user.full_name && (
                                <h2 className="text-lg text-gray-400 font-medium mt-1">{user.full_name}</h2>
                            )}
                            
                            {/* EMAIL */}
                            {isVisible('email') && user.email && (
                                <a href={`mailto:${user.email}`} className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition mt-2 text-sm bg-white/5 px-3 py-1 rounded-full border border-white/5 hover:border-white/20">
                                    <Mail className="w-3.5 h-3.5" />
                                    {user.email}
                                </a>
                            )}
                            
                            <p className="text-gray-400 mt-2 max-w-xl">{user.about}</p>
                            <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-4 text-sm">
                                {user.age && <span className="bg-gray-800 px-3 py-1 rounded-full text-gray-300">Age: {user.age}</span>}
                                {user.school && <span className="flex items-center gap-2 bg-gray-800 px-3 py-1 rounded-full text-gray-300"><GraduationCap className="w-4 h-4"/> {user.school}</span>}
                            </div>

                            {/* ACTION BUTTONS */}
                            <div className="flex justify-center md:justify-start gap-3 mt-6">
                                <button 
                                    onClick={handleStartChat}
                                    className="bg-purple-600 hover:bg-purple-500 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition shadow-lg shadow-purple-500/20"
                                >
                                    <MessageSquare className="w-4 h-4" /> Send Message
                                </button>
                                <button 
                                    onClick={() => setShowEmailModal(true)}
                                    className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition border border-gray-700"
                                >
                                    <Mail className="w-4 h-4" /> Send Email
                                </button>
                            </div>
                        </div>

                        {/* --- SCORES BADGES --- */}
                        <div className="flex gap-4">
                            {/* TRUST SCORE BADGE */}
                            <div className="bg-black/50 border border-green-500/30 p-4 rounded-2xl text-center min-w-[120px]">
                                <ShieldCheck className="w-8 h-8 text-green-500 mx-auto mb-2" />
                                <div className="text-3xl font-black text-white">{Math.min(10.0, user.trust_score).toFixed(1)}</div>
                                <div className="text-[10px] text-gray-500 uppercase tracking-widest">/ 10 Trust</div>
                            </div>

                            {/* AI MATCH BADGE */}
                            {compatibility !== null && (
                                <div className="bg-black/50 border border-purple-500/30 p-4 rounded-2xl text-center min-w-[120px]">
                                    <Sparkles className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                                    <div className="text-3xl font-black text-white">{compatibility}%</div>
                                    <div className="text-[10px] text-gray-500 uppercase tracking-widest">AI Match</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    
                    {/* LEFT COLUMN: Verification & Stats */}
                    <div className="space-y-6">
                        {/* TRUST BREAKDOWN */}
                        <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
                            <h3 className="font-bold mb-4 flex items-center gap-2 text-green-400"><ShieldCheck className="w-4 h-4"/> Verified Stats</h3>
                            <div className="space-y-4">
                                {/* Github Stats */}
                                {githubDetails.length > 0 && (
                                    <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                                        <div className="flex items-center gap-2 mb-2 text-sm font-bold text-gray-300">
                                            <Github className="w-4 h-4" /> GitHub
                                        </div>
                                        <div className="space-y-1 pl-6">
                                            {githubDetails.map((d: string, i: number) => (
                                                <p key={i} className="text-[10px] text-gray-500">{d.replace("GitHub: ", "")}</p>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {/* Other Platforms */}
                                {user.connected_accounts?.linkedin && isVisible('linkedin') && (
                                    <div className="flex items-center gap-2 text-sm text-gray-400">
                                        <Linkedin className="w-4 h-4 text-blue-400" /> LinkedIn Verified
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Codeforces Stats */}
                        {isVisible('codeforces') && user.platform_stats?.codeforces && (
                            <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
                                <h3 className="font-bold mb-4 flex items-center gap-2 text-yellow-400"><Code className="w-4 h-4"/> Codeforces</h3>
                                <div className="flex justify-between">
                                    <div className="text-center">
                                        <div className="text-xl font-bold text-white">{user.platform_stats.codeforces.rating}</div>
                                        <div className="text-[10px] text-gray-500 uppercase">Rating</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-sm font-bold text-gray-300 mt-1">{user.platform_stats.codeforces.rank}</div>
                                        <div className="text-[10px] text-gray-500 uppercase">Rank</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* LeetCode Stats */}
                        {isVisible('leetcode') && user.platform_stats?.leetcode && (
                            <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
                                    <h3 className="font-bold mb-4 flex items-center gap-2 text-orange-400"><Code2 className="w-4 h-4"/> LeetCode</h3>
                                    <div className="text-center bg-gray-800/50 p-3 rounded-xl border border-gray-700">
                                    <div className="text-2xl font-black text-white">{user.platform_stats.leetcode.total_solved}</div>
                                    <div className="text-[10px] text-gray-500 uppercase tracking-widest">Problems Solved</div>
                                    </div>
                            </div>
                        )}
                    </div>

                    {/* CENTER & RIGHT: Main Content */}
                    <div className="md:col-span-2 space-y-6">
                        
                        {/* Skills */}
                        <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
                            <h3 className="font-bold mb-4 flex items-center gap-2 text-blue-400"><Code2 className="w-4 h-4"/> Skills</h3>
                            <div className="flex flex-wrap gap-2">
                                {user.skills.map((s:any) => (
                                    <span key={s.name} className="bg-blue-900/20 text-blue-300 border border-blue-500/20 px-3 py-1 rounded-full text-xs">
                                        {s.name} ({s.level})
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Education */}
                        {isVisible('education') && user.education && user.education.length > 0 && (
                             <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
                                <h3 className="font-bold mb-4 flex items-center gap-2 text-purple-400"><GraduationCap className="w-4 h-4"/> Education</h3>
                                <div className="space-y-4">
                                    {user.education.filter((e:any) => e.is_visible).map((edu:any, i:number) => (
                                        <div key={i} className="border-l-2 border-purple-500 pl-4 py-1">
                                            <div className="font-bold text-white">{edu.institute}</div>
                                            <div className="text-sm text-gray-400">{edu.course}</div>
                                            <div className="text-xs text-gray-500 mt-1">{edu.is_completed ? "Completed" : `${edu.year_of_study} Year`}</div>
                                        </div>
                                    ))}
                                </div>
                             </div>
                        )}

                        {/* Ratings */}
                        {isVisible('ratings') && user.ratings_received?.length > 0 && (
                            <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
                                <h3 className="font-bold mb-4 flex items-center gap-2 text-yellow-400"><Star className="w-4 h-4"/> Peer Ratings</h3>
                                <div className="grid grid-cols-1 gap-4">
                                    {user.ratings_received.slice(0, 5).map((r:any, i:number) => (
                                        <div key={i} className="bg-black/40 border border-gray-800 p-4 rounded-xl">
                                            <div className="flex justify-between mb-2">
                                                <span className="font-bold text-white text-sm">{r.project_name}</span>
                                                <span className="text-yellow-500 font-bold text-sm">{r.score}/10</span>
                                            </div>
                                            <p className="text-gray-500 italic text-xs">"{r.explanation}"</p>
                                            <div className="text-[10px] text-gray-600 mt-2 text-right">- Verified Teammate</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* EMAIL COMPOSITION MODAL */}
            <AnimatePresence>
                {showEmailModal && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }} 
                            animate={{ scale: 1, opacity: 1 }} 
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-gray-900 border border-gray-800 p-6 rounded-2xl w-full max-w-lg shadow-2xl relative"
                        >
                            <button 
                                onClick={() => setShowEmailModal(false)} 
                                className="absolute top-4 right-4 text-gray-500 hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>
                            
                            <h2 className="text-xl font-bold mb-1 flex items-center gap-2">
                                <Mail className="w-5 h-5 text-gray-400" /> Send Email
                            </h2>
                            <p className="text-xs text-gray-500 mb-6">
                                Your email address will remain hidden. The recipient can reply via your profile.
                            </p>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Subject</label>
                                    <input 
                                        className="w-full bg-black border border-gray-800 rounded-lg p-3 text-sm outline-none focus:border-purple-500 transition"
                                        placeholder="Regarding your project..."
                                        value={emailSubject}
                                        onChange={(e) => setEmailSubject(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Message</label>
                                    <textarea 
                                        className="w-full bg-black border border-gray-800 rounded-lg p-3 text-sm h-40 outline-none focus:border-purple-500 transition resize-none"
                                        placeholder="Hi, I'd like to collaborate..."
                                        value={emailBody}
                                        onChange={(e) => setEmailBody(e.target.value)}
                                    />
                                </div>
                                
                                <button 
                                    onClick={handleSendEmail} 
                                    disabled={sendingEmail}
                                    className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-gray-200 transition disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    {sendingEmail ? "Sending..." : "Send Securely"}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}