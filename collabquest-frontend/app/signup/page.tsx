"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Github, UserPlus, ArrowRight } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("http://localhost:8000/auth/register/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.detail || "Registration failed");
        return;
      }

      localStorage.setItem("token", data.token);
      router.push("/dashboard");
    } catch (err) {
      setError("An error occurred. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen bg-black text-white">
      {/* Left Side: Visual/Branding Section */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-purple-900 via-black to-black items-center justify-center p-12 border-r border-gray-800">
        <div className="max-w-md">
          <h1 className="text-5xl font-extrabold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
            Begin Your Quest.
          </h1>
          <p className="text-xl text-gray-400 mb-8">
            Join thousands of users tracking their journey and mastering new skills.
          </p>
          <div className="space-y-4">
            <div className="flex items-center gap-4 text-gray-300">
              <div className="h-8 w-8 rounded-full bg-purple-600/20 flex items-center justify-center text-purple-400">✓</div>
              <span>Personalized Dashboard</span>
            </div>
            <div className="flex items-center gap-4 text-gray-300">
              <div className="h-8 w-8 rounded-full bg-purple-600/20 flex items-center justify-center text-purple-400">✓</div>
              <span>Prject Markeplaces</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side: Form Section */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 sm:p-24">
        <div className="w-full max-w-sm">
          <div className="mb-10 text-center lg:text-left">
            <h2 className="text-3xl font-bold mb-2">Create Account</h2>
            <p className="text-gray-400">
              Already have an account?{" "}
              <Link href="/login" className="text-purple-500 hover:underline">
                Log in
              </Link>
            </p>
          </div>

          <form onSubmit={handleEmailRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-gray-900 rounded-lg border border-gray-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition"
                placeholder="johndoe"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-gray-900 rounded-lg border border-gray-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition"
                placeholder="name@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-900 rounded-lg border border-gray-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition"
                placeholder="••••••••"
                minLength={6}
                required
              />
            </div>

            {error && <p className="text-red-500 text-sm bg-red-500/10 p-3 rounded">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold transition disabled:opacity-50"
            >
              {loading ? "Creating account..." : "Create Account"}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-800"></span></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-black px-2 text-gray-500">Or continue with</span></div>
          </div>

          <a
            href="http://localhost:8000/auth/login/github"
            className="flex items-center justify-center gap-3 w-full px-6 py-3 bg-white text-black rounded-lg font-bold hover:bg-gray-200 transition"
          >
            <Github className="h-5 w-5" />
            GitHub
          </a>
        </div>
      </div>
    </main>
  );
}