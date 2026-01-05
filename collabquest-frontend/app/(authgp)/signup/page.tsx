"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Github, ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import Cookies from "js-cookie";
import api from "@/lib/api";
import { motion } from "framer-motion";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await api.post("/auth/register/email", { email, username, password });
      const data = response.data;
      Cookies.set("token", data.token, { expires: 7 });
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.detail || "An error occurred. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-black text-white font-sans selection:bg-purple-500/30">
      
      {/* --- LEFT SIDE: BRANDING & VISUALS --- */}
      <div className="hidden lg:flex w-1/2 relative flex-col justify-center p-16 xl:p-24 border-r border-white/10 overflow-hidden bg-[#050505]">
        
        {/* 1. THE GRID PATTERN */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>
        
        {/* 2. Ambient Glows */}
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-purple-900/20 via-transparent to-blue-900/10 pointer-events-none" />
        <div className="absolute top-[-20%] left-[-20%] w-[600px] h-[600px] bg-purple-600/20 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="relative z-10 max-w-lg">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold mb-8">
              <Sparkles className="w-3 h-3" /> Start your journey
            </div>

            <h1 className="text-6xl font-black tracking-tighter mb-6 leading-[1.1] bg-gradient-to-br from-white to-gray-500 bg-clip-text text-transparent">
              Begin Your <br/><span className="text-purple-500">Quest.</span>
            </h1>
            
            <p className="text-lg text-gray-400 mb-12 leading-relaxed max-w-md">
              Join a community of thousands tracking their progress, finding teams, and mastering new skills together.
            </p>

            <div className="space-y-6">
              {[
                { title: "Personalized Dashboard", desc: "Track your projects in real-time" },
                { title: "Verified Collaboration", desc: "Connect with students from top universities" },
                { title: "Skill-based Matching", desc: "Find the perfect teammates instantly" }
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-4 group">
                  <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-[#121212] border border-white/10 flex items-center justify-center group-hover:border-purple-500/50 transition-colors">
                    <CheckCircle2 className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white group-hover:text-purple-400 transition-colors">{item.title}</h3>
                    <p className="text-sm text-gray-500">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* --- RIGHT SIDE: FORM --- */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 bg-black relative">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center lg:text-left">
            <h2 className="text-3xl font-bold mb-2">Create Account</h2>
            <p className="text-gray-400 text-sm">
              Already have an account?{" "}
              <Link href="/login" className="text-purple-500 hover:text-purple-400 font-bold transition-colors underline decoration-transparent hover:decoration-purple-500 underline-offset-4">
                Log in
              </Link>
            </p>
          </div>

          <form onSubmit={handleEmailRegister} className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide ml-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3.5 bg-[#0A0A0A] rounded-xl border border-white/10 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all placeholder:text-gray-700 text-white"
                placeholder="johndoe"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide ml-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3.5 bg-[#0A0A0A] rounded-xl border border-white/10 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all placeholder:text-gray-700 text-white"
                placeholder="name@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide ml-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3.5 bg-[#0A0A0A] rounded-xl border border-white/10 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all placeholder:text-gray-700 text-white"
                placeholder="••••••••"
                minLength={6}
                required
              />
            </div>

            {error && <p className="text-red-400 text-sm font-medium bg-red-500/10 p-3 rounded-lg border border-red-500/20 text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="group w-full py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:shadow-[0_0_25px_rgba(168,85,247,0.6)] flex items-center justify-center gap-2 active:scale-[0.99] mt-2"
            >
              {loading ? "Creating..." : "Create Account"}
              {!loading && <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />}
            </button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-white/10"></span></div>
            <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest"><span className="bg-black px-4 text-gray-600">Or continue with</span></div>
          </div>

          <a
            href={`${API_BASE_URL}/auth/login/github`}
            className="flex items-center justify-center gap-2 w-full py-3.5 bg-[#0A0A0A] border border-white/10 text-white rounded-xl font-bold hover:bg-white hover:text-black transition-all group"
          >
            <Github className="h-5 w-5 text-gray-400 group-hover:text-black transition-colors" />
            GitHub
          </a>
        </div>
      </div>
    </div>
  );
}