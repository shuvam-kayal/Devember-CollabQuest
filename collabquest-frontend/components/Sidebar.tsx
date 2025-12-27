"use client";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Cookies from "js-cookie";
import api from "@/lib/api";
import { 
  Code2, LayoutDashboard, Users, Briefcase, Star, Clock, 
  ChevronLeft, ChevronRight, Settings 
} from "lucide-react";


// Helper Component for Links
const SidebarLink = ({ icon: Icon, label, active, onClick, isCollapsed, id }: any) => (
    <div
        id={id}
        onClick={onClick}
        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all mb-1
      ${active ? "bg-purple-600/10 text-purple-400 border border-purple-500/20" : "text-gray-400 hover:bg-white/5 hover:text-white"}`}
    >
        <Icon className="w-5 h-5 min-w-[20px]" />
        {!isCollapsed && <span className="text-sm font-medium whitespace-nowrap">{label}</span>}
    </div>
);

// Accept props from MainLayout
interface SidebarProps {
    isCollapsed: boolean;
    setIsCollapsed: (val: boolean) => void;
}

export default function Sidebar({ isCollapsed, setIsCollapsed }: SidebarProps) {
    const [user, setUser] = useState<any>(null);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const token = Cookies.get("token");
                if(token) {
                    const res = await api.get("/users/me");
                    setUser(res.data);
                }
            } catch (e) { console.error("Sidebar user fetch failed", e); }
        };
        fetchUser();
    }, []);

    if (!user) return null; 

    return (
        <aside className={`${isCollapsed ? "w-20" : "w-64"} transition-all duration-300 fixed h-screen border-r border-white/5 bg-[#0F0F0F] flex flex-col z-50`}>
            <div className="p-6 flex items-center justify-between">
                {!isCollapsed && <h1 className="text-xl font-black tracking-tighter bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">COLLABQUEST</h1>}
                <button onClick={() => setIsCollapsed(!isCollapsed)} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 transition-colors">
                    {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                </button>
            </div>

            <nav className="flex-1 px-4 space-y-2 overflow-hidden">
                <SidebarLink icon={LayoutDashboard} label="Dashboard" isCollapsed={isCollapsed} active={pathname === "/dashboard"} onClick={() => router.push("/dashboard")} />
                <SidebarLink icon={Users} label="Projects" isCollapsed={isCollapsed} active={pathname === "/find-team"} id="onboarding-find-team" onClick={() => router.push("/find-team")} />
                
                {!isCollapsed && <p className="text-[10px] text-gray-500 uppercase px-2 pt-4 mb-2 font-bold tracking-widest">Personal</p>}
                
                {/* --- MODIFIED SECTION START --- */}
                <SidebarLink 
                    icon={Code2} 
                    label="My Projects" 
                    isCollapsed={isCollapsed} 
                    // Checks if current path starts with /myproject
                    active={pathname.startsWith("/myproject")} 
                    // Pushes to the route that renders myproject/page.tsx
                    onClick={() => router.push("/myproject")}
                    id="onboarding-projects"
                />
                {/* --- MODIFIED SECTION END --- */}

                <SidebarLink icon={Star} label="Saved" isCollapsed={isCollapsed} active={pathname.includes("saved")} onClick={() => router.push("/saved")} id="onboarding-saved" />
                <SidebarLink icon={Clock} label="History" isCollapsed={isCollapsed} active={pathname.includes("history")} onClick={() => router.push("/history")} id="onboarding-history" />
            </nav>

            <div onClick={() => router.push("/profile")} className="p-4 border-t border-white/5 bg-black/20 cursor-pointer hover:bg-white/5 transition-all">
                <div className="flex items-center gap-3">
                    <img src={user.avatar_url || "https://github.com/shadcn.png"} className="w-9 h-9 rounded-lg border border-purple-500/50 object-cover shrink-0" />
                    {!isCollapsed && (
                        <div className="flex-1 overflow-hidden">
                            <p className="text-sm font-bold truncate">{user.username}</p>
                            <p className="text-[10px] text-green-400 font-mono">TRUST {user.trust_score?.toFixed(1) || "N/A"}</p>
                        </div>
                    )}
                    {!isCollapsed && <Settings className="w-4 h-4 text-gray-500" />}
                </div>
            </div>
        </aside>
    );
}