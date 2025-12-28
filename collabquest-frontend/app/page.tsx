"use client";

import Link from "next/link";
import { Github, Mail } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState<"github" | "google" | "email-login" | "email-register">("github");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Define the API URL once here. 
  // It checks for the environment variable first, then falls back to localhost.
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // UPDATED: Using API_URL variable
      const response = await fetch(`${API_URL}/auth/login/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.detail || "Login failed");
        return;
      }

      // Save token and redirect
      localStorage.setItem("token", data.token);
      router.push("/dashboard");
    } catch (err) {
      setError("An error occurred. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // UPDATED: Using API_URL variable
      const response = await fetch(`${API_URL}/auth/register/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.detail || "Registration failed");
        return;
      }

      // Save token and redirect
      localStorage.setItem("token", data.token);
      router.push("/dashboard");
    } catch (err) {
      setError("An error occurred. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-black text-white p-24 overflow-hidden">
      <header className="absolute top-0 right-0 p-8 z-20 flex gap-4">
        <Link 
          href="/login"
          className="px-5 py-2 rounded-full border border-gray-700 hover:bg-white hover:text-black transition font-medium flex items-center justify-center"
        >
          Log in
        </Link>
        <Link 
          href="/signup"
          className="px-5 py-2 rounded-full bg-purple-600 hover:bg-purple-500 transition font-bold shadow-lg shadow-purple-500/20 flex items-center justify-center"
        >
          Sign up
        </Link>
      </header>
      <div 
        className="absolute inset-0 z-0 bg-dot-pattern opacity-[0.1]"
      ></div>
      <div
        className="absolute inset-0 z-0 bg-repeat opacity-[0.2]"
        style={{
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 8 8'%3E%3Cg fill='%23A855F7' fill-opacity='0.8'%3E%3Cpath fill-rule='evenodd' d='M0 0h4v4H0V0zm4 4h4v4H4V4z'/%3E%3C/g%3E%3C/svg%3E\")"
        }}
       ></div>
      <div className="absolute inset-0 z-0 opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-color-purple-900)_0%,_transparent_60%)]"></div>
       <div className="z-10 max-w-5xl w-full flex flex-col items-center justify-center font-sans text-sm gap-8">

        <h1 className="text-8xl md:text-9xl font-extrabold tracking-tighter mb-4 text-center">
          Collab<span className="text-purple-500">Quest</span>
        </h1>
        <p className="text-xl md:text-2xl text-gray-200 max-w-2xl text-center font-medium">
          No more ghosting. Match with verified student collaborators based on skills, reliability, and code quality.
        </p>
        
      </div>
    </main>
  );
}