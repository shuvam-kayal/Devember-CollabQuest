"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import api from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import GlobalHeader from "@/components/GlobalHeader";
import { 
    Save, ArrowLeft, Clock, Calendar, Code2, Star, User, Plus, X, 
    Trash2, Zap, CheckCircle, AlertTriangle, Briefcase, Eye, EyeOff, 
    GraduationCap, Award, Linkedin, Github, Globe, Twitter, Instagram, Mail, ShieldCheck, Loader2
} from "lucide-react";
import Link from "next/link";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const PRESET_SKILLS = ["React", "Python", "Node.js", "TypeScript", "Next.js", "Tailwind", "MongoDB", "Firebase"];
const AGES = Array.from({ length: 50 }, (_, i) => (i + 16).toString());

interface TimeRange { start: string; end: string; }
interface DayAvailability { day: string; enabled: boolean; slots: TimeRange[]; }
interface SocialLink { platform: string; url: string; }
interface Achievement { title: string; date?: string; description?: string; }
interface Education { institute: string; course: string; year_of_study: string; is_completed: boolean; is_visible: boolean; }

export default function ProfilePage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);

    // Profile State
    const [email, setEmail] = useState("");
    const [about, setAbout] = useState("");
    const [skills, setSkills] = useState<{ name: string, level: string }[]>([]);
    const [interests, setInterests] = useState<string[]>([]);
    const [availability, setAvailability] = useState<DayAvailability[]>(
        DAYS.map(d => ({ day: d, enabled: false, slots: [{ start: "09:00", end: "17:00" }] }))
    );

    const [age, setAge] = useState("");
    const [educationList, setEducationList] = useState<Education[]>([]);
    const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
    const [profLinks, setProfLinks] = useState<SocialLink[]>([]);
    const [achievements, setAchievements] = useState<Achievement[]>([]);
    const [connectedAccounts, setConnectedAccounts] = useState<any>({});
    const [ratings, setRatings] = useState<any[]>([]);
    const [isLookingForTeam, setIsLookingForTeam] = useState(true);

    // New Features State
    const [platformStats, setPlatformStats] = useState<any>({});
    const [trustBreakdown, setTrustBreakdown] = useState<any>(null);
    const [visibility, setVisibility] = useState<any>({
        linkedin: true, codeforces: true, leetcode: true, 
        education: true, achievements: true, ratings: true,
        email: false 
    });

    // Inputs
    const [newLinkUrl, setNewLinkUrl] = useState("");
    const [newLinkPlatform, setNewLinkPlatform] = useState("");
    const [achTitle, setAchTitle] = useState("");
    const [achDesc, setAchDesc] = useState("");
    const [dropdownValue, setDropdownValue] = useState("");

    // Quiz State
    const [showQuiz, setShowQuiz] = useState(false);
    const [quizSkill, setQuizSkill] = useState("");
    const [questions, setQuestions] = useState<any[]>([]);
    const [currentQ, setCurrentQ] = useState(0);
    const [userAnswers, setUserAnswers] = useState<{ id: string, selected: number }[]>([]);
    const [timer, setTimer] = useState(30);
    const [quizResult, setQuizResult] = useState<any>(null);

    useEffect(() => {
        const token = Cookies.get("token");
        if (!token) return router.push("/");
        api.get("/users/me").then(res => {
            const u = res.data;
            setEmail(u.email || "");
            setAbout(u.about || "");
            setSkills(u.skills || []);
            setInterests(u.interests || []);
            setIsLookingForTeam(u.is_looking_for_team ?? true);
            if (u.availability?.length > 0) setAvailability(u.availability);
            setAge(u.age || "");
            
            // New Fields
            setEducationList(u.education || []);
            if (u.visibility_settings) setVisibility(u.visibility_settings);
            if (u.platform_stats) setPlatformStats(u.platform_stats);
            if (u.trust_score_breakdown) setTrustBreakdown(u.trust_score_breakdown);

            setSocialLinks(u.social_links || []);
            setProfLinks(u.professional_links || []);
            setAchievements(u.achievements || []);
            setConnectedAccounts(u.connected_accounts || {});
            setRatings(u.ratings_received || []);
        }).finally(() => setLoading(false));
    }, []);

    const saveProfile = async () => {
        try {
            await api.put("/users/profile", {
                about, interests, availability,
                skills: skills.map(s => s.name),
                is_looking_for_team: isLookingForTeam,
                age, 
                education: educationList,
                social_links: socialLinks,
                professional_links: profLinks, achievements
            });
            alert("Profile Saved!");
            window.location.reload(); 
        } catch (err) { alert("Save failed"); }
    };

    const toggleVisibility = async (key: string) => {
        const newSettings = { ...visibility, [key]: !visibility[key] };
        setVisibility(newSettings);
        try { await api.put("/users/visibility", { settings: newSettings }); } 
        catch(e) { console.error(e); }
    };

    const connectPlatform = async (platform: string) => {
        const url = prompt(`Enter your ${platform} Profile URL/Handle:`);
        if (!url) return;
        try {
            const res = await api.post(`/users/connect/${platform}`, { handle_or_url: url });
            setConnectedAccounts((prev: any) => ({ ...prev, [platform]: url }));
            if (res.data.stats) setPlatformStats((prev: any) => ({ ...prev, [platform]: res.data.stats }));
            if (res.data.breakdown) setTrustBreakdown(res.data.breakdown);
            alert(`Connected ${platform} successfully!`);
        } catch (e) { alert("Failed to verify account. Please check the handle/url."); }
    };

    const removeSkill = (name: string) => setSkills(skills.filter(s => s.name !== name));
    const addSocialLink = () => { if (newLinkUrl && newLinkPlatform) { setSocialLinks([...socialLinks, { platform: newLinkPlatform, url: newLinkUrl }]); setNewLinkUrl(""); setNewLinkPlatform(""); } };
    const addAchievement = () => { if (achTitle) { setAchievements([...achievements, { title: achTitle, description: achDesc }]); setAchTitle(""); setAchDesc(""); } };
    const toggleDay = (i: number) => { const n = [...availability]; n[i].enabled = !n[i].enabled; setAvailability(n); };
    const addSlot = (i: number) => { const n = [...availability]; n[i].slots.push({ start: "09:00", end: "12:00" }); setAvailability(n); };
    const removeSlot = (d: number, s: number) => { const n = [...availability]; n[d].slots = n[d].slots.filter((_, idx) => idx !== s); setAvailability(n); };
    const updateSlot = (d: number, s: number, f: 'start' | 'end', v: string) => { const n = [...availability]; n[d].slots[s][f] = v; setAvailability(n); };
    
    // Quiz Functions
    const startSkillTest = async (skill: string) => { if (!confirm(`Start verification for ${skill}?`)) return; setQuizSkill(skill); setLoading(true); try { const res = await api.get(`/skills/start/${skill}`); setQuestions(res.data.questions); setShowQuiz(true); setCurrentQ(0); setUserAnswers([]); setQuizResult(null); setTimer(15); } catch (err) { alert("Error loading test."); } finally { setLoading(false); } };
    const handleAnswer = (optionIndex: number) => { const newAns = [...userAnswers, { id: questions[currentQ].id, selected: optionIndex }]; setUserAnswers(newAns); if (currentQ < questions.length - 1) { setCurrentQ(currentQ + 1); setTimer(15); } else { submitQuiz(newAns); } };
    useEffect(() => { if (!showQuiz || quizResult) return; if (timer > 0) { const t = setTimeout(() => setTimer(timer - 1), 1000); return () => clearTimeout(t); } else { handleAnswer(-1); } }, [timer, showQuiz, quizResult]);
    const submitQuiz = async (answers: any[]) => { try { const res = await api.post(`/skills/submit/${quizSkill}`, answers); setQuizResult(res.data); if (res.data.passed) setSkills([...skills, { name: quizSkill, level: res.data.level }]); } catch (err) { alert("Submission failed"); setShowQuiz(false); } };

    if (loading) return <div className="h-screen bg-black text-white flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

    const totalTrust = trustBreakdown ? (
        (Number(trustBreakdown.base) || 0) + 
        (Number(trustBreakdown.github) || 0) + 
        (Number(trustBreakdown.linkedin) || 0) + 
        (Number(trustBreakdown.codeforces) || 0) + 
        (Number(trustBreakdown.leetcode) || 0)
    ) : 5.0;

    return (
        <div className="min-h-screen w-full bg-transparent text-zinc-100 font-sans selection:bg-purple-500/30 relative overflow-hidden">
                  
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-900/20 blur-[100px] rounded-full" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-900/20 blur-[100px] rounded-full" />
            </div>

            <div className="relative z-10 max-w-[90rem] mx-auto p-4 md:p-8">
                
                {/* --- HEADER --- */}
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard" className="p-3 bg-zinc-800/50 hover:bg-zinc-700 rounded-2xl border border-white/5 transition-all">
                            <ArrowLeft className="w-5 h-5 text-zinc-400 hover:text-white" />
                        </Link>
                        <div>
                            <h1 className="text-3xl font-black tracking-tight text-white">Edit Profile</h1>
                            <p className="text-zinc-500 text-sm">Manage your public presence and trust signals.</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <button onClick={() => setIsLookingForTeam(!isLookingForTeam)} className={`flex-1 md:flex-none px-5 py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-sm transition-all border ${isLookingForTeam ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>
                            {isLookingForTeam ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                            {isLookingForTeam ? "Visible to Recruiters" : "Hidden"}
                        </button>
                        <button onClick={saveProfile} className="flex-1 md:flex-none bg-white text-black hover:bg-zinc-200 px-8 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-white/10 transition-all">
                            <Save className="w-4 h-4" /> Save Changes
                        </button>
                    </div>
                </motion.div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    
                    {/* LEFT SIDEBAR (Col span 3) */}
                    <div className="lg:col-span-3 space-y-6">
                        
                        {/* Basic Info */}
                        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 p-6 rounded-3xl space-y-6">
                            <h3 className="text-lg font-bold flex items-center gap-2 text-zinc-100"><User className="w-5 h-5 text-purple-400"/> Identity</h3>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-2 block">Age</label>
                                    <select className="w-full bg-black/50 border border-zinc-800 rounded-xl p-3 text-sm focus:border-purple-500 transition-all outline-none text-zinc-300" value={age} onChange={e => setAge(e.target.value)}>
                                        <option value="">Select Age</option>
                                        {AGES.map(a => <option key={a} value={a}>{a}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Email</label>
                                        <button onClick={() => toggleVisibility('email')} className={`flex items-center gap-1 text-[10px] uppercase font-bold transition-colors ${visibility.email ? "text-green-400" : "text-zinc-600 hover:text-zinc-400"}`}>
                                            {visibility.email ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                                        </button>
                                    </div>
                                    <div className="w-full bg-black/50 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-400 flex items-center gap-3 cursor-not-allowed">
                                        <Mail className="w-4 h-4 opacity-50" />
                                        <span className="flex-1 font-mono truncate">{email}</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-2 block">Bio</label>
                                    <textarea className="w-full bg-black/50 border border-zinc-800 rounded-xl p-3 h-32 text-sm focus:border-purple-500 transition-all outline-none resize-none text-zinc-300 placeholder:text-zinc-700" value={about} onChange={e => setAbout(e.target.value)} placeholder="Write a short bio..." />
                                </div>
                            </div>
                        </motion.div>

                        {/* Trust Score */}
                        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 p-6 rounded-3xl">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold flex items-center gap-2 text-zinc-100"><ShieldCheck className="w-5 h-5 text-green-400"/> Trust Score</h3>
                                <div className="text-2xl font-black text-white">{Math.min(7.0, totalTrust).toFixed(1)}<span className="text-zinc-600 text-sm font-medium">/7</span></div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center p-2.5 bg-black/40 rounded-xl border border-white/5">
                                    <span className="text-zinc-400 text-xs font-bold">Base</span>
                                    <span className="text-green-400 font-bold text-xs">{trustBreakdown?.base?.toFixed(1) || "5.0"}</span>
                                </div>
                                {trustBreakdown?.details?.map((detail: string, i: number) => {
                                    const [platform, info] = detail.split(":");
                                    return (
                                        <div key={i} className="flex justify-between items-center p-2.5 bg-black/40 rounded-xl border border-white/5">
                                            <span className="text-zinc-400 text-xs font-bold">{platform}</span>
                                            <span className="text-zinc-200 text-[10px] font-mono">{info}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </motion.div>

                        {/* Connections */}
                        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="bg-gradient-to-br from-zinc-900 to-black border border-white/10 p-6 rounded-3xl">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-yellow-500"><Zap className="w-5 h-5"/> Connections</h3>
                            <div className="space-y-3">
                                {[
                                    { id: 'codeforces', icon: Code2, label: 'Codeforces' },
                                    { id: 'leetcode', icon: Code2, label: 'LeetCode' },
                                    { id: 'linkedin', icon: Linkedin, label: 'LinkedIn' }
                                ].map((platform) => (
                                    <div key={platform.id} className="flex items-center justify-between p-2.5 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition">
                                        <div className="flex items-center gap-3 text-sm font-bold text-zinc-300">
                                            <platform.icon className="w-4 h-4 text-zinc-500" /> {platform.label}
                                        </div>
                                        {connectedAccounts[platform.id] ? (
                                            <button onClick={() => toggleVisibility(platform.id)} className="text-zinc-500 hover:text-white transition">
                                                {visibility[platform.id] ? <Eye className="w-4 h-4"/> : <EyeOff className="w-4 h-4"/>}
                                            </button>
                                        ) : (
                                            <button onClick={() => connectPlatform(platform.id)} className="text-[10px] bg-white text-black px-3 py-1.5 rounded-lg font-bold hover:bg-zinc-200">Connect</button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </div>

                    {/* MAIN CONTENT (Col span 9) */}
                    <div className="lg:col-span-9 space-y-8">
                        
                        {/* --- PROFESSIONAL SECTION (Grid) --- */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            
                            {/* Education Section */}
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 p-6 rounded-[2rem] flex flex-col">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-lg font-bold flex items-center gap-2 text-zinc-100"><GraduationCap className="w-5 h-5 text-purple-400"/> Education</h3>
                                    <button onClick={() => setEducationList([...educationList, { institute: "", course: "", year_of_study: "", is_completed: false, is_visible: true }])} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition text-white">
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="space-y-4 flex-1">
                                    {educationList.map((edu, index) => (
                                        <div key={index} className="p-4 bg-black/40 border border-white/5 rounded-2xl relative group hover:border-white/10 transition">
                                            <button onClick={() => setEducationList(educationList.filter((_, i) => i !== index))} className="absolute top-2 right-2 text-zinc-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><X className="w-3 h-3" /></button>
                                            <div className="grid grid-cols-1 gap-2 mb-2">
                                                <input placeholder="Institute Name" value={edu.institute} onChange={(e) => { const n = [...educationList]; n[index].institute = e.target.value; setEducationList(n); }} className="bg-transparent border-b border-zinc-800 py-1 text-sm outline-none focus:border-purple-500 text-white placeholder:text-zinc-700 transition-colors" />
                                                <input placeholder="Course" value={edu.course} onChange={(e) => { const n = [...educationList]; n[index].course = e.target.value; setEducationList(n); }} className="bg-transparent border-b border-zinc-800 py-1 text-sm outline-none focus:border-purple-500 text-white placeholder:text-zinc-700 transition-colors" />
                                            </div>
                                            <div className="flex items-center gap-3 mt-2">
                                                <label className="flex items-center gap-2 cursor-pointer text-[10px] text-zinc-400 hover:text-white transition">
                                                    <input type="checkbox" checked={edu.is_completed} onChange={(e) => { const n = [...educationList]; n[index].is_completed = e.target.checked; setEducationList(n); }} className="accent-purple-500" /> Completed
                                                </label>
                                                {!edu.is_completed && <input placeholder="Year" value={edu.year_of_study || ""} onChange={(e) => { const n = [...educationList]; n[index].year_of_study = e.target.value; setEducationList(n); }} className="bg-zinc-900 border border-zinc-800 rounded-md p-1 w-16 text-center text-[10px] outline-none text-white focus:border-purple-500" />}
                                                <button onClick={() => { const n = [...educationList]; n[index].is_visible = !n[index].is_visible; setEducationList(n); }} className="ml-auto text-zinc-500 hover:text-white transition">
                                                    {edu.is_visible ? <Eye className="w-3 h-3 text-green-400" /> : <EyeOff className="w-3 h-3" />}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {educationList.length === 0 && <div className="text-center py-8 text-zinc-600 italic text-sm">Add education details.</div>}
                                </div>
                            </motion.div>

                            {/* Expertise Section */}
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 p-6 rounded-[2rem] flex flex-col">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-lg font-bold flex items-center gap-2 text-zinc-100"><Code2 className="w-5 h-5 text-blue-400"/> Expertise</h3>
                                    <select className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-3 py-1.5 rounded-lg text-[10px] transition-all cursor-pointer outline-none shadow-lg shadow-blue-900/20 appearance-none" value={dropdownValue} onChange={e => { startSkillTest(e.target.value); setDropdownValue(""); }}>
                                        <option value="" disabled>+ Add Skill</option>
                                        {PRESET_SKILLS.filter(s => !skills.find(sk => sk.name === s)).map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div className="flex flex-wrap gap-2 flex-1 content-start">
                                    {skills.map(s => (
                                        <div key={s.name} className="flex items-center gap-2 bg-black/40 border border-white/10 pl-3 pr-2 py-1.5 rounded-xl">
                                            <span className="text-xs font-medium text-white">{s.name}</span>
                                            <span className="text-[9px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded-md font-bold uppercase">{s.level}</span>
                                            <button onClick={() => removeSkill(s.name)} className="p-0.5 text-zinc-600 hover:text-red-500 transition"><X className="w-3 h-3" /></button>
                                        </div>
                                    ))}
                                    {skills.length === 0 && <div className="w-full text-center py-8 text-zinc-600 text-sm">Verify skills to boost your score.</div>}
                                </div>
                            </motion.div>
                        </div>

                        {/* --- SOCIAL & IMPACT SECTION (Grid) --- */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            
                            {/* Social Links */}
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 p-6 rounded-[2rem]">
                                <h3 className="text-lg font-bold flex items-center gap-2 mb-6 text-zinc-100"><Globe className="w-5 h-5 text-pink-400"/> Socials</h3>
                                <div className="space-y-3 mb-6 max-h-60 overflow-y-auto custom-scrollbar">
                                    {socialLinks.map((l, i) => (
                                        <div key={i} className="flex items-center justify-between bg-black/40 border border-white/5 p-3 rounded-xl group hover:border-white/10 transition">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="p-2 bg-white/5 rounded-lg text-zinc-400">
                                                    {l.platform.toLowerCase() === 'twitter' ? <Twitter className="w-3.5 h-3.5"/> : l.platform.toLowerCase() === 'github' ? <Github className="w-3.5 h-3.5"/> : <Globe className="w-3.5 h-3.5"/>}
                                                </div>
                                                <div className="flex flex-col overflow-hidden">
                                                    <span className="text-[10px] font-bold text-zinc-500 uppercase">{l.platform}</span>
                                                    <span className="text-xs text-blue-400 truncate max-w-[150px]">{l.url}</span>
                                                </div>
                                            </div>
                                            <button onClick={() => setSocialLinks(socialLinks.filter((_, idx) => idx !== i))} className="text-zinc-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"><Trash2 className="w-3.5 h-3.5"/></button>
                                        </div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-1 gap-2">
                                    <div className="flex gap-2">
                                        <input className="w-1/3 bg-black/50 border border-zinc-800 rounded-lg p-2 text-xs text-white outline-none focus:border-pink-500 transition placeholder:text-zinc-700" placeholder="Platform" value={newLinkPlatform} onChange={e => setNewLinkPlatform(e.target.value)} />
                                        <input className="flex-1 bg-black/50 border border-zinc-800 rounded-lg p-2 text-xs text-white outline-none focus:border-pink-500 transition placeholder:text-zinc-700" placeholder="URL" value={newLinkUrl} onChange={e => setNewLinkUrl(e.target.value)} />
                                    </div>
                                    <button onClick={addSocialLink} className="w-full py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg font-bold text-xs transition flex items-center justify-center gap-2"><Plus className="w-3 h-3"/> Add Link</button>
                                </div>
                            </motion.div>

                            {/* Achievements */}
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 p-6 rounded-[2rem]">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-lg font-bold flex items-center gap-2 text-zinc-100"><Award className="w-5 h-5 text-orange-400"/> Achievements</h3>
                                    <button onClick={() => toggleVisibility('achievements')} className="text-zinc-500 hover:text-white transition">
                                        {visibility.achievements ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                    </button>
                                </div>
                                <div className="space-y-3 mb-6 max-h-60 overflow-y-auto custom-scrollbar">
                                    {achievements.map((a, i) => (
                                        <div key={i} className="bg-black/40 border border-white/5 p-3 rounded-xl group relative hover:bg-white/5 transition">
                                            <h4 className="text-xs font-bold text-white pr-6">{a.title}</h4>
                                            <p className="text-[10px] text-zinc-500 line-clamp-1 mt-1">{a.description}</p>
                                            <button onClick={() => setAchievements(achievements.filter((_, idx) => idx !== i))} className="absolute top-3 right-3 text-zinc-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"><X className="w-3.5 h-3.5"/></button>
                                        </div>
                                    ))}
                                    {achievements.length === 0 && <div className="text-center py-8 text-zinc-600 italic text-sm">No achievements added yet.</div>}
                                </div>
                                <div className="space-y-2">
                                    <input className="w-full bg-black/50 border border-zinc-800 rounded-lg p-2 text-xs text-white outline-none focus:border-orange-500 transition placeholder:text-zinc-700" placeholder="Title" value={achTitle} onChange={e => setAchTitle(e.target.value)} />
                                    <div className="flex gap-2">
                                        <input className="flex-1 bg-black/50 border border-zinc-800 rounded-lg p-2 text-xs text-white outline-none focus:border-orange-500 transition placeholder:text-zinc-700" placeholder="Description" value={achDesc} onChange={e => setAchDesc(e.target.value)} />
                                        <button onClick={addAchievement} className="p-2 bg-orange-500/20 text-orange-400 hover:bg-orange-500 hover:text-white rounded-lg transition"><Plus className="w-4 h-4"/></button>
                                    </div>
                                </div>
                            </motion.div>
                        </div>

                        {/* --- AVAILABILITY (Full Width) --- */}
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 p-8 rounded-[2.5rem]">
                            <h3 className="text-lg font-bold flex items-center gap-3 mb-8 text-zinc-100"><Calendar className="w-5 h-5 text-green-400"/> Availability Schedule</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {availability.map((dayData, index) => (
                                    <div key={dayData.day} className={`p-4 rounded-2xl border transition-all ${dayData.enabled ? "bg-black/60 border-green-500/30" : "bg-white/5 border-transparent opacity-40 hover:opacity-60"}`}>
                                        <div className="flex justify-between items-center mb-3">
                                            <div className="flex items-center gap-2 cursor-pointer" onClick={() => toggleDay(index)}>
                                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition ${dayData.enabled ? 'bg-green-500 border-green-500' : 'border-zinc-600'}`}>
                                                    {dayData.enabled && <CheckCircle className="w-3 h-3 text-black" />}
                                                </div>
                                                <span className="text-xs font-bold text-white">{dayData.day.substring(0, 3)}</span>
                                            </div>
                                            {dayData.enabled && <button onClick={() => addSlot(index)} className="text-zinc-500 hover:text-white"><Plus className="w-3 h-3"/></button>}
                                        </div>
                                        {dayData.enabled && dayData.slots.map((slot, sIndex) => (
                                            <div key={sIndex} className="flex items-center gap-1 mt-1 bg-white/5 p-1.5 rounded-lg">
                                                <input type="time" value={slot.start} onChange={e => updateSlot(index, sIndex, 'start', e.target.value)} className="bg-transparent text-[10px] text-white outline-none w-10 p-0" />
                                                <span className="text-zinc-600 text-[10px]">-</span>
                                                <input type="time" value={slot.end} onChange={e => updateSlot(index, sIndex, 'end', e.target.value)} className="bg-transparent text-[10px] text-white outline-none w-10 p-0" />
                                                <button onClick={() => removeSlot(index, sIndex)} className="ml-auto text-zinc-600 hover:text-red-500"><X className="w-3 h-3"/></button>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </motion.div>

                    </div>
                </div>
            </div>

            {/* QUIZ MODAL */}
            <AnimatePresence>
                {showQuiz && (
                    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[100] p-4">
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-zinc-900 border border-zinc-700 p-8 rounded-3xl w-full max-w-lg shadow-2xl relative">
                            {!quizResult ? (
                                <>
                                    <div className="flex justify-between items-center mb-6">
                                        <div>
                                            <h2 className="text-2xl font-bold text-white">{quizSkill} Test</h2>
                                            <p className="text-zinc-500 text-xs">Question {currentQ + 1} of {questions.length}</p>
                                        </div>
                                        <div className="text-xl font-mono font-black text-white bg-white/10 px-3 py-1 rounded-lg">{timer}s</div>
                                    </div>
                                    <div className="w-full bg-zinc-800 h-1 rounded-full mb-8 overflow-hidden">
                                        <motion.div className="h-full bg-blue-500" initial={{ width: 0 }} animate={{ width: `${((currentQ + 1) / questions.length) * 100}%` }} />
                                    </div>
                                    <h3 className="text-lg font-medium text-zinc-200 mb-8">{questions[currentQ]?.text}</h3>
                                    <div className="space-y-3">
                                        {questions[currentQ]?.options.map((opt: string, i: number) => (
                                            <button key={i} onClick={() => handleAnswer(i)} className="w-full text-left p-4 bg-black/40 hover:bg-blue-600 hover:text-white border border-zinc-800 rounded-xl transition font-medium text-sm text-zinc-300">
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-8">
                                    <div className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-6 ${quizResult.passed ? 'bg-green-500 text-black' : 'bg-red-500 text-white'}`}>
                                        {quizResult.passed ? <CheckCircle className="w-10 h-10"/> : <AlertTriangle className="w-10 h-10"/>}
                                    </div>
                                    <h2 className="text-3xl font-black text-white mb-2">{quizResult.passed ? "Verified!" : "Failed"}</h2>
                                    <p className="text-zinc-400 mb-8">Score: {quizResult.percentage.toFixed(0)}%</p>
                                    <button onClick={() => setShowQuiz(false)} className="w-full bg-white text-black py-3 rounded-xl font-bold hover:bg-zinc-200 transition">Close</button>
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}