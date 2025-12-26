"use client";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Cookies from "js-cookie";
import api from "@/lib/api";
import { motion, useMotionValue, useTransform, AnimatePresence, MotionValue } from "framer-motion";
import { ShieldCheck, Loader2, X, Check, ArrowLeft, ArrowRight, Code2, Zap, Briefcase, MapPin, Sparkles } from "lucide-react";

// --- Stamp Component ---
function SwipeStamp({ type, opacity, rotate }: { type: "LIKE" | "NOPE"; opacity: MotionValue<number>; rotate: MotionValue<number> }) {
    const isLike = type === "LIKE";
    const color = isLike ? "text-green-500 border-green-500" : "text-red-500 border-red-500";
    const bg = isLike ? "bg-green-500/10" : "bg-red-500/10";
    const label = isLike ? "ACCEPT" : "REJECT";
    
    return (
        <motion.div style={{ opacity, rotate, x: isLike ? 20 : -20 }} className="absolute top-10 z-50 pointer-events-none select-none w-full flex justify-center">
            <div className={`border-[8px] ${color} ${bg} font-black text-5xl px-8 py-2 rounded-2xl tracking-widest uppercase backdrop-blur-md shadow-2xl transform scale-110`}>
                {label}
            </div>
        </motion.div>
    );
}

