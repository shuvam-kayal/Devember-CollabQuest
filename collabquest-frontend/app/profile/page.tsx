"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import axios from "axios";
import { motion } from "framer-motion";
import { 
    Save, ArrowLeft, Clock, Calendar, Code2, 
    Heart, User, Plus, X, Trash2 
} from "lucide-react";
import Link from "next/link";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const PRESET_SKILLS = ["React", "Python", "Node.js", "TypeScript", "Next.js", "Tailwind", "MongoDB", "Firebase", "Flutter", "Java", "C++", "Rust", "Go", "Figma", "UI/UX", "AI/ML", "Docker", "AWS", "Solidity"];

interface TimeRange {
    start: string;
    end: string;
}

interface DayAvailability {
    day: string;
    enabled: boolean;
    slots: TimeRange[];
}

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [about, setAbout] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [availability, setAvailability] = useState<DayAvailability[]>(
      DAYS.map(d => ({ day: d, enabled: false, slots: [{start: "09:00", end: "17:00"}] }))
  );
  
  // Input State
  const [skillInput, setSkillInput] = useState("");
  const [interestInput, setInterestInput] = useState("");

  useEffect(() => {
      const token = Cookies.get("token");
      if (!token) return router.push("/");
      
      axios.get("http://localhost:8000/users/me", { headers: { Authorization: `Bearer ${token}` } })
           .then(res => {
               const u = res.data;
               setAbout(u.about || "");
               setSkills(u.skills.map((s: any) => s.name));
               setInterests(u.interests || []);
               
               // Merge saved availability with default structure
               if (u.availability && u.availability.length > 0) {
                   const merged = DAYS.map(day => {
                       const saved = u.availability.find((d: any) => d.day === day);
                       return saved || { day, enabled: false, slots: [{start: "09:00", end: "17:00"}] };
                   });
                   setAvailability(merged);
               }
           })
           .catch(() => alert("Failed to load profile"))
           .finally(() => setLoading(false));
  }, []);

  const saveProfile = async () => {
      const token = Cookies.get("token");
      try {
          await axios.put("http://localhost:8000/users/profile", {
              about,
              skills,
              interests,
              availability
          }, { headers: { Authorization: `Bearer ${token}` } });
          
          alert("Profile Saved!");
          router.push("/dashboard");
      } catch (err) { alert("Save failed"); }
  };

  // --- HANDLERS ---
  const toggleDay = (index: number) => {
      const newAvail = [...availability];
      newAvail[index].enabled = !newAvail[index].enabled;
      setAvailability(newAvail);
  };

  const addSlot = (dayIndex: number) => {
      const newAvail = [...availability];
      newAvail[dayIndex].slots.push({ start: "09:00", end: "12:00" });
      setAvailability(newAvail);
  };

  const removeSlot = (dayIndex: number, slotIndex: number) => {
      const newAvail = [...availability];
      newAvail[dayIndex].slots = newAvail[dayIndex].slots.filter((_, i) => i !== slotIndex);
      setAvailability(newAvail);
  };

  const updateSlot = (dayIndex: number, slotIndex: number, field: 'start'|'end', value: string) => {
      const newAvail = [...availability];
      newAvail[dayIndex].slots[slotIndex][field] = value;
      setAvailability(newAvail);
  };

  const addTag = (list: string[], setList: any, value: string, setValue: any) => {
      if (value && !list.includes(value)) {
          setList([...list, value]);
          setValue("");
      }
  };

  const removeTag = (list: string[], setList: any, tag: string) => {
      setList(list.filter(t => t !== tag));
  };

  if (loading) return <div className="h-screen bg-black text-white flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
                <Link href="/dashboard" className="p-2 bg-gray-800 rounded-full hover:bg-gray-700">
                    <ArrowLeft className="w-5 h-5"/>
                </Link>
                <h1 className="text-3xl font-bold">Edit Profile</h1>
            </div>
            <button onClick={saveProfile} className="bg-green-600 hover:bg-green-500 px-6 py-2 rounded-full font-bold flex items-center gap-2">
                <Save className="w-4 h-4"/> Save Changes
            </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* LEFT COLUMN: ABOUT & TAGS */}
            <div className="md:col-span-1 space-y-6">
                
                {/* About Section */}
                <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
                    <h3 className="font-bold flex items-center gap-2 mb-4 text-purple-400"><User className="w-4 h-4"/> About Me</h3>
                    <textarea 
                        className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 h-32 text-sm outline-none focus:border-purple-500 resize-none"
                        placeholder="Tell us about yourself..."
                        value={about}
                        onChange={e => setAbout(e.target.value)}
                    />
                </div>

                {/* Skills Section */}
                <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
                    <h3 className="font-bold flex items-center gap-2 mb-4 text-blue-400"><Code2 className="w-4 h-4"/> Skills</h3>
                    <div className="flex flex-wrap gap-2 mb-3">
                        {skills.map(s => (
                            <span key={s} className="text-xs bg-blue-900/30 text-blue-200 px-2 py-1 rounded flex items-center gap-1 border border-blue-500/30">
                                {s} <button onClick={() => removeTag(skills, setSkills, s)}><X className="w-3 h-3 hover:text-white"/></button>
                            </span>
                        ))}
                    </div>
                    <div className="relative">
                        <select 
                            className="w-full bg-gray-950 border border-gray-700 rounded-lg p-2 text-sm outline-none"
                            value={skillInput}
                            onChange={e => addTag(skills, setSkills, e.target.value, setSkillInput)}
                        >
                            <option value="" disabled>+ Add Skill</option>
                            {PRESET_SKILLS.filter(s => !skills.includes(s)).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                </div>

                {/* Interests Section */}
                <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
                    <h3 className="font-bold flex items-center gap-2 mb-4 text-pink-400"><Heart className="w-4 h-4"/> Interests</h3>
                    <div className="flex flex-wrap gap-2 mb-3">
                        {interests.map(i => (
                            <span key={i} className="text-xs bg-pink-900/30 text-pink-200 px-2 py-1 rounded flex items-center gap-1 border border-pink-500/30">
                                {i} <button onClick={() => removeTag(interests, setInterests, i)}><X className="w-3 h-3 hover:text-white"/></button>
                            </span>
                        ))}
                    </div>
                    <div className="relative">
                        <input 
                            className="w-full bg-gray-950 border border-gray-700 rounded-lg p-2 text-sm outline-none focus:border-pink-500"
                            placeholder="Type & Enter..."
                            value={interestInput}
                            onChange={e => setInterestInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addTag(interests, setInterests, interestInput, setInterestInput)}
                        />
                        <Plus className="w-4 h-4 text-gray-500 absolute right-2 top-2"/>
                    </div>
                </div>

            </div>

            {/* RIGHT COLUMN: AVAILABILITY */}
            <div className="md:col-span-2">
                <div className="bg-gray-900 border border-gray-800 p-8 rounded-3xl">
                    <h3 className="font-bold flex items-center gap-2 mb-6 text-green-400 text-xl"><Calendar className="w-5 h-5"/> Weekly Availability</h3>
                    
                    <div className="space-y-4">
                        {availability.map((dayData, index) => (
                            <div key={dayData.day} className={`p-4 rounded-xl border transition-all ${dayData.enabled ? "bg-gray-800/50 border-green-500/30" : "bg-gray-950 border-gray-800 opacity-60"}`}>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                        <input 
                                            type="checkbox" 
                                            checked={dayData.enabled} 
                                            onChange={() => toggleDay(index)}
                                            className="w-5 h-5 accent-green-500 rounded cursor-pointer"
                                        />
                                        <span className={`font-bold ${dayData.enabled ? "text-white" : "text-gray-500"}`}>{dayData.day}</span>
                                    </div>
                                    {dayData.enabled && (
                                        <button onClick={() => addSlot(index)} className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded flex items-center gap-1">
                                            <Plus className="w-3 h-3"/> Add Slot
                                        </button>
                                    )}
                                </div>

                                {dayData.enabled && (
                                    <div className="space-y-2 pl-8">
                                        {dayData.slots.map((slot, sIndex) => (
                                            <div key={sIndex} className="flex items-center gap-2">
                                                <Clock className="w-4 h-4 text-gray-500"/>
                                                <input 
                                                    type="time" 
                                                    value={slot.start} 
                                                    onChange={e => updateSlot(index, sIndex, 'start', e.target.value)}
                                                    className="bg-gray-950 border border-gray-700 rounded px-2 py-1 text-sm outline-none focus:border-green-500"
                                                />
                                                <span className="text-gray-500">-</span>
                                                <input 
                                                    type="time" 
                                                    value={slot.end} 
                                                    onChange={e => updateSlot(index, sIndex, 'end', e.target.value)}
                                                    className="bg-gray-950 border border-gray-700 rounded px-2 py-1 text-sm outline-none focus:border-green-500"
                                                />
                                                <button onClick={() => removeSlot(index, sIndex)} className="text-gray-500 hover:text-red-500 ml-2">
                                                    <Trash2 className="w-4 h-4"/>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

        </div>
      </div>
    </div>
  );
}