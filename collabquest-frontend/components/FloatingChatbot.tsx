"use client";
import { useState } from "react";
import Chatbot from "./Chatbot"; // Ensure this path matches where you saved Chatbot.tsx
import { Bot, X, MessageCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function FloatingChatbot() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            // Styles updated to match the Zinc-950 dark theme of the Chatbot
            className="fixed bottom-24 right-6 z-[9999] w-[380px] h-[600px] max-h-[calc(100vh-120px)] shadow-2xl rounded-2xl flex flex-col overflow-hidden border border-zinc-800"
          >
            {/* We pass the onClose handler so the X button inside Chatbot works too */}
            <Chatbot onClose={() => setOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(!open)}
        className={`fixed bottom-12 right-4 z-[9999] p-4 rounded-full shadow-2xl transition-all duration-300 flex items-center justify-center border border-zinc-700 ${
            open 
            ? "bg-zinc-800 text-zinc-400 rotate-90 hover:text-white" 
            : "bg-indigo-600 text-white hover:bg-indigo-500 hover:shadow-indigo-500/50"
        }`}
        aria-label="Toggle AI Assistant"
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </motion.button>
    </>
  );
}