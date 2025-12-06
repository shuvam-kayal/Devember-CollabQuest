"use client";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Cookies from "js-cookie";
import axios from "axios";
import { motion } from "framer-motion";
import { ShieldCheck, Loader2 } from "lucide-react";
import Link from "next/link";

// Define the User Shape
interface UserProfile {
  username: string;
  avatar_url: string;
  trust_score: number;
  is_verified_student: boolean;
}

export default function Dashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    // 1. Check for Token in URL (Login Redirect) or Cookie
    const urlToken = searchParams.get("token");
    let activeToken = urlToken;

    if (urlToken) {
      Cookies.set("token", urlToken, { expires: 7 });
      setToken(urlToken);
      router.replace("/dashboard"); // Clean the URL
    } else {
      activeToken = Cookies.get("token") || null;
      if (activeToken) {
        setToken(activeToken);
      } else {
        router.push("/"); // Redirect to Login
        return;
      }
    }

    // 2. Fetch User Data if we have a token
    if (activeToken) {
      fetchUserProfile(activeToken);
    }
  }, [searchParams, router]);

  const fetchUserProfile = async (jwt: string) => {
    try {
      // Call our new Backend Endpoint
      const response = await axios.get("http://localhost:8000/users/me", {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      setUser(response.data);
    } catch (error) {
      console.error("Failed to fetch user:", error);
      Cookies.remove("token");
      router.push("/");
    }
  };

  // Helper for Trust Score Color
  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-green-400";
    if (score >= 5) return "text-yellow-400";
    return "text-red-400";
  };

  // Loading State
  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950 text-white">
        <Loader2 className="h-10 w-10 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto"
      >
        <header className="flex items-center justify-between mb-12">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
            CollabQuest
          </h1>

          {/* DYNAMIC TRUST SCORE BADGE */}
          <div className="flex items-center gap-3 bg-gray-900 px-5 py-2 rounded-full border border-gray-800 shadow-lg">
            <ShieldCheck className={`${getScoreColor(user.trust_score)} h-6 w-6`} />
            <div className="flex flex-col">
              <span className="text-xs text-gray-400 font-mono uppercase">Trust Score</span>
              <span className="font-bold text-lg leading-none">{user.trust_score.toFixed(1)} / 10.0</span>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Profile Card */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="p-6 rounded-2xl bg-gray-900 border border-gray-800 shadow-xl flex items-center gap-4"
          >
            <img
              src={user.avatar_url}
              alt="Avatar"
              className="w-16 h-16 rounded-full border-2 border-purple-500"
            />
            <div>
              <h2 className="text-xl font-semibold">Welcome, {user.username}!</h2>
              <p className="text-gray-400 text-sm">
                Status: <span className="text-green-400 font-mono">Verified Hacker</span>
              </p>
            </div>
          </motion.div>

          {/* Action Card */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="p-6 rounded-2xl bg-gradient-to-br from-purple-900/50 to-blue-900/50 border border-purple-500/20"
          >
            <h2 className="text-xl font-semibold mb-4">Start a Project</h2>
            <Link href="/find-team">
              <button className="w-full py-3 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition shadow-lg">
                Find a Team
              </button>
            </Link>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}