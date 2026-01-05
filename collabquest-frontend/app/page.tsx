"use client";

import Link from "next/link";
import { 
  ArrowRight, CheckCircle, Zap, Shield, Users, 
  Search, MessageSquare, Briefcase, Star, Layout, 
  Quote, Github, Twitter, Linkedin, Sparkles, UserPlus, Handshake, Rocket
} from "lucide-react";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";

export default function Home() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-purple-500/30 overflow-x-hidden">
      
      {/* --- BACKGROUND GRIDS & GLOWS --- */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        {/* Subtle Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        {/* Top Purple Glow */}
        <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-purple-900/20 rounded-full blur-[120px]" />
        {/* Bottom Blue Glow */}
        <div className="absolute bottom-[-10%] right-[10%] w-[400px] h-[400px] bg-blue-900/10 rounded-full blur-[100px]" />
      </div>

      {/* --- NAVIGATION --- */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-black/50 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-tight flex items-center gap-2">
            Collab<span className="text-purple-500">Quest</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400">
            <Link href="#features" className="hover:text-white transition-colors">Features</Link>
            <Link href="#how-it-works" className="hover:text-white transition-colors">How it Works</Link>
            <Link href="#testimonials" className="hover:text-white transition-colors">Testimonials</Link>
          </nav>

          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium hover:text-purple-400 transition-colors hidden sm:block">
              Log in
            </Link>
            <Link 
              href="/signup"
              className="px-5 py-2.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold transition-all shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:shadow-[0_0_30px_rgba(168,85,247,0.5)]"
            >
              Sign up
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 pt-32">
        
        {/* --- HERO SECTION --- */}
        <section className="px-6 pb-20 md:pb-32 text-center max-w-5xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-purple-300 mb-8"
          >
            <Sparkles className="w-3 h-3" /> Find your perfect project team
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight mb-6 leading-[1.1]"
          >
            Collab<span className="text-purple-500">Quest</span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg md:text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed"
          >
            No more ghosting. Match with verified student collaborators based on skills, reliability, and code quality.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
          >
            <Link href="/signup">
              <button className="w-full sm:w-auto px-8 py-4 rounded-full bg-purple-600 hover:bg-purple-500 text-white font-bold text-lg transition-all shadow-lg shadow-purple-900/20 flex items-center justify-center gap-2">
                Get Started Free <ArrowRight className="w-5 h-5" />
              </button>
            </Link>
            <Link href="/projects">
              <button className="w-full sm:w-auto px-8 py-4 rounded-full bg-[#121212] hover:bg-[#1A1A1A] text-white border border-white/10 font-bold text-lg transition-all">
                Browse Projects
              </button>
            </Link>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex flex-wrap items-center justify-center gap-8 text-sm text-gray-500 font-medium"
          >
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div> 5+ Active Projects</div>
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]"></div> 4+ Students</div>
            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div> 1 Universities</div>
          </motion.div>
        </section>

        {/* --- HOW IT WORKS SECTION (Screenshot 1) --- */}
        <section id="how-it-works" className="py-24 border-t border-white/5 relative">
           <div className="max-w-7xl mx-auto px-6">
             <div className="text-center mb-16">
               <h2 className="text-3xl md:text-5xl font-bold mb-6">Start collaborating in <span className="text-purple-500">minutes</span></h2>
               <p className="text-gray-400">Our streamlined process gets you from signup to collaboration faster than ever.</p>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative">
                {/* Connecting Line (Hidden on Mobile) */}
                <div className="hidden lg:block absolute top-8 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-purple-500/30 to-transparent z-0"></div>

                {[
                  { icon: UserPlus, step: "01", title: "Create Your Profile", desc: "Sign up with your university email and showcase your skills, interests, and availability." },
                  { icon: Search, step: "02", title: "Find Projects", desc: "Browse through projects that match your interests or post your own project idea." },
                  { icon: Handshake, step: "03", title: "Connect & Match", desc: "Apply to join teams or review applications from interested collaborators." },
                  { icon: Rocket, step: "04", title: "Build Together", desc: "Collaborate using our integrated tools and bring your project to life." },
                ].map((item, i) => (
                  <div key={i} className="relative z-10 bg-[#050505] p-2"> 
                    {/* Icon Box */}
                    <div className="w-16 h-16 rounded-2xl bg-[#121212] border border-white/10 flex items-center justify-center mb-6 shadow-xl mx-auto lg:mx-0">
                      <item.icon className="w-7 h-7 text-purple-400" />
                    </div>
                    <div className="text-xs font-bold text-purple-500 mb-2 text-center lg:text-left">STEP {item.step}</div>
                    <h3 className="text-xl font-bold text-white mb-3 text-center lg:text-left">{item.title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed text-center lg:text-left">{item.desc}</p>
                  </div>
                ))}
             </div>
           </div>
        </section>

        {/* --- FEATURES GRID (Screenshot 3) --- */}
        <section id="features" className="py-24 bg-[#080808]">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <div className="inline-block px-3 py-1 rounded bg-white/5 border border-white/10 text-xs font-mono text-gray-400 mb-4">FEATURES</div>
              <h2 className="text-3xl md:text-5xl font-bold mb-6">Everything you need to <span className="text-purple-500">collaborate</span></h2>
              <p className="text-gray-400 max-w-2xl mx-auto">Built by students, for students. We understand the challenges of finding reliable project partners.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { icon: Zap, title: "Smart Matching", desc: "AI-powered algorithm matches you with collaborators who complement your skills and working style." },
                { icon: Shield, title: "Verified Profiles", desc: "Every member is verified through their university email, ensuring authentic student collaborators." },
                { icon: MessageSquare, title: "Real-time Collaboration", desc: "Built-in tools for seamless communication, task management, and progress tracking." },
                { icon: Users, title: "Team Building", desc: "Form balanced teams with the right mix of skills, from design to development to marketing." },
                { icon: CheckCircle, title: "No Ghosting Guarantee", desc: "Reputation system tracks reliability scores so you know who follows through." },
                { icon: Briefcase, title: "Portfolio Builder", desc: "Showcase your completed projects and collaborations to future employers." },
              ].map((feature, i) => (
                <div key={i} className="p-8 rounded-2xl bg-[#121212] border border-white/5 hover:border-purple-500/30 transition-all group">
                  <div className="w-12 h-12 rounded-lg bg-purple-900/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <feature.icon className="w-6 h-6 text-purple-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-3">{feature.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* --- BOTTOM CTA (Screenshot 4) --- */}
        <section className="py-32 relative overflow-hidden">
          <div className="absolute inset-0 bg-purple-900/5"></div>
          <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
            <h2 className="text-4xl md:text-6xl font-bold mb-8">Ready to find your <span className="text-purple-500">dream team</span>?</h2>
            <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
              Join thousands of students building amazing projects together. Your next big idea starts with the right collaborators.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
               <Link href="/signup">
                <button className="w-full sm:w-auto px-8 py-4 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-lg transition-all shadow-[0_0_30px_rgba(168,85,247,0.3)] flex items-center justify-center gap-2">
                  Start Your Quest <ArrowRight className="w-5 h-5" />
                </button>
               </Link>
               <Link href="/about">
                <button className="w-full sm:w-auto px-8 py-4 rounded-lg bg-[#121212] hover:bg-[#1A1A1A] text-white border border-white/10 font-bold text-lg transition-all">
                  Learn More
                </button>
               </Link>
            </div>
          </div>
        </section>

      </main>

      {/* --- FOOTER --- */}
      <footer className="border-t border-white/10 bg-black pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-16">
            <div className="col-span-2 md:col-span-1">
              <h3 className="text-lg font-bold mb-4">Collab<span className="text-purple-500">Quest</span></h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Connecting students worldwide to build amazing projects together.
              </p>
            </div>
            
            <div>
              <h4 className="font-bold mb-4 text-sm">Product</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="#" className="hover:text-purple-400">Features</Link></li>
                <li><Link href="#" className="hover:text-purple-400">Pricing</Link></li>
                <li><Link href="#" className="hover:text-purple-400">Universities</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-4 text-sm">Company</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="#" className="hover:text-purple-400">About</Link></li>
                <li><Link href="#" className="hover:text-purple-400">Blog</Link></li>
                <li><Link href="#" className="hover:text-purple-400">Careers</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-4 text-sm">Legal</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="#" className="hover:text-purple-400">Privacy</Link></li>
                <li><Link href="#" className="hover:text-purple-400">Terms</Link></li>
                <li><Link href="#" className="hover:text-purple-400">Contact</Link></li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-white/10 text-sm text-gray-600">
            <p>© 2026 CollabQuest. All rights reserved.</p>
            <div className="flex items-center gap-6 mt-4 md:mt-0">
               <Twitter className="w-5 h-5 hover:text-white cursor-pointer transition-colors" />
               <Github className="w-5 h-5 hover:text-white cursor-pointer transition-colors" />
               <Linkedin className="w-5 h-5 hover:text-white cursor-pointer transition-colors" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}