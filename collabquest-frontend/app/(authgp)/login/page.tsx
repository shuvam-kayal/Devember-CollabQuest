"use client";

import Link from "next/link";
import { Github, Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import api from "@/lib/api";
import { motion } from "framer-motion";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // API call to LOGIN endpoint
      const response = await api.post("/auth/login/email", { 
        email, 
        password 
      });
      const data = response.data;
      
      // Save token and redirect
      Cookies.set("token", data.token, { expires: 7 });
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-purple-500/30 flex items-center justify-center relative overflow-hidden p-4">
      
      {/* --- BACKGROUND --- */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-purple-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[10%] w-[400px] h-[400px] bg-blue-900/10 rounded-full blur-[100px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-lg"
      >
        <div className="bg-[#0A0A0A] border border-white/10 rounded-3xl shadow-2xl shadow-purple-900/20 p-6 sm:p-10 relative overflow-hidden">
          
          {/* Top colored line */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-600 to-blue-600" />

          {/* Header */}
          <div className="text-center mb-8">
            <Link href="/" className="inline-block text-2xl font-black tracking-tight mb-2 hover:opacity-80 transition">
              Collab<span className="text-purple-500">Quest</span>
            </Link>
            <h1 className="text-sm text-gray-400 font-medium">Welcome back! Please sign in to continue.</h1>
          </div>

          {/* Social Buttons */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <a
              href={`${API_BASE_URL}/auth/login/github`}
              className="flex items-center justify-center gap-2 py-3 bg-[#121212] hover:bg-[#1A1A1A] border border-white/10 rounded-xl transition-all duration-200 group/btn"
            >
              <Github className="h-5 w-5 text-gray-400 group-hover/btn:text-white transition-colors" />
              <span className="text-sm font-bold text-gray-300 group-hover/btn:text-white">GitHub</span>
            </a>
            <a
              href={`${API_BASE_URL}/auth/login/google`}
              className="flex items-center justify-center gap-2 py-3 bg-[#121212] hover:bg-[#1A1A1A] border border-white/10 rounded-xl transition-all duration-200 group/btn"
            >
              <svg className="h-5 w-5 text-gray-400 group-hover/btn:text-white transition-colors" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <span className="text-sm font-bold text-gray-300 group-hover/btn:text-white">Google</span>
            </a>
          </div>

          <div className="relative mb-6 text-center">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-white/5"></span></div>
            <span className="relative bg-[#0A0A0A] px-4 text-[10px] text-gray-500 uppercase tracking-widest font-bold">Or continue with email</span>
          </div>

          {/* Form */}
          <form onSubmit={handleEmailLogin} className="space-y-4">
            
            <div className="space-y-4">
              <div className="relative group/input">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500 group-focus-within/input:text-purple-500 transition-colors" />
                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-12 pr-4 py-3.5 bg-[#121212] border border-white/10 rounded-xl focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all placeholder:text-gray-600 text-white"
                />
              </div>

              <div className="relative group/input">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500 group-focus-within/input:text-purple-500 transition-colors" />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-12 pr-4 py-3.5 bg-[#121212] border border-white/10 rounded-xl focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all placeholder:text-gray-600 text-white"
                />
              </div>
            </div>

            {error && (
              <motion.p 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="text-red-400 text-xs text-center font-bold bg-red-500/10 py-2 rounded-lg border border-red-500/20"
              >
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold transition-all duration-300 shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:shadow-[0_0_30px_rgba(168,85,247,0.5)] active:scale-[0.98] mt-6"
            >
              {loading ? <Loader2 className="animate-spin h-5 w-5" /> : "Sign In"}
              {!loading && <ArrowRight className="h-5 w-5" />}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-gray-500">
            Don't have an account?{" "}
            <Link href="/signup" className="text-white hover:text-purple-400 font-bold transition-colors">
              Sign Up
            </Link>
          </p>
        </div>
        
        {/* Footer Text */}
        <p className="text-center text-xs text-gray-600 mt-6">
          By signing in, you agree to our <Link href="#" className="underline hover:text-gray-400">Terms</Link> and <Link href="#" className="underline hover:text-gray-400">Privacy Policy</Link>.
        </p>
      </motion.div>
    </div>
  );
}