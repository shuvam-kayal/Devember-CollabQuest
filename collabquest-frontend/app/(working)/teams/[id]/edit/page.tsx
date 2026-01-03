"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Cookies from "js-cookie";
import api from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast, Toaster } from "sonner";
import Link from "next/link";
import {
  ArrowLeft, Save, Sparkles, Loader2, X, Plus, Trash2,
  AlertTriangle, Crown, Search, LayoutGrid, Users, Zap,
  UserMinus, Check, CheckCircle2
} from "lucide-react";

// --- INTERFACES ---
interface Member { id: string; username: string; avatar_url: string; email: string; }
interface DeletionRequest { is_active: boolean; votes: { [key: string]: string }; }
interface CompletionRequest { is_active: boolean; votes: { [key: string]: string }; }
interface MemberRequest { id: string; target_user_id: string; type: "leave" | "remove"; explanation: string; is_active: boolean; votes: { [key: string]: string }; }

interface TeamData {
  id: string;
  members: Member[];
  deletion_request?: DeletionRequest;
  completion_request?: CompletionRequest;
  member_requests: MemberRequest[];
  status: string;
}

// --- CONSTANTS & SCHEMAS ---
const PRESET_SKILLS = ["React", "Python", "Node.js", "TypeScript", "Next.js", "Tailwind", "MongoDB", "Firebase", "Flutter", "Java", "C++", "Rust", "Go", "Figma", "UI/UX", "AI/ML", "Docker", "AWS", "Solidity"];

const teamFormSchema = z.object({
  name: z.string().min(3, "Min 3 characters"),
  description: z.string().min(10, "Min 10 characters"),
  targetMembers: z.coerce.number().min(2).max(50),
  targetDate: z.string().optional(),
  isRecruiting: z.boolean(),
});

type TeamFormValues = z.infer<typeof teamFormSchema>;

