"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import api from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import GlobalHeader from "@/components/GlobalHeader";
import { 
    Save, ArrowLeft, Clock, Calendar, Code2, Star, Heart, User, Plus, X, 
    Trash2, Zap, CheckCircle, AlertTriangle, Briefcase, Eye, EyeOff, Check,
    GraduationCap, Award, Linkedin, Code, ExternalLink, ShieldCheck, Loader2,
    Globe, Twitter, Github, Instagram, Mail
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

    if (loading) return <div className="h-screen bg-gray-950 flex items-center justify-center"><Loader2 className="animate-spin text-purple-500" /></div>;

    const totalTrust = trustBreakdown ? (
        (Number(trustBreakdown.base) || 0) + 
        (Number(trustBreakdown.github) || 0) + 
        (Number(trustBreakdown.linkedin) || 0) + 
        (Number(trustBreakdown.codeforces) || 0) + 
        (Number(trustBreakdown.leetcode) || 0)
    ) : 5.0;

    return (
        <div className="min-h-screen bg-[#050505] text-white pb-20">
            <GlobalHeader />
            
            <main className="max-w-7xl mx-auto px-4 py-8">
                {/* TOP BAR */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard" className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-all">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Profile Settings</h1>
                            <p className="text-gray-500 text-sm">Manage your professional presence and availability.</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <button 
                            onClick={() => setIsLookingForTeam(!isLookingForTeam)}
                            className={`flex-1 md:flex-none px-5 py-2.5 rounded-2xl font-bold flex items-center justify-center gap-2 text-sm transition-all border ${isLookingForTeam ? 'bg-green-500/10 border-green-500/50 text-green-400' : 'bg-white/5 border-white/10 text-gray-400'}`}
                        >
                            {isLookingForTeam ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                            {isLookingForTeam ? "Active in Matching" : "Hidden"}
                        </button>
                        <button onClick={saveProfile} className="flex-1 md:flex-none bg-purple-600 hover:bg-purple-500 px-6 py-2.5 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 transition-all">
                            <Save className="w-4 h-4" /> Save
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    
                    {/* LEFT COLUMN: IDENTITY & VERIFICATIONS */}
                    <div className="lg:col-span-4 space-y-8">
                        <div className="bg-[#0f0f0f] border border-white/5 p-6 rounded-[2rem] shadow-xl">
                            <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-purple-400"><User className="w-5 h-5" /> Identity</h3>
                            <div className="space-y-5">
                                <div>
                                    <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2 block">Current Age</label>
                                    <select className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm focus:border-purple-500 transition-all outline-none" value={age} onChange={e => setAge(e.target.value)}>
                                        <option value="">Select Age</option>
                                        {AGES.map(a => <option key={a} value={a}>{a}</option>)}
                                    </select>
                                </div>
                                
                                {/* EMAIL SECTION */}
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Email Address</label>
                                        <button 
                                            onClick={() => toggleVisibility('email')} 
                                            className={`flex items-center gap-1 text-[10px] uppercase font-bold transition-colors ${visibility.email ? "text-green-400" : "text-gray-600 hover:text-gray-400"}`}
                                        >
                                            {visibility.email ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                                            {visibility.email ? "Visible to Public" : "Hidden"}
                                        </button>
                                    </div>
                                    <div className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm text-gray-400 flex items-center gap-3 cursor-not-allowed">
                                        <Mail className="w-4 h-4 opacity-50" />
                                        <span className="flex-1 font-mono">{email}</span>
                                    </div>
                                    <p className="text-[10px] text-gray-600 mt-1.5 flex items-center gap-1">
                                        <ShieldCheck className="w-3 h-3" />
                                        Email cannot be changed manually.
                                    </p>
                                </div>

                                <div>
                                    <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2 block">Mini Bio</label>
                                    <textarea className="w-full bg-black border border-white/10 rounded-xl p-3 h-32 text-sm focus:border-purple-500 transition-all outline-none resize-none" value={about} onChange={e => setAbout(e.target.value)} placeholder="Tell the community about yourself..." />
                                </div>
                            </div>
                        </div>
                        
                        {/* TRUST SCORE BREAKDOWN (UPDATED) */}
                        {trustBreakdown && (
                            <div className="bg-[#0f0f0f] border border-white/5 p-6 rounded-[2rem]">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-bold flex items-center gap-2 text-green-400">
                                        <ShieldCheck className="w-5 h-5" /> Trust Analysis
                                    </h3>
                                    <span className="text-2xl font-black text-white">{Math.min(7.0, totalTrust).toFixed(1)}<span className="text-gray-500 text-sm">/7</span></span>
                                </div>
                                
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center bg-black p-3 rounded-xl border border-white/10">
                                        <span className="text-gray-400 text-sm font-bold">Base Score</span>
                                        <span className="text-green-400 font-bold">{trustBreakdown.base?.toFixed(1) || "5.0"}</span>
                                    </div>
                                    
                                    {/* Github Section */}
                                    <div className="bg-black p-3 rounded-xl border border-white/10">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-gray-300 text-sm font-bold flex items-center gap-2"><Github className="w-3 h-3"/> GitHub</span>
                                            <span className="text-green-400 text-xs font-mono">+{Number(trustBreakdown.github || 0).toFixed(1)}</span>
                                        </div>
                                        {trustBreakdown.details && trustBreakdown.details.some((d: string) => d.includes("GitHub")) ? (
                                            <div className="space-y-1 pl-5 border-l border-white/10">
                                                {trustBreakdown.details.filter((d:string) => d.includes("GitHub")).map((d:string, i:number) => (
                                                    <p key={i} className="text-[10px] text-gray-500">{d.replace("GitHub: ", "")}</p>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="pl-5 text-[10px] text-gray-500 italic">No GitHub stats available</div>
                                        )}
                                    </div>

                                    {/* Other Platforms */}
                                    {trustBreakdown.details?.filter((d:string) => !d.includes("GitHub")).map((detail: string, i: number) => {
                                        const parts = detail.split(":");
                                        const platform = parts[0];
                                        const info = parts[1] || "";
                                        return (
                                            <div key={i} className="flex justify-between items-center bg-black p-3 rounded-xl border border-white/10">
                                                <span className="text-gray-300 text-sm">{platform}</span>
                                                <span className="text-green-400 text-[10px] font-mono">{info}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="bg-gradient-to-br from-[#1a1a1a] to-black border border-yellow-500/20 p-6 rounded-[2rem]">
                            <h3 className="text-lg font-bold text-yellow-500 mb-6 flex items-center gap-2">
                                <Zap className="w-5 h-5" /> Connected Accounts
                            </h3>
                            <div className="space-y-4">
                                {/* Codeforces */}
                                <div className="bg-black border border-white/5 rounded-2xl p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-3">
                                            <Code className="w-5 h-5 text-gray-400"/>
                                            <span className="font-bold text-sm">Codeforces</span>
                                        </div>
                                        {connectedAccounts.codeforces ? (
                                            <button onClick={() => toggleVisibility('codeforces')} className="text-gray-500 hover:text-white">
                                                {visibility.codeforces ? <Eye className="w-4 h-4"/> : <EyeOff className="w-4 h-4"/>}
                                            </button>
                                        ) : (
                                            <button onClick={() => connectPlatform('codeforces')} className="text-xs bg-white/10 px-2 py-1 rounded text-white hover:bg-white/20">Connect</button>
                                        )}
                                    </div>
                                    {connectedAccounts.codeforces && platformStats.codeforces && (
                                        <div className="grid grid-cols-2 gap-2 mt-3">
                                            <div className="bg-white/5 p-2 rounded-lg text-center">
                                                <div className="text-[10px] text-gray-500 uppercase">Rating</div>
                                                <div className="text-lg font-black text-yellow-500">{platformStats.codeforces.rating}</div>
                                            </div>
                                            <div className="bg-white/5 p-2 rounded-lg text-center">
                                                <div className="text-[10px] text-gray-500 uppercase">Rank</div>
                                                <div className="text-sm font-bold text-white">{platformStats.codeforces.rank}</div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* LeetCode */}
                                <div className="bg-black border border-white/5 rounded-2xl p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-3">
                                            <Code2 className="w-5 h-5 text-gray-400"/>
                                            <span className="font-bold text-sm">LeetCode</span>
                                        </div>
                                        {connectedAccounts.leetcode ? (
                                            <button onClick={() => toggleVisibility('leetcode')} className="text-gray-500 hover:text-white">
                                                {visibility.leetcode ? <Eye className="w-4 h-4"/> : <EyeOff className="w-4 h-4"/>}
                                            </button>
                                        ) : (
                                            <button onClick={() => connectPlatform('leetcode')} className="text-xs bg-white/10 px-2 py-1 rounded text-white hover:bg-white/20">Connect</button>
                                        )}
                                    </div>
                                    {connectedAccounts.leetcode && platformStats.leetcode && (
                                        <div className="mt-3 bg-white/5 p-2 rounded-lg text-center">
                                            <div className="text-[10px] text-gray-500 uppercase">Problems Solved</div>
                                            <div className="text-lg font-black text-orange-500">{platformStats.leetcode.total_solved}</div>
                                        </div>
                                    )}
                                </div>
                                
                                {/* LinkedIn */}
                                <div className="bg-black border border-white/5 rounded-2xl p-4 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <Linkedin className="w-5 h-5 text-gray-400"/>
                                        <span className="font-bold text-sm">LinkedIn</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {connectedAccounts.linkedin ? <CheckCircle className="w-4 h-4 text-green-500"/> : <button onClick={() => connectPlatform('linkedin')} className="text-xs bg-white/10 px-2 py-1 rounded text-white hover:bg-white/20">Connect</button>}
                                        {connectedAccounts.linkedin && (
                                            <button onClick={() => toggleVisibility('linkedin')} className="text-gray-500 hover:text-white ml-2">
                                                {visibility.linkedin ? <Eye className="w-3 h-3"/> : <EyeOff className="w-3 h-3"/>}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: EXPERTISE, EDUCATION, SOCIALS, ACHIEVEMENTS */}
                    <div className="lg:col-span-8 space-y-8">
                        
                        {/* ACADEMIC QUALIFICATIONS */}
                        <div className="bg-[#0f0f0f] border border-white/5 p-6 rounded-[2rem]">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold flex items-center gap-2 text-purple-400">
                                    <GraduationCap className="w-5 h-5" /> Academic Qualifications
                                </h3>
                                <button onClick={() => setEducationList([...educationList, { institute: "", course: "", year_of_study: "", is_completed: false, is_visible: true }])} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition">
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>
                            
                            <div className="space-y-4">
                                {educationList.map((edu, index) => (
                                    <div key={index} className="p-4 bg-black border border-white/10 rounded-xl relative group">
                                        <button onClick={() => setEducationList(educationList.filter((_, i) => i !== index))} className="absolute top-2 right-2 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                            <X className="w-4 h-4" />
                                        </button>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
                                            <input placeholder="Institute Name" value={edu.institute} onChange={(e) => { const n = [...educationList]; n[index].institute = e.target.value; setEducationList(n); }} className="bg-white/5 border border-white/10 rounded-lg p-2 text-sm outline-none focus:border-purple-500 transition-colors" />
                                            <input placeholder="Course (e.g. B.Tech)" value={edu.course} onChange={(e) => { const n = [...educationList]; n[index].course = e.target.value; setEducationList(n); }} className="bg-white/5 border border-white/10 rounded-lg p-2 text-sm outline-none focus:border-purple-500 transition-colors" />
                                        </div>

                                        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400">
                                            <label className="flex items-center gap-2 cursor-pointer bg-white/5 px-3 py-1.5 rounded-lg hover:bg-white/10 transition">
                                                <input type="checkbox" checked={edu.is_completed} onChange={(e) => { const n = [...educationList]; n[index].is_completed = e.target.checked; setEducationList(n); }} />
                                                Completed?
                                            </label>

                                            {!edu.is_completed && (
                                                <input placeholder="Year (e.g. 3rd)" value={edu.year_of_study || ""} onChange={(e) => { const n = [...educationList]; n[index].year_of_study = e.target.value; setEducationList(n); }} className="bg-white/5 border border-white/10 rounded-lg p-1.5 w-24 text-center outline-none" />
                                            )}

                                            <label className="flex items-center gap-2 cursor-pointer ml-auto text-gray-500 hover:text-white transition">
                                                <input type="checkbox" checked={edu.is_visible} onChange={(e) => { const n = [...educationList]; n[index].is_visible = e.target.checked; setEducationList(n); }} className="hidden" />
                                                {edu.is_visible ? <Eye className="w-3 h-3 text-green-400" /> : <EyeOff className="w-3 h-3" />}
                                                {edu.is_visible ? "Visible" : "Hidden"}
                                            </label>
                                        </div>
                                    </div>
                                ))}
                                {educationList.length === 0 && <div className="text-center text-gray-600 text-sm py-4">Add your education details to find better peers.</div>}
                            </div>
                        </div>

                        {/* EXPERTISE SECTION */}
                        <div className="bg-[#0f0f0f] border border-white/5 p-8 rounded-[2.5rem]">
                            <div className="flex justify-between items-center mb-8">
                                <h3 className="text-xl font-bold flex items-center gap-3 text-blue-400"><Code2 className="w-6 h-6" /> Expertise</h3>
                                <select className="bg-blue-500 hover:bg-blue-400 text-black font-bold px-4 py-2 rounded-xl text-xs transition-all cursor-pointer outline-none shadow-lg shadow-blue-500/20" value={dropdownValue} onChange={e => { startSkillTest(e.target.value); setDropdownValue(""); }}>
                                    <option value="" disabled>+ Add & Verify</option>
                                    {PRESET_SKILLS.filter(s => !skills.find(sk => sk.name === s)).map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div className="flex flex-wrap gap-3">
                                {skills.length > 0 ? skills.map(s => (
                                    <div key={s.name} className="group relative flex items-center gap-2 bg-black border border-white/10 pl-4 pr-2 py-2 rounded-2xl hover:border-blue-500/50 transition-all">
                                        <span className="text-sm font-medium">{s.name}</span>
                                        <span className="text-[9px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-lg font-black uppercase tracking-tighter">{s.level}</span>
                                        <button onClick={() => removeSkill(s.name)} className="ml-2 p-1 text-gray-600 hover:text-red-500 transition-colors">
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                )) : (
                                    <div className="w-full text-center py-4 text-gray-600 text-sm italic">No skills verified yet. Take a test to boost your score!</div>
                                )}
                            </div>
                        </div>

                        {/* SOCIAL PRESENCE */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-[#0f0f0f] border border-white/5 p-6 rounded-[2rem] flex flex-col">
                                <h3 className="font-bold mb-6 text-pink-400 flex items-center gap-2"><Heart className="w-5 h-5" /> Social Presence</h3>
                                <div className="space-y-2 flex-1 overflow-y-auto max-h-60 mb-6 pr-1 custom-scrollbar">
                                    {socialLinks.length > 0 ? socialLinks.map((l, i) => (
                                        <div key={i} className="flex items-center justify-between bg-black border border-white/5 p-3 rounded-xl group transition-all hover:bg-white/5">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="p-2 bg-white/5 rounded-lg text-gray-400">
                                                    {l.platform.toLowerCase() === 'twitter' ? <Twitter className="w-3.5 h-3.5" /> : 
                                                     l.platform.toLowerCase() === 'github' ? <Github className="w-3.5 h-3.5" /> : 
                                                     l.platform.toLowerCase() === 'instagram' ? <Instagram className="w-3.5 h-3.5" /> : 
                                                     <Globe className="w-3.5 h-3.5" />}
                                                </div>
                                                <div className="flex flex-col overflow-hidden">
                                                    <span className="text-[10px] font-bold text-gray-500 uppercase">{l.platform}</span>
                                                    <span className="text-xs text-blue-400 truncate">{l.url}</span>
                                                </div>
                                            </div>
                                            <button onClick={() => setSocialLinks(socialLinks.filter((_, idx) => idx !== i))} className="p-2 text-gray-600 hover:text-red-500 md:opacity-0 group-hover:opacity-100 transition-all">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )) : (
                                        <div className="flex flex-col items-center justify-center py-8 opacity-20">
                                            <Globe className="w-8 h-8 mb-2" />
                                            <p className="text-xs">No links added</p>
                                        </div>
                                    )}
                                </div>
                                <div className="mt-auto space-y-3 pt-4 border-t border-white/5">
                                    <div className="grid grid-cols-2 gap-2">
                                        <input className="bg-black border border-white/10 rounded-xl p-3 text-xs outline-none focus:border-pink-500/50 transition-all" placeholder="Platform" value={newLinkPlatform} onChange={e => setNewLinkPlatform(e.target.value)} />
                                        <input className="bg-black border border-white/10 rounded-xl p-3 text-xs outline-none focus:border-pink-500/50 transition-all" placeholder="URL" value={newLinkUrl} onChange={e => setNewLinkUrl(e.target.value)} />
                                    </div>
                                    <button onClick={addSocialLink} className="w-full py-3 bg-white text-black rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-gray-200 transition-all">
                                        <Plus className="w-4 h-4" /> Add Social Link
                                    </button>
                                </div>
                            </div>

                            {/* ACHIEVEMENTS */}
                            <div className="bg-[#0f0f0f] border border-white/5 p-6 rounded-[2rem] flex flex-col">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="font-bold text-orange-400 flex items-center gap-2"><Award className="w-5 h-5" /> Achievements</h3>
                                    <button onClick={() => toggleVisibility('achievements')} className="text-gray-500 hover:text-white">
                                        {visibility.achievements ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                    </button>
                                </div>
                                <div className="space-y-2 flex-1 overflow-y-auto max-h-60 mb-6 pr-1 custom-scrollbar">
                                    {achievements.length > 0 ? achievements.map((a, i) => (
                                        <div key={i} className="bg-black border border-white/5 p-3 rounded-xl group relative hover:bg-white/5 transition-all">
                                            <h4 className="text-xs font-bold text-white pr-6">{a.title}</h4>
                                            <p className="text-[10px] text-gray-500 line-clamp-2 mt-1">{a.description}</p>
                                            <button onClick={() => setAchievements(achievements.filter((_, idx) => idx !== i))} className="absolute top-3 right-3 p-1 md:opacity-0 group-hover:opacity-100 text-red-500 transition-all">
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    )) : (
                                        <div className="flex flex-col items-center justify-center py-8 opacity-20">
                                            <Award className="w-8 h-8 mb-2" />
                                            <p className="text-xs">Brag about your wins</p>
                                        </div>
                                    )}
                                </div>
                                <div className="mt-auto space-y-2 pt-4 border-t border-white/5">
                                    <input className="w-full bg-black border border-white/10 rounded-xl p-3 text-xs outline-none focus:border-orange-500/50 transition-all" placeholder="Achievement Title" value={achTitle} onChange={e => setAchTitle(e.target.value)} />
                                    <div className="flex gap-2">
                                        <input className="flex-1 bg-black border border-white/10 rounded-xl p-3 text-xs outline-none focus:border-orange-500/50 transition-all" placeholder="Brief description" value={achDesc} onChange={e => setAchDesc(e.target.value)} />
                                        <button onClick={addAchievement} className="p-3 bg-orange-500 text-black rounded-xl hover:bg-orange-400 transition-all">
                                            <Plus className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* PEER TESTIMONIALS (RESTORED) */}
                        {ratings.length > 0 && (
                            <div className="bg-[#0f0f0f] border border-white/5 p-8 rounded-[2.5rem]">
                                <div className="flex justify-between items-center mb-8">
                                    <h3 className="text-xl font-bold text-yellow-400 flex items-center gap-3"><Star className="w-6 h-6" /> Peer Testimonials</h3>
                                    <button onClick={() => toggleVisibility('ratings')} className="text-gray-500 hover:text-white">
                                        {visibility.ratings ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {ratings.map((r, i) => (
                                        <div key={i} className="bg-black border border-white/10 p-5 rounded-2xl relative overflow-hidden group hover:border-yellow-500/30 transition-all">
                                            <div className="absolute top-0 right-0 p-3 bg-yellow-500/10 text-yellow-500 text-sm font-black">{r.score}</div>
                                            <h4 className="font-bold text-white text-sm pr-10">{r.project_name}</h4>
                                            <p className="text-[10px] text-gray-500 mb-3">by {r.rater_name}</p>
                                            <p className="text-xs text-gray-400 italic leading-relaxed">"{r.explanation}"</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* AVAILABILITY */}
                        <div className="bg-[#0f0f0f] border border-white/5 p-8 rounded-[2.5rem]">
                            <h3 className="text-xl font-bold flex items-center gap-3 mb-8 text-green-400"><Calendar className="w-6 h-6" /> Collaboration Schedule</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {availability.map((dayData, index) => (
                                    <div key={dayData.day} className={`p-5 rounded-2xl border transition-all ${dayData.enabled ? "bg-black border-green-500/30 shadow-lg shadow-green-500/5" : "bg-[#0a0a0a] border-white/5 opacity-40"}`}>
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-3 cursor-pointer" onClick={() => toggleDay(index)}>
                                                <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${dayData.enabled ? 'bg-green-500 border-transparent' : 'border-white/20 bg-transparent'}`}>
                                                    {dayData.enabled && <Check className="w-3 h-3 text-black stroke-[4px]" />}
                                                </div>
                                                <span className={`text-sm font-bold ${dayData.enabled ? "text-white" : "text-gray-500"}`}>{dayData.day}</span>
                                            </div>
                                            {dayData.enabled && <button onClick={() => addSlot(index)} className="p-1.5 bg-white/5 rounded-lg hover:bg-white/10 transition-all"><Plus className="w-3 h-3 text-green-400" /></button>}
                                        </div>
                                        {dayData.enabled && dayData.slots.map((slot, sIndex) => (
                                            <div key={sIndex} className="flex items-center gap-2 mt-2 bg-white/5 p-2 rounded-xl">
                                                <Clock className="w-3 h-3 text-gray-500" />
                                                <input type="time" value={slot.start} onChange={e => updateSlot(index, sIndex, 'start', e.target.value)} className="bg-transparent text-[10px] text-white outline-none w-14 focus:text-green-400 transition-colors" />
                                                <span className="text-gray-700">-</span>
                                                <input type="time" value={slot.end} onChange={e => updateSlot(index, sIndex, 'end', e.target.value)} className="bg-transparent text-[10px] text-white outline-none w-14 focus:text-green-400 transition-colors" />
                                                <button onClick={() => removeSlot(index, sIndex)} className="ml-auto text-gray-600 hover:text-red-500 p-1"><X className="w-3 h-3" /></button>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* QUIZ MODAL */}
            <AnimatePresence>
                {showQuiz && (
                    <div className="fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center z-[100] p-4">
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#111] border border-white/10 p-10 rounded-[3rem] w-full max-w-xl text-center relative overflow-hidden">
                            {!quizResult ? (
                                <>
                                    <div className="flex justify-between items-center mb-10">
                                        <div className="text-left">
                                            <h2 className="text-2xl font-bold text-white">{quizSkill}</h2>
                                            <p className="text-gray-500 text-xs">Question {currentQ + 1} of {questions.length}</p>
                                        </div>
                                        <div className={`px-4 py-2 rounded-2xl font-mono text-xl font-black ${timer < 5 ? "bg-red-500/20 text-red-500 animate-pulse" : "bg-white/5 text-white"}`}>
                                            {timer}s
                                        </div>
                                    </div>
                                    <div className="w-full bg-white/5 h-1.5 rounded-full mb-10 overflow-hidden">
                                        <motion.div className="h-full bg-blue-500" initial={{ width: 0 }} animate={{ width: `${((currentQ + 1) / questions.length) * 100}%` }} />
                                    </div>
                                    <h3 className="text-xl font-medium leading-relaxed mb-10 min-h-[80px]">{questions[currentQ]?.text}</h3>
                                    <div className="grid grid-cols-1 gap-4">
                                        {questions[currentQ]?.options.map((opt: string, i: number) => (
                                            <button key={i} onClick={() => handleAnswer(i)} className="bg-white/5 hover:bg-blue-500 hover:text-black p-5 rounded-[1.5rem] text-left transition-all border border-white/5 hover:border-transparent font-bold">
                                                <span className="opacity-50 mr-4 font-mono">{String.fromCharCode(65 + i)}</span> {opt}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <div className="py-10">
                                    <div className="mb-8 flex justify-center">
                                        {quizResult.passed ? (
                                            <div className="bg-green-500 text-black p-6 rounded-full"><CheckCircle className="w-16 h-16" /></div>
                                        ) : (
                                            <div className="bg-red-500 text-white p-6 rounded-full"><AlertTriangle className="w-16 h-16" /></div>
                                        )}
                                    </div>
                                    <h2 className="text-4xl font-black mb-4">{quizResult.passed ? "SUCCESS!" : "FAILED"}</h2>
                                    <p className="text-gray-400 mb-10 text-lg">Your accuracy: {quizResult.percentage.toFixed(0)}%</p>
                                    <button onClick={() => setShowQuiz(false)} className="w-full bg-white text-black py-4 rounded-2xl font-black hover:bg-gray-200 transition-all uppercase tracking-widest">
                                        Continue
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #222; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #333; }
            `}</style>
        </div>
    );
}