"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import GlobalHeader from "@/components/GlobalHeader";
import { 
    ArrowLeft, Code2, GraduationCap, Link as LinkIcon, 
    Star, ShieldCheck, Github, Linkedin, Code, Mail, Loader2,
    MessageSquare, Send, X, Copy, Check, MapPin, Calendar 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// --- Sub-Component: Radial Progress for Trust Score ---
const TrustScoreRing = ({ score }: { score: number }) => {
    const radius = 30;
    const circumference = 2 * Math.PI * radius;
    const fillPercent = (Math.min(score, 10) / 10) * circumference;
    
    // Color logic
    const color = score >= 8 ? "text-green-500" : score >= 5 ? "text-yellow-500" : "text-red-500";

    return (
        <div className="relative flex items-center justify-center w-24 h-24">
            <svg className="transform -rotate-90 w-full h-full">
                <circle cx="50%" cy="50%" r={radius} stroke="currentColor" strokeWidth="6" fill="transparent" className="text-zinc-800" />
                <circle 
                    cx="50%" cy="50%" r={radius} stroke="currentColor" strokeWidth="6" fill="transparent" 
                    strokeDasharray={circumference} strokeDashoffset={circumference - fillPercent} 
                    strokeLinecap="round"
                    className={`${color} transition-all duration-1000 ease-out`}
                />
            </svg>
            <div className="absolute flex flex-col items-center">
                <span className={`text-xl font-bold ${color}`}>{score.toFixed(1)}</span>
                <span className="text-[9px] uppercase text-zinc-500 font-bold">Trust</span>
            </div>
        </div>
    );
};

// --- Sub-Component: Skeleton Loader ---
const ProfileSkeleton = () => (
    <div className="max-w-6xl mx-auto p-8 animate-pulse space-y-8">
        <div className="h-64 bg-zinc-900 rounded-3xl relative overflow-hidden border border-zinc-800">
            <div className="h-32 bg-zinc-800/50 w-full"></div>
            <div className="absolute top-20 left-8 flex items-end gap-6">
                <div className="w-32 h-32 rounded-full bg-zinc-800 border-4 border-black"></div>
                <div className="mb-4 space-y-2">
                    <div className="h-8 w-48 bg-zinc-800 rounded"></div>
                    <div className="h-4 w-32 bg-zinc-800 rounded"></div>
                </div>
            </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="h-64 bg-zinc-900 rounded-2xl"></div>
            <div className="col-span-2 h-64 bg-zinc-900 rounded-2xl"></div>
        </div>
    </div>
);

export default function PublicProfile() {
    const params = useParams();
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("overview"); // 'overview', 'stats', 'reviews'
    const [copied, setCopied] = useState(false);

    // Email Modal State
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [emailSubject, setEmailSubject] = useState("");
    const [emailBody, setEmailBody] = useState("");
    const [sendingEmail, setSendingEmail] = useState(false);

    useEffect(() => {
        api.get(`/users/${params.id}`)
            .then(res => setUser(res.data))
            .catch(() => {}) // Handle silently, conditional render will catch null user
            .finally(() => setLoading(false));
    }, [params.id]);

    const isVisible = (key: string) => {
        if (!user || !user.visibility_settings) return true; 
        return user.visibility_settings[key];
    };

    const handleCopyLink = () => {
        navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
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
            setShowEmailModal(false);
            setEmailSubject("");
            setEmailBody("");
            alert("Message sent securely.");
        } catch (e) {
            alert("Failed to send email.");
        } finally {
            setSendingEmail(false);
        }
    };

    if (loading) return <div className="min-h-screen bg-black text-white"><GlobalHeader /><ProfileSkeleton /></div>;
    
    if (!user) return (
        <div className="min-h-screen bg-black text-white flex flex-col">
            <GlobalHeader />
            <div className="flex-1 flex flex-col items-center justify-center">
                <ShieldCheck className="w-16 h-16 text-zinc-700 mb-4" />
                <h1 className="text-2xl font-bold">Profile Not Found</h1>
                <p className="text-zinc-500 mt-2">This user may have disabled their public profile.</p>
                <button onClick={() => router.back()} className="mt-6 px-6 py-2 bg-zinc-800 rounded-full hover:bg-zinc-700 transition">Go Back</button>
            </div>
        </div>
    );

    const githubDetails = user.trust_score_breakdown?.details?.filter((d: string) => d.includes("GitHub")) || [];

    return (
       <div className="min-h-screen w-full bg-transparent text-zinc-100 font-sans selection:bg-purple-500/30 relative overflow-hidden">
            {/* Background Ambient Glow */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-900/20 blur-[100px] rounded-full" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-900/20 blur-[100px] rounded-full" />
            </div>

            <div className="relative z-10 max-w-6xl mx-auto p-4 md:p-8">
                
                {/* --- HEADER SECTION --- */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-[2rem] overflow-hidden mb-8"
                >
                    {/* Banner */}
                    <div className="h-40 bg-gradient-to-r from-zinc-800 to-zinc-900 relative">
                        <button onClick={() => router.back()} className="absolute top-6 left-6 flex items-center gap-2 text-white/70 hover:text-white bg-black/20 backdrop-blur px-4 py-2 rounded-full transition hover:bg-black/40">
                            <ArrowLeft className="w-4 h-4"/> Back
                        </button>
                    </div>

                    <div className="px-8 pb-8 relative">
                        {/* Avatar & Trust Score Row */}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-end -mt-16 mb-6 gap-6">
                            <div className="flex flex-col md:flex-row items-end gap-6">
                                <div className="relative group">
                                    <div className="absolute -inset-0.5 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full opacity-75 blur group-hover:opacity-100 transition duration-1000"></div>
                                    <img src={user.avatar_url || "https://github.com/shadcn.png"} className="relative w-32 h-32 rounded-full border-4 border-black object-cover bg-zinc-800" />
                                </div>
                                <div className="mb-2">
                                    <h1 className="text-4xl font-black text-white tracking-tight">{user.username}</h1>
                                    <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-400 mt-2">
                                        {user.school && <span className="flex items-center gap-1.5"><GraduationCap className="w-4 h-4 text-purple-400"/> {user.school}</span>}
                                        {user.location && <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-blue-400"/> {user.location || "Remote"}</span>}
                                    </div>
                                </div>
                            </div>

                            {/* Trust Score & Actions */}
                            <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                                <div className="flex gap-2">
                                    <button onClick={handleCopyLink} className="p-3 bg-zinc-800 rounded-xl hover:bg-zinc-700 hover:text-white text-zinc-400 transition border border-white/5" title="Copy Profile Link">
                                        {copied ? <Check className="w-5 h-5 text-green-400" /> : <LinkIcon className="w-5 h-5" />}
                                    </button>
                                    <button onClick={() => router.push(`/chat?targetId=${user.id || user._id}`)} className="bg-white text-black px-6 py-3 rounded-xl font-bold hover:bg-zinc-200 transition flex items-center gap-2">
                                        <MessageSquare className="w-4 h-4" /> Chat
                                    </button>
                                    <button onClick={() => setShowEmailModal(true)} className="bg-purple-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-purple-500 transition shadow-lg shadow-purple-900/20">
                                        <Mail className="w-4 h-4" />
                                    </button>
                                </div>
                                <TrustScoreRing score={user.trust_score || 0} />
                            </div>
                        </div>

                        {/* About & Bio */}
                        <div className="max-w-3xl">
                            <p className="text-zinc-300 leading-relaxed text-lg">{user.about || "No bio provided."}</p>
                            {isVisible('email') && user.email && (
                                <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-zinc-800/50 rounded-lg text-sm text-zinc-400 border border-zinc-700/50">
                                    <Mail className="w-3.5 h-3.5" /> {user.email}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="flex border-t border-white/5 px-8">
                        {['overview', 'stats', 'reviews'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-6 py-4 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors ${
                                    activeTab === tab ? "border-purple-500 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"
                                }`}
                            >
                                {tab === 'stats' ? "Stats " : tab}
                            </button>
                        ))}
                    </div>
                </motion.div>

                {/* --- CONTENT AREA --- */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* LEFT SIDEBAR (Always Visible) */}
                    <div className="space-y-6">
                        {/* Skills */}
                        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 p-6 rounded-3xl">
                            <h3 className="font-bold mb-4 flex items-center gap-2 text-zinc-100"><Code2 className="w-5 h-5 text-purple-400"/> Top Skills</h3>
                            <div className="flex flex-wrap gap-2">
                                {user.skills?.map((s:any) => (
                                    <span key={s.name} className="bg-zinc-800 text-zinc-300 border border-zinc-700 px-3 py-1.5 rounded-lg text-xs font-medium">
                                        {s.name}
                                    </span>
                                )) || <span className="text-zinc-500 text-sm">No skills listed.</span>}
                            </div>
                        </motion.div>

                        {/* Verified Platforms */}
                        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 p-6 rounded-3xl">
                            <h3 className="font-bold mb-4 flex items-center gap-2 text-zinc-100"><ShieldCheck className="w-5 h-5 text-green-400"/> Verifications</h3>
                            <div className="space-y-3">
                                {user.connected_accounts?.github && (
                                    <div className="flex items-center justify-between p-3 bg-zinc-800/30 rounded-xl border border-white/5">
                                        <div className="flex items-center gap-3"><Github className="w-5 h-5 text-white" /> <span className="text-sm">GitHub</span></div>
                                        <Check className="w-4 h-4 text-green-500" />
                                    </div>
                                )}
                                {user.connected_accounts?.linkedin && isVisible('linkedin') && (
                                    <div className="flex items-center justify-between p-3 bg-zinc-800/30 rounded-xl border border-white/5">
                                        <div className="flex items-center gap-3"><Linkedin className="w-5 h-5 text-blue-400" /> <span className="text-sm">LinkedIn</span></div>
                                        <Check className="w-4 h-4 text-green-500" />
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>

                    {/* MAIN TAB CONTENT */}
                    <div className="lg:col-span-2">
                        <AnimatePresence mode="wait">
                            
                            {/* OVERVIEW TAB */}
                            {activeTab === 'overview' && (
                                <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                                    {/* Education Highlight */}
                                    {isVisible('education') && user.education?.length > 0 && (
                                        <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 p-8 rounded-3xl">
                                            <h3 className="font-bold mb-6 flex items-center gap-2 text-xl"><GraduationCap className="w-6 h-6 text-blue-400"/> Latest Education</h3>
                                            <div className="relative border-l border-zinc-700 ml-3 space-y-8 pl-8 py-2">
                                                {user.education.filter((e:any) => e.is_visible).slice(0, 2).map((edu:any, i:number) => (
                                                    <div key={i} className="relative">
                                                        <div className="absolute -left-[39px] top-1 w-5 h-5 bg-black border-4 border-blue-500 rounded-full"></div>
                                                        <h4 className="text-lg font-bold text-white">{edu.institute}</h4>
                                                        <p className="text-zinc-400">{edu.course}</p>
                                                        <span className="inline-block mt-2 text-xs font-bold px-2 py-1 bg-blue-500/10 text-blue-400 rounded">
                                                            {edu.is_completed ? "Graduated" : `${edu.year_of_study} Year`}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            )}

                            {/* STATS TAB */}
                            {activeTab === 'stats' && (
                                <motion.div key="stats" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Codeforces */}
                                    {isVisible('codeforces') && user.platform_stats?.codeforces && (
                                        <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-yellow-500/20 p-6 rounded-3xl relative overflow-hidden group">
                                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition"><Code className="w-24 h-24" /></div>
                                            <h3 className="text-yellow-400 font-bold mb-4 flex items-center gap-2"><Code className="w-5 h-5"/> Codeforces</h3>
                                            <div className="space-y-4 relative z-10">
                                                <div>
                                                    <div className="text-3xl font-black text-white">{user.platform_stats.codeforces.rating}</div>
                                                    <div className="text-xs text-zinc-500 uppercase font-bold">Current Rating</div>
                                                </div>
                                                <div>
                                                    <div className="text-lg font-bold text-zinc-300">{user.platform_stats.codeforces.rank}</div>
                                                    <div className="text-xs text-zinc-500 uppercase font-bold">Max Rank</div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* LeetCode */}
                                    {isVisible('leetcode') && user.platform_stats?.leetcode && (
                                        <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-orange-500/20 p-6 rounded-3xl relative overflow-hidden group">
                                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition"><Code2 className="w-24 h-24" /></div>
                                            <h3 className="text-orange-400 font-bold mb-4 flex items-center gap-2"><Code2 className="w-5 h-5"/> LeetCode</h3>
                                            <div className="space-y-4 relative z-10">
                                                <div>
                                                    <div className="text-3xl font-black text-white">{user.platform_stats.leetcode.total_solved}</div>
                                                    <div className="text-xs text-zinc-500 uppercase font-bold">Problems Solved</div>
                                                </div>
                                                <div className="grid grid-cols-3 gap-2 text-center bg-black/20 p-2 rounded-lg">
                                                    <div><div className="text-green-400 font-bold">{user.platform_stats.leetcode.easy_solved}</div><div className="text-[9px] text-zinc-500">Easy</div></div>
                                                    <div><div className="text-yellow-400 font-bold">{user.platform_stats.leetcode.medium_solved}</div><div className="text-[9px] text-zinc-500">Med</div></div>
                                                    <div><div className="text-red-400 font-bold">{user.platform_stats.leetcode.hard_solved}</div><div className="text-[9px] text-zinc-500">Hard</div></div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Github Detailed */}
                                    {githubDetails.length > 0 && (
                                        <div className="md:col-span-2 bg-zinc-900/50 border border-white/10 p-6 rounded-3xl">
                                            <h3 className="font-bold mb-4 flex items-center gap-2"><Github className="w-5 h-5"/> GitHub Analytics</h3>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                {githubDetails.map((d: string, i: number) => (
                                                    <div key={i} className="bg-zinc-800/50 p-4 rounded-xl text-center">
                                                        <div className="text-sm text-zinc-400">{d.replace("GitHub: ", "")}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            )}

                            {/* REVIEWS TAB */}
                            {activeTab === 'reviews' && (
                                <motion.div key="reviews" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
                                    {isVisible('ratings') && user.ratings_received?.length > 0 ? (
                                        user.ratings_received.map((r:any, i:number) => (
                                            <div key={i} className="bg-zinc-900/50 border border-white/5 p-6 rounded-2xl hover:border-white/10 transition">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div>
                                                        <h4 className="font-bold text-white text-lg">{r.project_name}</h4>
                                                        <span className="text-xs text-zinc-500">Peer Review</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 bg-yellow-500/10 px-3 py-1 rounded-full border border-yellow-500/20">
                                                        <Star className="w-4 h-4 text-yellow-500 fill-current" />
                                                        <span className="font-bold text-yellow-500">{r.score}</span>
                                                    </div>
                                                </div>
                                                <p className="text-zinc-300 italic mb-4">"{r.explanation}"</p>
                                                <div className="flex items-center gap-2 text-xs text-green-400 font-mono">
                                                    <ShieldCheck className="w-3 h-3" /> Verified Collaborator
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-12 bg-zinc-900/30 rounded-3xl border border-dashed border-zinc-800">
                                            <Star className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                                            <p className="text-zinc-500">No reviews received yet.</p>
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* EMAIL COMPOSITION MODAL */}
            <AnimatePresence>
                {showEmailModal && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-md">
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-zinc-900 border border-zinc-700 p-8 rounded-3xl w-full max-w-lg shadow-2xl relative"
                        >
                            <button onClick={() => setShowEmailModal(false)} className="absolute top-6 right-6 text-zinc-500 hover:text-white transition"><X className="w-6 h-6" /></button>
                            <h2 className="text-2xl font-bold mb-2 flex items-center gap-3 text-white"><Mail className="w-6 h-6 text-purple-500" /> Send Message</h2>
                            <p className="text-sm text-zinc-400 mb-8">Securely contact <span className="text-white font-bold">{user.username}</span>. Your email address remains hidden.</p>

                            <div className="space-y-5">
                                <input 
                                    className="w-full bg-black/50 border border-zinc-700 rounded-xl p-4 text-white outline-none focus:border-purple-500 transition placeholder:text-zinc-600"
                                    placeholder="Subject"
                                    value={emailSubject}
                                    onChange={(e) => setEmailSubject(e.target.value)}
                                />
                                <textarea 
                                    className="w-full bg-black/50 border border-zinc-700 rounded-xl p-4 text-white h-40 outline-none focus:border-purple-500 transition resize-none placeholder:text-zinc-600"
                                    placeholder="Write your message here..."
                                    value={emailBody}
                                    onChange={(e) => setEmailBody(e.target.value)}
                                />
                                <button onClick={handleSendEmail} disabled={sendingEmail} className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-zinc-200 transition disabled:opacity-50 flex items-center justify-center gap-2">
                                    {sendingEmail ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                    {sendingEmail ? "Sending..." : "Send Message"}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}