export default function EditTeamPage() {
  const params = useParams();
  const router = useRouter();
  const teamId = params.id as string;
  const [loading, setLoading] = useState(true);

  // --- VOTING & USER STATE ---
  const [currentUserId, setCurrentUserId] = useState("");
  const [teamData, setTeamData] = useState<TeamData | null>(null);
  const [deletionProcessing, setDeletionProcessing] = useState(false);
  const [completionProcessing, setCompletionProcessing] = useState(false);

  // --- FORM STATE ---
  const [activeSkills, setActiveSkills] = useState<any[]>([]);
  const [activeSkillInput, setActiveSkillInput] = useState("");
  const [techStack, setTechStack] = useState<any[]>([]);
  const [stackSearch, setStackSearch] = useState("");
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<any>(null);
  const [newLeaderId, setNewLeaderId] = useState("");
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

  // Mouse State
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<TeamFormValues>({
    resolver: zodResolver(teamFormSchema) as any,
    defaultValues: { name: "", description: "", targetMembers: 4, isRecruiting: true }
  });

  const isRecruiting = watch("isRecruiting");

  // 1. Mouse Effect Hook
  useEffect(() => {
    const updateMousePosition = (ev: MouseEvent) => {
      setMousePosition({ x: ev.clientX, y: ev.clientY });
    };
    window.addEventListener("mousemove", updateMousePosition);
    return () => {
      window.removeEventListener("mousemove", updateMousePosition);
    };
  }, []);

  // 2. Data Fetching Hook
  useEffect(() => {
    const token = Cookies.get("token");
    if (!token) return router.push("/");

    // Fetch User ID
    api.get("/users/me").then(res => setCurrentUserId(res.data._id || res.data.id)).catch(console.error);

    const fetchTeam = async () => {
      try {
        const res = await api.get(`/teams/${teamId}`);
        const t = res.data;

        setTeamData(t); // Store full object for voting logic

        // --- 🛡️ DEFENSIVE SANITIZATION 🛡️ ---
        const sanitize = (skills: any[]) => {
          if (!Array.isArray(skills)) return [];
          return skills.map(s => {
            if (typeof s === 'string') return s;
            if (typeof s === 'object' && s !== null && s.name) return s.name;
            return String(s);
          });
        };

        const cleanActive = sanitize(t.active_needed_skills);
        const cleanStack = sanitize(t.needed_skills);
        // -------------------------------------

        setValue("name", t.name);
        setValue("description", t.description);
        setValue("targetMembers", t.target_members);
        if (t.target_completion_date) setValue("targetDate", new Date(t.target_completion_date).toISOString().split('T')[0]);
        setValue("isRecruiting", t.is_looking_for_members);

        setActiveSkills(cleanActive);
        setTechStack(cleanStack);

        setTeamMembers(t.members || []);
      } catch (error) {
        toast.error("Failed to load team data");
      } finally {
        setLoading(false);
      }
    };

    if (teamId) fetchTeam();

    // Listen for updates (if you trigger them elsewhere)
    const handleRefresh = () => { if (teamId) fetchTeam(); };
    window.addEventListener("dashboardUpdate", handleRefresh);
    return () => window.removeEventListener("dashboardUpdate", handleRefresh);

  }, [teamId, router, setValue]);

  // --- VOTING HANDLERS ---
  const refreshData = async () => {
    try {
      const res = await api.get(`/teams/${teamId}`);
      setTeamData(res.data);
    } catch (e) { console.error(e); }
  };

  const handleVoteRequest = async (reqId: string, decision: 'approve' | 'reject') => {
    try {
      await api.post(`/teams/${teamId}/member-request/${reqId}/vote`, { decision });
      toast.success("Vote recorded");
      refreshData();
    } catch (e) { toast.error("Voting failed"); }
  };

  const handleVoteDelete = async (decision: 'approve' | 'reject') => {
    setDeletionProcessing(true);
    try {
      const res = await api.post(`/teams/${teamId}/delete/vote`, { decision });
      if (res.data.status === "deleted") {
        toast.success("Team deleted");
        router.push("/dashboard");
      } else {
        toast.success("Vote recorded");
        refreshData();
      }
    } catch (e) { toast.error("Voting failed"); }
    finally { setDeletionProcessing(false); }
  };

  const handleVoteComplete = async (decision: 'approve' | 'reject') => {
    setCompletionProcessing(true);
    try {
      await api.post(`/teams/${teamId}/complete/vote`, { decision });
      toast.success("Vote recorded");
      refreshData();
    } catch (e) { toast.error("Voting failed"); }
    finally { setCompletionProcessing(false); }
  };

  // --- FORM HANDLERS ---
  const onSubmit = async (data: TeamFormValues) => {
    try {
      await api.put(`/teams/${teamId}`, {
        name: data.name,
        description: data.description,
        target_members: data.targetMembers,
        target_completion_date: data.targetDate ? new Date(data.targetDate).toISOString() : null,
        active_needed_skills: activeSkills,
        is_looking_for_members: data.isRecruiting
      });
      await api.put(`/teams/${teamId}/skills`, { needed_skills: techStack });
      toast.success("Settings saved successfully!");
      router.refresh();
    } catch (e) { toast.error("Save failed."); }
  };

  const getSkillLabel = (skill: any) => {
    if (typeof skill === 'string') return skill;
    if (typeof skill === 'object' && skill?.name) return skill.name;
    return "Unknown Skill";
  };

  const addActiveSkill = () => {
    const val = activeSkillInput.trim();
    if (val && !activeSkills.includes(val)) {
      setActiveSkills([...activeSkills, val]);
      setActiveSkillInput("");
    }
  };

  const toggleStackSkill = (s: string) => {
    const existing = techStack.find(t => getSkillLabel(t) === s);
    if (existing) setTechStack(techStack.filter(x => getSkillLabel(x) !== s));
    else { setTechStack([...techStack, s]); setStackSearch(""); }
  };

  const askAi = async () => {
    setIsSuggesting(true);
    try {
      const res = await api.post("/teams/suggest-stack", { description: document.querySelector('textarea')?.value || "", current_skills: techStack });
      if (res.data?.add) {
        res.data.add.forEach((s: string) => !techStack.includes(s) && setTechStack(prev => [...prev, s]));
        toast.success(`AI added ${res.data.add.length} skills!`);
      }
    } catch (e) { toast.error("AI Unavailable"); } finally { setIsSuggesting(false); }
  };

  const openModal = (type: string) => {
    const config = {
      delete: {
        title: "Delete Project", action: () => api.post(`/teams/${teamId}/delete/initiate`, {}).then(() => { toast.success("Vote initiated"); refreshData(); }).catch((e) => {
          const msg = e.response?.data?.detail || "Failed to initiate vote";
          toast.error(msg);
        })
      },
      complete: { title: "Mark Complete", action: () => api.post(`/teams/${teamId}/complete/initiate`, {}).then(() => { toast.success("Vote initiated"); refreshData(); }).catch((e) => {
        const msg = e.response?.data?.detail || "Failed to initiate vote";
        toast.error(msg);
      }) },
      transfer: { title: "Transfer Leadership", action: () => api.post(`/teams/${teamId}/transfer-leadership`, { new_leader_id: newLeaderId }).then(() => router.push(`/teams/${teamId}`)).catch((e) => {
        const msg = e.response?.data?.detail || "Transfer failed";
        toast.error(msg);
      }) }
    };
    // @ts-ignore
    setModalConfig(config[type]);
    setModalOpen(true);
  };

  if (loading || !teamData) return <div className="h-screen bg-black flex items-center justify-center text-gray-500 animate-pulse">Loading Workspace...</div>;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-gray-100 font-sans selection:bg-purple-500/30 relative overflow-hidden">
      <Toaster position="bottom-right" theme="dark" richColors />

      {/* --- CURSOR GLOW EFFECT --- */}
      <div
        className="pointer-events-none fixed inset-0 z-30 transition-opacity duration-300"
        style={{
          background: `radial-gradient(800px at ${mousePosition.x}px ${mousePosition.y}px, rgba(168, 85, 247, 0.1), transparent 80%)`,
        }}
      />

      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[#050505]" />
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[60%] bg-purple-900/10 blur-[100px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[50%] bg-blue-900/10 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute inset-0 opacity-[0.02] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] brightness-100 contrast-150"></div>
      </div>

      <div className="relative z-40 max-w-6xl mx-auto px-6 py-10">

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div className="flex items-center gap-4">
            <Link href={`/teams/${teamId}`} className="p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-full transition-all group backdrop-blur-md">
              <ArrowLeft className="w-5 h-5 text-gray-400 group-hover:text-white" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Edit Team Settings</h1>
              <p className="text-gray-500 text-sm">Manage your project details and recruitment.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href={`/teams/${teamId}`}><button className="px-6 py-2.5 text-sm font-medium text-gray-400 hover:text-white transition-colors">Cancel</button></Link>
            <button onClick={handleSubmit(onSubmit)} disabled={isSubmitting} className="px-6 py-2.5 bg-white text-black text-sm font-bold rounded-full hover:bg-gray-200 transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.2)]">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Changes
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

          <div className="lg:col-span-2 space-y-8">

            <div className="bg-[#0F0F0F]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-8 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500/0 via-purple-500/20 to-purple-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-purple-500/10 rounded-lg"><LayoutGrid className="w-5 h-5 text-purple-400" /></div>
                <h2 className="text-lg font-semibold text-white">Project Details</h2>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Team Name</label>
                  <input {...register("name")} className="w-full bg-black/40 border border-white/5 rounded-xl p-4 text-white focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all outline-none" placeholder="Project Name" />
                  {errors.name && <p className="text-red-400 text-xs mt-2 ml-1">{errors.name.message}</p>}
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Description</label>
                  <textarea {...register("description")} className="w-full bg-black/40 border border-white/5 rounded-xl p-4 h-40 text-gray-300 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all outline-none resize-none leading-relaxed" placeholder="Describe your project vision..." />
                  {errors.description && <p className="text-red-400 text-xs mt-2 ml-1">{errors.description.message}</p>}
                </div>
              </div>
            </div>

            {/* Stack Card */}
            <div className="bg-[#0F0F0F]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg"><Zap className="w-5 h-5 text-blue-400" /></div>
                  <h2 className="text-lg font-semibold text-white">Tech Stack</h2>
                </div>
                <button type="button" onClick={askAi} disabled={isSuggesting} className="text-xs font-medium bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2 rounded-full hover:opacity-90 transition-opacity flex items-center gap-2 shadow-lg shadow-purple-900/20">
                  {isSuggesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Auto-Fill with AI
                </button>
              </div>

              <div className="relative mb-4">
                <Search className="absolute left-4 top-3.5 w-4 h-4 text-gray-500" />
                <input value={stackSearch} onChange={e => setStackSearch(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-xl pl-10 pr-4 py-3 text-sm focus:border-blue-500/50 outline-none transition-colors" placeholder="Search technologies (e.g. Next.js)..." />
                {stackSearch && (
                  <div className="absolute z-10 w-full mt-2 bg-[#1A1A1A] border border-white/10 rounded-xl shadow-2xl max-h-40 overflow-y-auto p-2">
                    {PRESET_SKILLS.filter(s => s.toLowerCase().includes(stackSearch.toLowerCase()) && !techStack.map(getSkillLabel).includes(s)).map(s => (
                      <button key={s} type="button" onClick={() => toggleStackSkill(s)} className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-white/5 rounded-lg">{s}</button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {/* --- 🛡️ JSX RENDER SAFETY 🛡️ --- */}
                {techStack.map((s, idx) => {
                  const label = getSkillLabel(s);
                  return (
                    <span key={`${label}-${idx}`} className="bg-blue-500/10 text-blue-200 border border-blue-500/20 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-blue-500/20 transition-colors cursor-default">
                      {label} <button type="button" onClick={() => toggleStackSkill(label)}><X className="w-3 h-3 hover:text-white" /></button>
                    </span>
                  )
                })}
                {techStack.length === 0 && <p className="text-gray-600 text-sm italic py-2">No stack selected yet.</p>}
              </div>
            </div>
          </div>

          <div className="space-y-8">

            <div className="bg-[#0F0F0F]/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-2xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-green-500/10 rounded-lg"><Users className="w-5 h-5 text-green-400" /></div>
                <h2 className="text-lg font-semibold text-white">Recruitment</h2>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-black/20 rounded-xl border border-white/5">
                  <div>
                    <p className="text-sm font-medium text-white">Looking for members?</p>
                    <p className="text-xs text-gray-500">{isRecruiting ? "Yes, show in search." : "No, invite only."}</p>
                  </div>
                  <button type="button" onClick={() => setValue("isRecruiting", !isRecruiting)} className={`w-12 h-7 rounded-full transition-colors relative ${isRecruiting ? 'bg-green-500' : 'bg-gray-700'}`}>
                    <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-all ${isRecruiting ? 'left-6' : 'left-1'}`} />
                  </button>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Team Size Target</label>
                  <input type="number" {...register("targetMembers")} className="w-full bg-black/40 border border-white/5 rounded-xl p-3 text-white outline-none" />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Open Roles</label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {/* --- 🛡️ JSX RENDER SAFETY 🛡️ --- */}
                    {activeSkills.map((s, idx) => {
                      const label = getSkillLabel(s);
                      return (
                        <span key={`${label}-${idx}`} className="bg-white/5 border border-white/10 px-3 py-1 rounded-md text-xs flex items-center gap-2">{label} <button onClick={() => setActiveSkills(activeSkills.filter(x => getSkillLabel(x) !== label))}><X className="w-3 h-3" /></button></span>
                      )
                    })}
                  </div>
                  <div className="flex gap-2">
                    <input value={activeSkillInput} onChange={e => setActiveSkillInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addActiveSkill()} className="flex-1 bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-sm outline-none" placeholder="Add role..." />
                    <button type="button" onClick={addActiveSkill} className="bg-white/10 hover:bg-white/20 p-2 rounded-lg"><Plus className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-red-900/5 backdrop-blur-xl border border-red-500/10 rounded-3xl p-6">
              <h2 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-4 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Danger Zone</h2>

              <div className="space-y-3">
                <div className="p-3 bg-red-500/5 rounded-xl border border-red-500/10">
                  <p className="text-xs text-gray-400 mb-2">Transfer Admin Rights</p>
                  <div className="flex gap-2">
                    <select value={newLeaderId} onChange={e => setNewLeaderId(e.target.value)} className="flex-1 bg-black/40 text-xs border border-white/10 rounded-lg p-2 outline-none">
                      <option value="">Select Member...</option>
                      {teamMembers.filter(m => m.id !== teamMembers[0]?.id).map(m => <option key={m.id} value={m.id}>{m.username}</option>)}
                    </select>
                    <button type="button" onClick={() => openModal('transfer')} className="bg-yellow-600/20 text-yellow-500 p-2 rounded-lg hover:bg-yellow-600/30"><Crown className="w-4 h-4" /></button>
                  </div>
                </div>

                <button type="button" onClick={() => openModal('complete')} className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold rounded-xl transition-colors">Mark Project as Complete</button>
                <button type="button" onClick={() => openModal('delete')} className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2"><Trash2 className="w-3 h-3" /> Delete Project</button>
              </div>
            </div>

          </div>
        </div>

        <AnimatePresence>
          {modalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setModalOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-[#1A1A1A] border border-white/10 p-8 rounded-2xl w-full max-w-sm shadow-2xl">
                <h3 className="text-xl font-bold text-white mb-2">{modalConfig?.title}</h3>
                <p className="text-gray-400 text-sm mb-6">Are you sure? This action cannot be undone.</p>
                <div className="flex justify-end gap-3">
                  <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white text-sm">Cancel</button>
                  <button onClick={() => { modalConfig?.action(); setModalOpen(false); }} className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-lg shadow-lg shadow-red-900/20">Confirm</button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}