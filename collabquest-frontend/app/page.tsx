import Link from "next/link";
import { Github } from "lucide-react";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black text-white p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm lg:flex flex-col gap-6">
        <h1 className="text-6xl font-extrabold tracking-tight">
          Collab<span className="text-purple-500">Quest</span>
        </h1>
        <p className="text-xl text-gray-400 max-w-md text-center">
          No more ghosting. Match with verified students based on skills, reliability, and code quality.
        </p>

        {/* THE MAGIC BUTTON */}
        <Link 
          href="http://localhost:8000/auth/login/github" 
          className="mt-8 flex items-center gap-3 px-8 py-4 bg-white text-black rounded-full font-bold text-lg hover:scale-105 transition-transform"
        >
          <Github className="h-6 w-6" />
          Login with GitHub
        </Link>
      </div>
    </main>
  );
}