import { Github, Code2, Database, Layout, Server, Heart } from 'lucide-react';
import Link from 'next/link';

export default function Footer() {
  const teamMembers = [
    { name: "Arunoday Gupta", role: "Leader", github: "https://github.com/ArunodayGupta" },
    { name: "Shuvam Kayal", role: "Member", github: "https://github.com/shuvam-kayal" },
    { name: "Aditya Singh", role: "Member", github: "https://github.com/Aditya125031" },
    { name: "Ambadas Rautrao", role: "Member", github: "https://github.com/Rautrao" },
  ];

  return (
    <footer className="bg-black/40 border-t border-white/5 backdrop-blur-xl mt-auto z-50 relative">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
          
          {/* BRAND SECTION */}
          <div className="md:col-span-5 space-y-4">
            <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-red-500">
              QuadCore Clowns
            </h3>
            <p className="text-zinc-400 text-sm leading-relaxed max-w-sm">
              Built for the <strong className="text-white">Devember Hackathon</strong>. 
              CollabQuest is a next-gen project management platform powered by Agentic AI, designed to streamline collaboration.
            </p>
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-600">
              <span className="flex items-center gap-1"><Code2 className="w-3 h-3" /> Next.js</span>
              <span className="w-1 h-1 bg-zinc-700 rounded-full"></span>
              <span className="flex items-center gap-1"><Server className="w-3 h-3" /> FastAPI</span>
              <span className="w-1 h-1 bg-zinc-700 rounded-full"></span>
              <span className="flex items-center gap-1"><Database className="w-3 h-3" /> MongoDB</span>
            </div>
          </div>

          {/* TEAM SECTION */}
          <div className="md:col-span-4">
            <h4 className="text-sm font-bold text-white uppercase tracking-widest mb-6 border-b border-white/10 pb-2 w-fit">
              The Team
            </h4>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {teamMembers.map((member, i) => (
                <li key={i}>
                  <a 
                    href={member.github} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="group flex items-center gap-3 text-zinc-400 hover:text-white transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center group-hover:bg-purple-500/20 group-hover:text-purple-400 transition-colors">
                      <Github className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{member.name}</span>
                      <span className="text-[10px] text-zinc-600 group-hover:text-zinc-500 uppercase tracking-wide">
                        {member.role}
                      </span>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* LINKS SECTION */}
          <div className="md:col-span-3">
            <h4 className="text-sm font-bold text-white uppercase tracking-widest mb-6 border-b border-white/10 pb-2 w-fit">
              Project Links
            </h4>
            <div className="flex flex-col gap-4">
              <Link 
                href="https://github.com/shuvam-kayal/Devember-CollabQuest" 
                target="_blank"
                className="flex items-center gap-3 p-4 rounded-xl bg-zinc-900/50 border border-white/5 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all group"
              >
                <Github className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
                <div>
                  <span className="block text-sm font-bold text-white">View Repository</span>
                  <span className="block text-xs text-zinc-500">Source Code & Documentation</span>
                </div>
              </Link>
              
              <div className="p-4 rounded-xl bg-zinc-900/30 border border-dashed border-white/10 text-center">
                <p className="text-xs text-zinc-500 mb-1">Status</p>
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-500/10 text-green-400 text-xs font-bold border border-green-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                  Active Development
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* COPYRIGHT */}
        <div className="mt-12 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-zinc-600">
          <p>&copy; 2025 QuadCore Clowns. All rights reserved.</p>
          <p className="flex items-center gap-1">
            Made with <Heart className="w-3 h-3 text-red-500 fill-current animate-pulse" /> in <span className="text-zinc-400">Devember</span>
          </p>
        </div>
      </div>
    </footer>
  );
}