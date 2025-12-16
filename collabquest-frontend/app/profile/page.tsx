"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { Save, ArrowLeft, Clock, Calendar, Code2, Heart, User, Plus, X, Trash2, Zap, CheckCircle, AlertTriangle } from "lucide-react";
import Link from "next/link";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const PRESET_SKILLS = ["React", "Python", "Node.js", "TypeScript", "Next.js", "Tailwind", "MongoDB", "Firebase"];

// ... (Keep TimeRange, DayAvailability interfaces) ...
interface TimeRange { start: string; end: string; }
interface DayAvailability { day: string; enabled: boolean; slots: TimeRange[]; }

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  
  // Profile State
  const [about, setAbout] = useState("");
  const [skills, setSkills] = useState<{name: string, level: string}[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [availability, setAvailability] = useState<DayAvailability[]>(
      DAYS.map(d => ({ day: d, enabled: false, slots: [{start: "09:00", end: "17:00"}] }))
  );
  
  // Quiz State
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizSkill, setQuizSkill] = useState("");
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [userAnswers, setUserAnswers] = useState<{id: string, selected: number}[]>([]);
  const [timer, setTimer] = useState(30);
  const [quizResult, setQuizResult] = useState<any>(null);
  
  // Inputs
  const [dropdownValue, setDropdownValue] = useState("");
  const [interestInput, setInterestInput] = useState("");

  useEffect(() => {
      const token = Cookies.get("token");
      if (!token) return router.push("/");
      
      axios.get("http://localhost:8000/users/me", { headers: { Authorization: `Bearer ${token}` } })
           .then(res => {
               const u = res.data;
               setAbout(u.about || "");
               setSkills(u.skills || []);
               setInterests(u.interests || []);
               if (u.availability && u.availability.length > 0) setAvailability(u.availability);
           })
           .finally(() => setLoading(false));
  }, []);

  // --- QUIZ LOGIC ---
  const startSkillTest = async (skill: string) => {
      // 1. Confirm
      if (!confirm(`Take a rapid-fire test to verify ${skill}?`)) return;
      
      setQuizSkill(skill);
      setLoading(true);
      
      try {
          const token = Cookies.get("token");
          const res = await axios.get(`http://localhost:8000/skills/start/${skill}`, { headers: { Authorization: `Bearer ${token}` } });
          setQuestions(res.data.questions);
          setShowQuiz(true);
          setCurrentQ(0);
          setUserAnswers([]);
          setQuizResult(null);
          setTimer(15); // 15 seconds per question
      } catch (err) {
          alert("Could not load test. Ensure backend has questions.");
      } finally {
          setLoading(false);
      }
  };

  // Timer Effect
  useEffect(() => {
      if (!showQuiz || quizResult) return;
      if (timer > 0) {
          const t = setTimeout(() => setTimer(timer - 1), 1000);
          return () => clearTimeout(t);
      } else {
          // Time up! Next question
          handleAnswer(-1); // -1 means skipped
      }
  }, [timer, showQuiz, quizResult]);

  const handleAnswer = (optionIndex: number) => {
      const newAns = [...userAnswers, { id: questions[currentQ].id, selected: optionIndex }];
      setUserAnswers(newAns);
      
      if (currentQ < questions.length - 1) {
          setCurrentQ(currentQ + 1);
          setTimer(15); // Reset timer
      } else {
          submitQuiz(newAns);
      }
  };

  const submitQuiz = async (answers: any[]) => {
      const token = Cookies.get("token");
      try {
          const res = await axios.post(`http://localhost:8000/skills/submit/${quizSkill}`, answers, { headers: { Authorization: `Bearer ${token}` } });
          setQuizResult(res.data);
          // If passed, update local state
          if (res.data.passed) {
              setSkills([...skills, { name: quizSkill, level: res.data.level }]);
          }
      } catch (err) { alert("Submission failed"); setShowQuiz(false); }
  };

  // ... (Keep saveProfile, toggleDay, addSlot, removeSlot, updateSlot, addTag, removeTag) ...
  const saveProfile = async () => {
      const token = Cookies.get("token");
      try {
          // Flatten skills to just names for the profile update endpoint if it expects strings
          // Or update profile endpoint to accept objects.
          // FIX: Our `update_profile` expects `skills: List[str]`. 
          // But we want to keep the Levels! 
          // Let's assume `update_profile` was just a metadata update and skills are handled separately via tests now.
          // BUT, to keep it simple, let's just save metadata here.
          
          await axios.put("http://localhost:8000/users/profile", {
              about,
              interests,
              availability,
              skills: skills.map(s => s.name) // Legacy compatibility
          }, { headers: { Authorization: `Bearer ${token}` } });
          
          alert("Profile Saved!");
      } catch (err) { alert("Save failed"); }
  };
  const removeSkill = (name: string) => setSkills(skills.filter(s => s.name !== name));
  const removeTag = (list: string[], setList: any, tag: string) => setList(list.filter(t => t !== tag));
  const addInterest = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && interestInput) { if(!interests.includes(interestInput)) setInterests([...interests, interestInput]); setInterestInput(""); } };
  
  // Availability Helpers (Shortened for brevity - paste your previous logic here)
  const toggleDay = (i: number) => { const n=[...availability]; n[i].enabled=!n[i].enabled; setAvailability(n); };
  const addSlot = (i: number) => { const n=[...availability]; n[i].slots.push({start:"09:00",end:"12:00"}); setAvailability(n); };
  const removeSlot = (d: number, s: number) => { const n=[...availability]; n[d].slots = n[d].slots.filter((_, idx)=>idx!==s); setAvailability(n); };
  const updateSlot = (d: number, s: number, f: 'start'|'end', v: string) => { const n=[...availability]; n[d].slots[s][f]=v; setAvailability(n); };


  if (loading) return <div className="h-screen bg-black text-white flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
                <Link href="/dashboard" className="p-2 bg-gray-800 rounded-full hover:bg-gray-700"><ArrowLeft/></Link>
                <h1 className="text-3xl font-bold">Edit Profile</h1>
            </div>
            <button onClick={saveProfile} className="bg-green-600 px-6 py-2 rounded-full font-bold flex gap-2"><Save className="w-4 h-4"/> Save Changes</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-1 space-y-6">
                <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
                    <h3 className="font-bold mb-4 text-purple-400 flex gap-2"><User className="w-4 h-4"/> About</h3>
                    <textarea className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 h-32 text-sm outline-none focus:border-purple-500 resize-none" value={about} onChange={e => setAbout(e.target.value)}/>
                </div>
                
                {/* SKILLS SECTION */}
                <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
                    <h3 className="font-bold mb-4 text-blue-400 flex gap-2"><Code2 className="w-4 h-4"/> Skills</h3>
                    <div className="flex flex-wrap gap-2 mb-3">
                        {skills.map(s => (
                            <span key={s.name} className="text-xs bg-blue-900/30 text-blue-200 px-2 py-1 rounded flex items-center gap-1 border border-blue-500/30">
                                {s.name} <span className="text-[9px] uppercase opacity-70">({s.level})</span>
                                <button onClick={() => removeSkill(s.name)}><X className="w-3 h-3 hover:text-white"/></button>
                            </span>
                        ))}
                    </div>
                    <div className="relative">
                        <select className="w-full bg-gray-950 border border-gray-700 rounded-lg p-2 text-sm outline-none" 
                            value={dropdownValue} 
                            onChange={e => {
                                startSkillTest(e.target.value); 
                                setDropdownValue("");
                            }}>
                            <option value="" disabled>+ Add & Verify</option>
                            {PRESET_SKILLS.filter(s => !skills.find(sk => sk.name === s)).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                </div>

                <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
                    <h3 className="font-bold mb-4 text-pink-400 flex gap-2"><Heart className="w-4 h-4"/> Interests</h3>
                    <div className="flex flex-wrap gap-2 mb-3">
                        {interests.map(i => <span key={i} className="text-xs bg-pink-900/30 text-pink-200 px-2 py-1 rounded flex items-center gap-1 border border-pink-500/30">{i} <button onClick={() => removeTag(interests, setInterests, i)}><X className="w-3 h-3"/></button></span>)}
                    </div>
                    <input className="w-full bg-gray-950 border border-gray-700 rounded-lg p-2 text-sm outline-none" placeholder="Add..." value={interestInput} onChange={e => setInterestInput(e.target.value)} onKeyDown={addInterest} />
                </div>
            </div>

            <div className="md:col-span-2">
                <div className="bg-gray-900 border border-gray-800 p-8 rounded-3xl">
                    <h3 className="font-bold flex items-center gap-2 mb-6 text-green-400 text-xl"><Calendar className="w-5 h-5"/> Weekly Availability</h3>
                    {/* (Availability Grid - Same as before) */}
                    <div className="space-y-4">
                        {availability.map((dayData, index) => (
                            <div key={dayData.day} className={`p-4 rounded-xl border transition-all ${dayData.enabled ? "bg-gray-800/50 border-green-500/30" : "bg-gray-950 border-gray-800 opacity-60"}`}>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                        <input type="checkbox" checked={dayData.enabled} onChange={() => toggleDay(index)} className="w-5 h-5 accent-green-500 rounded cursor-pointer"/>
                                        <span className={`font-bold ${dayData.enabled ? "text-white" : "text-gray-500"}`}>{dayData.day}</span>
                                    </div>
                                    {dayData.enabled && <button onClick={() => addSlot(index)} className="text-xs bg-gray-700 px-2 py-1 rounded"><Plus className="w-3 h-3"/></button>}
                                </div>
                                {dayData.enabled && dayData.slots.map((slot, sIndex) => (
                                    <div key={sIndex} className="flex items-center gap-2 pl-8">
                                        <Clock className="w-4 h-4 text-gray-500"/>
                                        <input type="time" value={slot.start} onChange={e => updateSlot(index, sIndex, 'start', e.target.value)} className="bg-gray-950 border border-gray-700 rounded px-2 py-1 text-sm"/>
                                        <span className="text-gray-500">-</span>
                                        <input type="time" value={slot.end} onChange={e => updateSlot(index, sIndex, 'end', e.target.value)} className="bg-gray-950 border border-gray-700 rounded px-2 py-1 text-sm"/>
                                        <button onClick={() => removeSlot(index, sIndex)}><Trash2 className="w-4 h-4 text-red-500"/></button>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* --- SKILL TEST MODAL --- */}
      <AnimatePresence>
        {showQuiz && (
            <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
                <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-gray-900 border border-gray-800 p-8 rounded-3xl w-full max-w-lg text-center relative overflow-hidden">
                    
                    {!quizResult ? (
                        <>
                            {/* Header */}
                            <div className="flex justify-between items-center mb-8">
                                <h2 className="text-xl font-bold flex items-center gap-2"><Zap className="text-yellow-400 fill-yellow-400"/> {quizSkill} Verification</h2>
                                <span className={`font-mono text-xl font-bold ${timer < 5 ? "text-red-500 animate-pulse" : "text-white"}`}>{timer}s</span>
                            </div>

                            {/* Progress Bar */}
                            <div className="w-full bg-gray-800 h-2 rounded-full mb-8 overflow-hidden">
                                <motion.div 
                                    className="h-full bg-purple-600" 
                                    initial={{ width: 0 }} 
                                    animate={{ width: `${((currentQ + 1) / questions.length) * 100}%` }}
                                />
                            </div>

                            {/* Question */}
                            <div className="mb-8 min-h-[100px]">
                                <h3 className="text-lg font-medium leading-relaxed">{questions[currentQ]?.text}</h3>
                            </div>

                            {/* Options */}
                            <div className="grid grid-cols-1 gap-3">
                                {questions[currentQ]?.options.map((opt: string, i: number) => (
                                    <button 
                                        key={i} 
                                        onClick={() => handleAnswer(i)}
                                        className="bg-gray-800 hover:bg-purple-600 p-4 rounded-xl text-left transition-all border border-gray-700 hover:border-purple-500"
                                    >
                                        <span className="font-bold text-gray-500 mr-2">{String.fromCharCode(65 + i)}.</span> {opt}
                                    </button>
                                ))}
                            </div>
                            
                            <p className="mt-6 text-gray-500 text-xs">Question {currentQ + 1} of {questions.length}</p>
                        </>
                    ) : (
                        // --- RESULTS VIEW ---
                        <div>
                            <div className="mb-6 flex justify-center">
                                {quizResult.passed ? (
                                    <div className="bg-green-500/20 p-4 rounded-full border border-green-500"><CheckCircle className="w-16 h-16 text-green-500"/></div>
                                ) : (
                                    <div className="bg-red-500/20 p-4 rounded-full border border-red-500"><AlertTriangle className="w-16 h-16 text-red-500"/></div>
                                )}
                            </div>
                            
                            <h2 className="text-3xl font-bold mb-2">{quizResult.passed ? "Verified!" : "Not Quite Yet"}</h2>
                            <p className="text-gray-400 mb-6">You scored {quizResult.percentage.toFixed(0)}%</p>
                            
                            {quizResult.passed && (
                                <div className="bg-gray-800 p-4 rounded-xl mb-6">
                                    <p className="text-sm text-gray-400 uppercase tracking-widest">Skill Level Assigned</p>
                                    <p className="text-2xl font-bold text-purple-400 mt-1">{quizResult.level}</p>
                                </div>
                            )}
                            
                            <button onClick={() => setShowQuiz(false)} className="bg-white text-black px-8 py-3 rounded-full font-bold hover:bg-gray-200">
                                {quizResult.passed ? "Awesome, Close" : "Try Again Later"}
                            </button>
                        </div>
                    )}
                </motion.div>
            </div>
        )}
      </AnimatePresence>
    </div>
  );
}