export default function SwipeMatchPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const mode = searchParams.get("type") === "users" ? "users" : "projects";
    const projectId = searchParams.get("projectId");

    const [candidates, setCandidates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);

    const x = useMotionValue(0);
    const rotate = useTransform(x, [-200, 200], [-25, 25]);
    const opacityLike = useTransform(x, [50, 150], [0, 1]);
    const opacityNope = useTransform(x, [-50, -150], [0, 1]);
    
    const bgGradient = useTransform(x, [-200, 0, 200], [
        "radial-gradient(circle at 0% 50%, rgba(239, 68, 68, 0.15), transparent 60%)", 
        "radial-gradient(circle at 50% 50%, rgba(124, 58, 237, 0.05), transparent 60%)", 
        "radial-gradient(circle at 100% 50%, rgba(34, 197, 94, 0.15), transparent 60%)" 
    ]);

    useEffect(() => {
        const token = Cookies.get("token");
        if (!token) return router.push("/");
        fetchMatches(token);

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowRight") swipe("right");
            if (e.key === "ArrowLeft") swipe("left");
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    const fetchMatches = async (token: string) => {
        try {
            let endpoint = mode === "users" ? "/matches/users" : "/matches/projects";
            if (mode === "users" && projectId) endpoint += `?project_id=${projectId}`;

            const res = await api.get(endpoint);
            const validMatches = res.data.filter((c: any) => c.match_score > 0);
            setCandidates(validMatches);
        } catch (err) {
            console.error("Match fetch failed", err);
        } finally {
            setLoading(false);
        }
    };

    const getSafeId = (item: any) => {
        if (typeof item.id === 'string') return item.id;
        if (typeof item._id === 'string') return item._id;
        if (item._id && typeof item._id === 'object' && item._id.$oid) return item._id.$oid;
        return String(item._id || item.id);
    }

    const swipe = async (direction: "left" | "right") => {
        if (currentIndex >= candidates.length) return;
        const item = candidates[currentIndex];
        const safeTargetId = getSafeId(item);
        const nextIndex = currentIndex + 1;
        
        api.post("/matches/swipe", {
            target_id: safeTargetId,
            direction: direction,
            type: mode === "users" ? "user" : "project",
            related_id: projectId 
        }).then(res => {
            if (res.data.is_match) {
                alert(`IT'S A MATCH! 🎉\nYou matched with ${item.username || item.name}.`);
            }
        }).catch(console.error);

        x.set(direction === "left" ? -300 : 300);
        setTimeout(() => {
            setCurrentIndex(nextIndex);
            x.set(0);
        }, 200);
    };

    const getSafeKey = (item: any, index: number) => getSafeId(item) || `card-${index}`;

    if (loading) return <div className="fixed inset-0 flex items-center justify-center bg-[#09090b] text-white"><Loader2 className="animate-spin w-12 h-12 text-violet-500" /></div>;

    return (
        <motion.div 
            style={{ background: bgGradient }}
            className="fixed inset-0 bg-[#09090b] text-white flex flex-col overflow-hidden selection:bg-violet-500/30"
        >
            {/* Side Guides */}
            <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-red-900/10 to-transparent pointer-events-none flex items-center justify-start pl-6 z-0">
                <div className="flex flex-col items-center gap-4 opacity-20">
                    <ArrowLeft className="w-10 h-10 text-red-500" />
                    <span className="text-red-500 font-bold tracking-widest text-xs uppercase -rotate-90">Reject</span>
                </div>
            </div>
            <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-green-900/10 to-transparent pointer-events-none flex items-center justify-end pr-6 z-0">
                 <div className="flex flex-col items-center gap-4 opacity-20">
                    <ArrowRight className="w-10 h-10 text-green-500" />
                    <span className="text-green-500 font-bold tracking-widest text-xs uppercase rotate-90">Accept</span>
                </div>
            </div>

            {/* HEADER */}
            <header className="flex-none h-24 flex flex-col items-center justify-center z-20 px-4 mt-5">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-2">
                    {mode === "users" ? "Recruit Talent" : "Discover Projects"}
                </h1>
                {projectId && (
                    <div className="inline-flex items-center gap-2 text-xs font-mono text-violet-300 bg-violet-950/50 px-4 py-1 rounded-full border border-violet-500/30">
                        <Briefcase className="w-3.5 h-3.5" /> Recruiting for specific project
                    </div>
                )}
            </header>

            {/* MAIN CARD STACK */}
            <main className="flex-1 relative w-full flex items-center justify-center z-10 px-4">
                {currentIndex >= candidates.length && (
                    <div className="text-center p-8 z-0 flex flex-col items-center animate-in fade-in zoom-in duration-300">
                        <div className="bg-zinc-900/80 backdrop-blur-md p-8 rounded-full mb-8 ring-1 ring-zinc-700 shadow-2xl">
                            <Sparkles className="w-16 h-16 text-violet-400" />
                        </div>
                        <h3 className="text-2xl font-bold text-zinc-100">All caught up!</h3>
                        <p className="text-zinc-500 mt-3 mb-8 max-w-xs text-base">No more matches available right now.</p>
                        <button onClick={() => router.push("/dashboard")} className="bg-white text-black px-8 py-3.5 rounded-full font-bold hover:bg-zinc-200 transition text-base shadow-lg">
                            Return to Dashboard
                        </button>
                    </div>
                )}

                <AnimatePresence>
                    {candidates.slice(currentIndex, currentIndex + 2).reverse().map((item, i) => {
                        const uniqueKey = getSafeKey(item, currentIndex + i);
                        // Calculate isTop based on reversed array logic
                        const isTop = (candidates.length - currentIndex === 1) ? (i === 0) : (i === 1);
                        
                        return (
                            <SwipeCard 
                                key={uniqueKey} // FIXED: Key passed directly here
                                item={item} 
                                mode={mode} 
                                isTop={isTop} 
                                x={x} 
                                rotate={rotate} 
                                opacityLike={opacityLike} 
                                opacityNope={opacityNope} 
                                onSwipe={swipe} 
                            />
                        );
                    })}
                </AnimatePresence>
            </main>

            {/* FOOTER */}
            <footer className="flex-none h-28 flex flex-col items-center justify-center gap-5 z-20 pb-6">
                
                {/* BIG BUTTONS */}
                {currentIndex < candidates.length && (
                    <div className="flex items-center gap-8">
                        <button onClick={() => swipe("left")} className="group flex items-center justify-center w-16 h-16 bg-[#18181b] rounded-full border border-zinc-800 text-zinc-400 hover:text-red-400 hover:border-red-500/50 hover:bg-red-950/20 transition-all shadow-xl active:scale-95">
                            <X className="w-8 h-8" />
                        </button>
                        <button onClick={() => swipe("right")} className="group flex items-center justify-center w-16 h-16 bg-[#18181b] rounded-full border border-zinc-800 text-zinc-400 hover:text-green-400 hover:border-green-500/50 hover:bg-green-950/20 transition-all shadow-xl active:scale-95">
                            <Check className="w-8 h-8" />
                        </button>
                    </div>
                )}
                
                {/* UPDATED VISIBLE LEGEND */}
                <div className="flex items-center gap-6 px-6 py-2.5 bg-black/40 rounded-full border border-white/5 backdrop-blur-md shadow-lg">
                    
                    {/* Reject Side */}
                    <div className="flex items-center gap-2 text-red-400 font-bold tracking-widest uppercase text-[10px] md:text-xs group cursor-pointer" onClick={() => swipe("left")}>
                        <div className="w-6 h-6 rounded flex items-center justify-center bg-red-500/10 border border-red-500/20 group-hover:bg-red-500/20 transition-colors">
                            <ArrowLeft className="w-3.5 h-3.5" />
                        </div>
                        <span className="group-hover:text-red-300 transition-colors">Reject</span>
                    </div>

                    {/* Divider */}
                    <div className="w-px h-4 bg-white/10"></div>

                    {/* Accept Side */}
                    <div className="flex items-center gap-2 text-green-400 font-bold tracking-widest uppercase text-[10px] md:text-xs group cursor-pointer" onClick={() => swipe("right")}>
                        <span className="group-hover:text-green-300 transition-colors">Accept</span>
                        <div className="w-6 h-6 rounded flex items-center justify-center bg-green-500/10 border border-green-500/20 group-hover:bg-green-500/20 transition-colors">
                             <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                    </div>

                </div>
            </footer>
        </motion.div>
    );
}

function SwipeCard({ item, mode, isTop, x, rotate, opacityLike, opacityNope, onSwipe }: any) {
    const skills = (mode === "users" ? item.skills : item.needed_skills) || [];

    return (
        <motion.div
            style={isTop ? { x, rotate, zIndex: 10 } : { scale: 0.95, y: 0, zIndex: 5, opacity: 0.4 }}
            drag={isTop ? true : false}
            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
            dragElastic={0.6}
            onDragEnd={(e, info) => {
                if (info.offset.x > 100) onSwipe("right");
                else if (info.offset.x < -100) onSwipe("left");
            }}
            whileTap={{ cursor: "grabbing" }}
            // Bigger Card Size
            className="absolute w-full max-w-[400px] aspect-[3/4.5] max-h-[65vh] bg-[#121214] border border-[#27272a] rounded-[2.5rem] overflow-hidden shadow-2xl cursor-grab select-none will-change-transform flex flex-col"
        >
            {isTop && (
                <>
                    <SwipeStamp type="LIKE" opacity={opacityLike} rotate={rotate} />
                    <SwipeStamp type="NOPE" opacity={opacityNope} rotate={rotate} />
                </>
            )}

            {/* Header Image Area */}
            <div className="h-[40%] bg-gradient-to-b from-violet-900/20 via-[#121214] to-[#121214] relative flex-shrink-0">
                <div className="absolute top-5 right-5 bg-zinc-900/80 backdrop-blur border border-zinc-700 px-4 py-1.5 rounded-full flex items-center gap-2 shadow-lg z-20">
                    <Zap className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    <span className="text-xs font-bold text-white tracking-wide">{item.match_score}% Match</span>
                </div>

                <div className="absolute inset-0 flex items-center justify-center pt-6">
                    <div className="relative">
                        {/* BIGGER AVATAR */}
                        <div className="w-32 h-32 rounded-full p-1.5 bg-[#121214] ring-2 ring-zinc-700 shadow-2xl">
                            {mode === "users" ? (
                                <img src={item.avatar_url || "https://github.com/shadcn.png"} alt="avatar" className="w-full h-full rounded-full object-cover bg-zinc-800" />
                            ) : (
                                <div className="w-full h-full rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700">
                                    <Code2 className="w-14 h-14 text-violet-400" />
                                </div>
                            )}
                        </div>
                        {mode === "users" && (
                            <div className="absolute bottom-2 right-2 w-7 h-7 bg-[#121214] rounded-full flex items-center justify-center">
                                <div className="w-4 h-4 bg-green-500 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.6)]"></div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Content Area */}
            {/* 1. Changed px-6 to px-4 to give text more width */}
{/* 2. Removed overflow-y-auto since you don't want scrolling */}
<div className="flex-1 px-4 pb-4 flex flex-col items-center text-center w-full">
    
    {/* Header: Reduced bottom margin (mb-1) */}
    <h2 className="text-2xl font-bold text-white leading-tight mb-1 truncate w-full">
        {mode === "users" ? item.username : item.name}
    </h2>
    
    {/* Subheader: Reduced bottom margin (mb-3) */}
    <div className="flex items-center gap-2 text-zinc-400 text-sm mb-3 font-medium">
         {mode === "users" ? <Briefcase className="w-4 h-4"/> : <Code2 className="w-4 h-4"/>}
         <span>{mode === "users" ? "Full Stack Developer" : "Open Source Project"}</span>
         {mode === "users" && (
            <>
                <span className="text-zinc-700">•</span>
                <MapPin className="w-4 h-4"/>
                <span>Remote</span>
            </>
         )}
    </div>
    
    {/* Bio: Reduced bottom margin significantly (mb-4 instead of mb-6) */}
    <p className="text-sm text-zinc-300 leading-relaxed line-clamp-3 mb-4 max-w-[98%]">
        {item.description || "No bio provided. This user prefers to let their code speak for itself."}
    </p>

    {/* Divider: Reduced margin (mb-3) */}
    <div className="w-full h-px bg-zinc-800/80 mb-3"></div>

    {/* Stats: Reduced padding inside the boxes (py-2 instead of py-3) */}
    {mode === "users" && (
        <div className="grid grid-cols-2 gap-2 w-full mb-3">
            <div className="bg-zinc-900/60 border border-zinc-800 py-2 px-3 rounded-xl flex flex-col items-center">
                <ShieldCheck className={`w-4 h-4 mb-1 ${item.trust_score >= 8 ? "text-green-400" : "text-yellow-400"}`} />
                <span className="text-base font-bold text-white">{item.trust_score}</span>
                <span className="text-[9px] uppercase text-zinc-500 font-bold tracking-wider">Trust</span>
            </div>
            <div className="bg-zinc-900/60 border border-zinc-800 py-2 px-3 rounded-xl flex flex-col items-center">
                <Code2 className="w-4 h-4 mb-1 text-blue-400" />
                <span className="text-base font-bold text-white">{skills.length}</span>
                <span className="text-[9px] uppercase text-zinc-500 font-bold tracking-wider">Skills</span>
            </div>
        </div>
    )}

    {/* Skills: Removed flex-1 to stop it from pushing other elements */}
    <div className="w-full">
        <div className="flex flex-wrap justify-center gap-1.5">
            {skills.slice(0, 8).map((skill: any, i: number) => (
                <span key={i} className="text-xs font-medium bg-[#1e1e24] text-zinc-300 px-2.5 py-1 rounded-md border border-zinc-800">
                    {typeof skill === "string" ? skill : skill.name}
                </span>
            ))}
            {skills.length > 8 && <span className="text-xs text-zinc-500 px-2 pt-1 font-medium">+{skills.length - 8}</span>}
        </div>
    </div>
</div>
        </motion.div>
    );
}