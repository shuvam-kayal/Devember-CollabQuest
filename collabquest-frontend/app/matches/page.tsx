"use client";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Cookies from "js-cookie";
import api from "@/lib/api";
import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
import { ShieldCheck, Loader2, X, Check, ArrowLeft, ArrowRight, Code2 } from "lucide-react";

export default function SwipeMatchPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const mode = searchParams.get("type") === "users" ? "users" : "projects";
    // --- NEW: Capture Project Context ---
    const projectId = searchParams.get("projectId");

    const [candidates, setCandidates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);

    const x = useMotionValue(0);
    const rotate = useTransform(x, [-200, 200], [-15, 15]);
    const opacityLike = useTransform(x, [50, 150], [0, 1]);
    const opacityNope = useTransform(x, [-50, -150], [0, 1]);

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
            let endpoint = mode === "users"
                ? "/matches/users"
                : "/matches/projects";

            // --- NEW: Add Project Filter param ---
            if (mode === "users" && projectId) {
                endpoint += `?project_id=${projectId}`;
            }

            const res = await api.get(endpoint);

            const highQualityMatches = res.data.filter((c: any) => c.match_score > 0);
            setCandidates(highQualityMatches);
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
        const token = Cookies.get("token");
        const safeTargetId = getSafeId(item);

        api.post("/matches/swipe", {
            target_id: safeTargetId,
            direction: direction,
            type: mode === "users" ? "user" : "project",
            related_id: projectId // --- NEW: Send context ---
        }).then(res => {
            if (res.data.is_match) {
                alert(`IT'S A MATCH! 🎉\nYou matched with ${item.username || item.name}.`);
            } else if (direction === 'right' && mode === 'users') {
                // Optional: User Feedback
                // alert("Invite sent!"); 
            }
        }).catch(err => {
            console.error("Swipe failed", err);
        });

        setTimeout(() => {
            setCurrentIndex(prev => prev + 1);
            x.set(0);
        }, 200);
    };

    // Helper for React Keys
    const getSafeKey = (item: any, index: number) => {
        return getSafeId(item) || `card-${index}`;
    };

    if (loading) return <div className="h-screen flex items-center justify-center bg-gray-950 text-white"><Loader2 className="animate-spin w-10 h-10 text-purple-500" /></div>;

    return (
        <div className="h-screen bg-gray-950 text-white flex flex-col items-center justify-center overflow-hidden relative">

            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(76,29,149,0.1),rgba(0,0,0,0))]" />

            <div className="absolute top-10 text-center z-10">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent mb-2">
                    {mode === "users" ? "Recruit Teammates" : "Find Projects"}
                </h1>
                {projectId && <span className="bg-purple-900/50 px-3 py-1 rounded-full text-xs text-purple-300 border border-purple-500/30">Recruiting for specific project</span>}
                <p className="text-gray-500 text-sm mt-2">
                    {mode === "users" ? "Swipe right to invite" : "Swipe right to apply"}
                </p>
            </div>

            <div className="relative w-full max-w-md h-[600px] flex items-center justify-center">

                {currentIndex >= candidates.length && (
                    <div className="text-center p-10">
                        <div className="bg-gray-900/50 p-6 rounded-full inline-block mb-4">
                            <ShieldCheck className="w-12 h-12 text-gray-600" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-300">No more matches!</h3>
                        <p className="text-gray-500 mt-2 mb-6">Try updating your skills profile.</p>
                        <button
                            onClick={() => router.push("/dashboard")}
                            className="bg-white text-black px-6 py-3 rounded-full font-bold hover:bg-gray-200 transition"
                        >
                            Back to Dashboard
                        </button>
                    </div>
                )}

                <AnimatePresence>
                    {candidates.slice(currentIndex, currentIndex + 2).reverse().map((item, i) => {
                        const uniqueKey = getSafeKey(item, currentIndex + i);
                        const isTop = i === 1;
                        if (candidates.length - currentIndex === 1 && i === 0) return <SwipeCard key={uniqueKey} item={item} mode={mode} isTop={true} x={x} rotate={rotate} opacityLike={opacityLike} opacityNope={opacityNope} onSwipe={swipe} />;
                        if (!isTop) return <SwipeCard key={uniqueKey} item={item} mode={mode} isTop={false} />;
                        return <SwipeCard key={uniqueKey} item={item} mode={mode} isTop={true} x={x} rotate={rotate} opacityLike={opacityLike} opacityNope={opacityNope} onSwipe={swipe} />;
                    })}
                </AnimatePresence>
            </div>

            {currentIndex < candidates.length && (
                <div className="flex gap-6 mt-8 z-10">
                    <button onClick={() => swipe("left")} className="p-4 bg-gray-900 rounded-full border border-gray-800 text-red-500 hover:bg-red-500/10 hover:border-red-500 hover:scale-110 transition-all shadow-lg">
                        <X className="w-8 h-8" />
                    </button>
                    <button onClick={() => swipe("right")} className="p-4 bg-gray-900 rounded-full border border-gray-800 text-green-500 hover:bg-green-500/10 hover:border-green-500 hover:scale-110 transition-all shadow-lg">
                        <Check className="w-8 h-8" />
                    </button>
                </div>
            )}

            <div className="absolute bottom-10 text-gray-600 text-xs font-mono">
                Use Arrow Keys <ArrowLeft className="inline w-3 h-3" /> <ArrowRight className="inline w-3 h-3" /> to Swipe
            </div>
        </div>
    );
}

