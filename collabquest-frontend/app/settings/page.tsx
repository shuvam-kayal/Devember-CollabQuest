"use client";

import Link from "next/link";
import { Github, ArrowRight } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import api from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Home() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState<"github" | "google" | "email-login" | "email-register">("github");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await api.post("/auth/login/email", { email, password });
      const data = response.data;
      Cookies.set("token", data.token, { expires: 7 }); 
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.detail || "An error occurred. Try again.");
    } finally {
      setLoading(false);
    }
  };

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
    <main className="flex min-h-screen flex-col items-center justify-center bg-black text-white p-6 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-[-20%] left-[-20%] w-[500px] h-[500px] bg-purple-900/30 rounded-full blur-3xl" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[500px] h-[500px] bg-blue-900/20 rounded-full blur-3xl" />

      <div className="z-10 max-w-md w-full bg-gray-950/50 backdrop-blur-sm p-8 rounded-2xl border border-gray-800 shadow-2xl">
        <h1 className="text-5xl font-extrabold tracking-tight text-center mb-2">
          Collab<span className="text-purple-500">Quest</span>
        </h1>
        <p className="text-center text-gray-400 text-sm mb-8">
          Match with verified students based on skills and reliability.
        </p>

        {/* Auth Mode Tabs */}
        <div className="flex gap-2 mb-6 bg-gray-900 p-1 rounded-lg overflow-x-auto custom-scrollbar">
          <button onClick={() => setAuthMode("github")} className={`flex-1 py-2 px-3 rounded text-xs sm:text-sm font-medium transition whitespace-nowrap ${authMode === "github" ? "bg-purple-600 text-white" : "text-gray-400 hover:text-white"}`}>GitHub</button>
          <button onClick={() => setAuthMode("google")} className={`flex-1 py-2 px-3 rounded text-xs sm:text-sm font-medium transition whitespace-nowrap ${authMode === "google" ? "bg-purple-600 text-white" : "text-gray-400 hover:text-white"}`}>Google</button>
          <button onClick={() => setAuthMode("email-login")} className={`flex-1 py-2 px-3 rounded text-xs sm:text-sm font-medium transition whitespace-nowrap ${authMode === "email-login" ? "bg-purple-600 text-white" : "text-gray-400 hover:text-white"}`}>Login</button>
          <button onClick={() => setAuthMode("email-register")} className={`flex-1 py-2 px-3 rounded text-xs sm:text-sm font-medium transition whitespace-nowrap ${authMode === "email-register" ? "bg-purple-600 text-white" : "text-gray-400 hover:text-white"}`}>Sign Up</button>
        </div>

        {/* GitHub Login */}
        {authMode === "github" && (
          <Link href={`${API_URL}/auth/login/github`} className="flex items-center justify-center gap-3 w-full px-6 py-3 bg-white text-black rounded-lg font-bold hover:bg-gray-200 transition">
            <Github className="h-5 w-5" /> Login with GitHub
          </Link>
        )}

        {/* Google Login */}
        {authMode === "google" && (
          <Link href={`${API_URL}/auth/login/google`} className="flex items-center justify-center gap-3 w-full px-6 py-3 bg-white text-black rounded-lg font-bold hover:bg-gray-200 transition">
            <svg className="h-5 w-5" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg> Login with Google
          </Link>
        )}

        {/* Email Login Form */}
        {authMode === "email-login" && (
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full px-4 py-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none" />
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full px-4 py-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none" />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button type="submit" disabled={loading} className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 disabled:opacity-50 transition">{loading ? "Logging in..." : "Login"}</button>
          </form>
        )}

        {/* Email Registration Form */}
        {authMode === "email-register" && (
          <form onSubmit={handleEmailRegister} className="space-y-4">
            <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required className="w-full px-4 py-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none" />
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full px-4 py-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none" />
            <input type="password" placeholder="Password (min 6 characters)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="w-full px-4 py-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none" />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button type="submit" disabled={loading} className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 disabled:opacity-50 transition">{loading ? "Creating account..." : "Sign Up"}</button>
          </form>
        )}

        <div className="mt-6 pt-6 border-t border-gray-800 text-center">
             <Link href="/dashboard" className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition group text-sm font-medium">
                Continue as Guest <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
             </Link>
        </div>
      </div>
    </main>
  );
}