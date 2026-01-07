"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import api from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { 
    Loader2, Star, Trash2, ExternalLink, 
    ArrowRight, Layout, Search, BookmarkMinus 
} from "lucide-react";
import Link from "next/link";
import GlobalHeader from "@/components/GlobalHeader";

// --- INTERFACES ---
interface Team {
    _id: string;
    id?: string;
    name: string;
    description: string;
    tags?: string[]; 
    status?: string;
    members?: string[];
}

export default function SavedProjectsClient() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [favorites, setFavorites] = useState<Team[]>([]);
    const [removingId, setRemovingId] = useState<string | null>(null);

    useEffect(() => {
        const token = Cookies.get("token");
        if (!token) {
            router.push("/login");
            return;
        }
        fetchFavorites();
    }, []);

    // --- 1. MOUSE STATE FOR GLOW ---
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

    // --- 2. MOUSE EFFECT HOOK ---
    useEffect(() => {
        const updateMousePosition = (ev: MouseEvent) => {
        setMousePosition({ x: ev.clientX, y: ev.clientY });
        };
        window.addEventListener("mousemove", updateMousePosition);
        return () => {
        window.removeEventListener("mousemove", updateMousePosition);
        };
    }, []);

    const fetchFavorites = async () => {
        try {
            const res = await api.get("/users/me/favorites_details");
            setFavorites(res.data);
        } catch (e) {
            console.error("Failed to fetch favorites", e);
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveFavorite = async (e: React.MouseEvent, teamId: string) => {
        e.preventDefault(); 
        e.stopPropagation();

        if(!confirm("Remove this project from your saved list?")) return;

        setRemovingId(teamId);
        
        try {
            setFavorites(prev => prev.filter(t => (t._id || t.id) !== teamId));
            await api.post(`/teams/${teamId}/favorite`); 
        } catch (err) {
            alert("Failed to remove favorite");
            fetchFavorites(); 
        } finally {
            setRemovingId(null);
        }
    };

    if (loading) return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
            <Loader2 className="animate-spin w-8 h-8 text-yellow-500" />
        </div>
    );

    return (
        <div className="min-h-screen w-full bg-transparent text-zinc-100 font-sans selection:bg-purple-500/30 relative overflow-hidden">
            <div 
                className="pointer-events-none fixed inset-0 z-30 transition-opacity duration-300"
                style={{
                background: `radial-gradient(800px at ${mousePosition.x}px ${mousePosition.y}px, rgba(168, 85, 247, 0.1), transparent 80%)`,
                }}
            />
            <div className="max-w-6xl mx-auto p-8 pt-12">
                
                {/* Header Section */}
                <div className="mb-8 border-b border-gray-800 pb-6">
                    <h1 className="text-3xl font-black bg-gradient-to-r from-yellow-200 to-yellow-600 bg-clip-text text-transparent flex items-center gap-3">
                        <Star className="w-8 h-8 text-yellow-500 fill-yellow-500" /> 
                        Saved Projects
                    </h1>
                    <p className="text-gray-400 mt-2">
                        Your curated list of interesting projects. Keep an eye on them or join when ready.
                    </p>
                </div>

                {/* Content Section */}
                {favorites.length === 0 ? (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }} 
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col items-center justify-center py-24 bg-gray-900/30 border border-gray-800 rounded-3xl text-center dashed-border"
                    >
                        <div className="bg-gray-800 p-6 rounded-full mb-6 relative">
                            <Star className="w-10 h-10 text-gray-600" />
                            <div className="absolute -top-1 -right-1">
                                <Search className="w-6 h-6 text-yellow-500 animate-bounce" />
                            </div>
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2">No Saved Projects Yet</h3>
                        <p className="text-gray-500 mb-8 max-w-md">
                            Browse the project feed and click the star icon to save projects you want to revisit later.
                        </p>
                        <Link href="/find-team">
                            <button className="px-8 py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition shadow-lg flex items-center gap-2">
                                <Layout className="w-4 h-4" /> Explore Projects
                            </button>
                        </Link>
                    </motion.div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <AnimatePresence>
                            {favorites.map((team, index) => (
                                <motion.div
                                    key={team._id || team.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    transition={{ duration: 0.2, delay: index * 0.05 }}
                                >
                                    <Link href={`/teams/${team._id || team.id}`}>
                                        <div className="group h-full bg-gray-900 border border-gray-800 p-6 rounded-2xl hover:border-yellow-500/50 hover:shadow-xl hover:shadow-yellow-900/10 transition-all duration-300 relative flex flex-col">
                                            
                                            {/* Top Actions */}
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="p-3 bg-gray-800 rounded-lg border border-gray-700 group-hover:border-yellow-500/30 transition">
                                                    <Layout className="w-6 h-6 text-gray-400 group-hover:text-yellow-500 transition" />
                                                </div>
                                                <button 
                                                    onClick={(e) => handleRemoveFavorite(e, team._id || team.id!)}
                                                    disabled={removingId === (team._id || team.id)}
                                                    className="p-2 rounded-lg text-gray-500 hover:bg-red-900/20 hover:text-red-400 transition"
                                                    title="Remove from Saved"
                                                >
                                                    {removingId === (team._id || team.id) ? (
                                                        <Loader2 className="w-5 h-5 animate-spin" />
                                                    ) : (
                                                        <BookmarkMinus className="w-5 h-5" />
                                                    )}
                                                </button>
                                            </div>

                                            {/* Content */}
                                            <h4 className="text-lg font-bold text-white mb-2 line-clamp-1 group-hover:text-yellow-400 transition">
                                                {team.name}
                                            </h4>
                                            
                                            <p className="text-sm text-gray-400 line-clamp-3 mb-6 flex-grow leading-relaxed">
                                                {team.description}
                                            </p>

                                            {/* Footer Info */}
                                            <div className="mt-auto pt-4 border-t border-gray-800 flex items-center justify-between text-xs text-gray-500">
                                                <span className="flex items-center gap-1.5">
                                                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                                    Active
                                                </span>
                                                <span className="flex items-center gap-1 group-hover:translate-x-1 transition text-white">
                                                    View Details <ArrowRight className="w-3 h-3" />
                                                </span>
                                            </div>

                                            {/* Decorative Corner */}
                                            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-yellow-500/10 to-transparent rounded-tr-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                                        </div>
                                    </Link>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    );
}