function SwipeCard({ item, mode, isTop, x, rotate, opacityLike, opacityNope, onSwipe }: any) {
    return (
        <motion.div
            style={isTop ? { x, rotate, zIndex: 10 } : { scale: 0.95, y: 10, zIndex: 5, opacity: 0.5 }}
            drag={isTop ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            onDragEnd={(e, info) => {
                if (info.offset.x > 100) onSwipe("right");
                else if (info.offset.x < -100) onSwipe("left");
            }}
            className="absolute w-full max-w-sm bg-gray-900 border border-gray-800 rounded-3xl overflow-hidden shadow-2xl cursor-grab active:cursor-grabbing"
        >
            {isTop && (
                <>
                    <motion.div style={{ opacity: opacityLike }} className="absolute top-10 left-10 z-20 border-4 border-green-500 text-green-500 font-bold text-4xl px-4 py-2 rounded-xl -rotate-12 bg-black/50">
                        INTERESTED
                    </motion.div>
                    <motion.div style={{ opacity: opacityNope }} className="absolute top-10 right-10 z-20 border-4 border-red-500 text-red-500 font-bold text-4xl px-4 py-2 rounded-xl rotate-12 bg-black/50">
                        PASS
                    </motion.div>
                </>
            )}

            <div className="h-[500px] flex flex-col">
                <div className="h-32 bg-gradient-to-b from-purple-900/50 to-gray-900 flex items-center justify-center relative">
                    <div className="absolute -bottom-10 border-4 border-gray-900 rounded-full bg-black p-1">
                        {mode === "users" ? (
                            <img src={item.avatar_url || "https://github.com/shadcn.png"} className="w-20 h-20 rounded-full" />
                        ) : (
                            <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center">
                                <Code2 className="w-10 h-10 text-purple-400" />
                            </div>
                        )}
                    </div>
                </div>

                <div className="pt-12 px-8 pb-8 flex-1 flex flex-col text-center">
                    <h2 className="text-2xl font-bold mb-1">
                        {mode === "users" ? item.username : item.name}
                    </h2>
                    <p className="text-sm text-gray-400 mb-4 line-clamp-3">
                        {mode === "users" ? "Verified Hacker" : item.description}
                    </p>

                    <div className="flex justify-center gap-4 mb-6">
                        <div className="bg-gray-800/50 px-4 py-2 rounded-lg border border-gray-800">
                            <span className="block text-green-400 font-bold text-lg">{item.match_score}%</span>
                            <span className="text-[10px] text-gray-500 uppercase tracking-wider">Match</span>
                        </div>
                        {mode === "users" && (
                            <div className="bg-gray-800/50 px-4 py-2 rounded-lg border border-gray-800">
                                <span className="block text-yellow-400 font-bold text-lg">{item.trust_score}</span>
                                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Trust</span>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-wrap justify-center gap-2 mt-auto">
                        {(mode === "users" ? item.skills : item.needed_skills)?.slice(0, 5).map((skill: any, i: number) => (
                            <span key={i} className="text-xs bg-gray-800 px-3 py-1 rounded-full text-gray-300 border border-gray-700">
                                {typeof skill === "string" ? skill : skill.name}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}