"use client";
import React, { useEffect, useRef, useState } from "react";
import Cookies from "js-cookie";
import { usePathname } from "next/navigation"; // 🔥 Added to check current page
import { Send, Bot, User, X, Loader2, Sparkles, Mic, Volume2, VolumeX } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";

// --- 1. TYPE DEFINITIONS ---
declare global {
  interface Window {
    webkitSpeechRecognition: any;
  }
}

interface Message {
  role: "user" | "bot";
  text: string;
}

interface ChatbotProps {
  onClose?: () => void;
}

export default function Chatbot({ onClose }: ChatbotProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Voice States
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(true); 
  const recognitionRef = useRef<any>(null);

  // Prevent repeats
  const lastSpokenRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 🔥 DETECT PAGE LOCATION
  const pathname = usePathname();
  // List pages where the chatbot should appear BUT stay empty/logged out
  const isPublicPage = ["/login", "/signup", "/", "/auth"].includes(pathname);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // --- 2. INITIALIZE SPEECH RECOGNITION ---
  useEffect(() => {
    if (typeof window !== "undefined" && "webkitSpeechRecognition" in window) {
      const recognition = new window.webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
      };

      recognition.onend = () => setIsListening(false);
      recognition.onerror = (event: any) => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  // --- 3. TEXT-TO-SPEECH (TTS) ---
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];

    if (lastMessage?.role === "bot" && !loading) {
        if (lastMessage.text !== lastSpokenRef.current) {
            lastSpokenRef.current = lastMessage.text;
            if (isSpeaking) {
                speakText(lastMessage.text);
            }
        }
    }
  }, [messages, isSpeaking, loading]);

  const speakText = (text: string) => {
    if (typeof window === "undefined") return;
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*#_`]/g, "");
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1; 
    utterance.pitch = 1;
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.name.includes("Google US English")) || voices[0];
    if (preferredVoice) utterance.voice = preferredVoice;
    window.speechSynthesis.speak(utterance);
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
        alert("Voice input is not supported in this browser.");
        return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const toggleMute = () => {
    if (isSpeaking) window.speechSynthesis.cancel();
    setIsSpeaking(!isSpeaking);
  };

  // --- 4. HISTORY LOADER (BLOCKED ON LOGIN PAGE) ---
  useEffect(() => {
    const fetchHistory = async () => {
      // 🔥 FIX: If on login page, DO NOT load history
      if (isPublicPage) {
          setMessages([]); // Clear chat if they logged out/went to login
          return;
      }

      try {
        const token = Cookies.get("token");
        if (!token) return;

        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/chat/ai/history`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (!res.ok) return; 

        const data = await res.json();
        if (data && data.history) {
          const history = data.history.flatMap((m: any) => [
            { role: "user", text: m.question },
            { role: "bot", text: m.answer },
          ]);
          setMessages(history);

          if (history.length > 0) {
              lastSpokenRef.current = history[history.length - 1].text;
          }
        }
      } catch (error) {
        console.error("Error fetching chat history:", error);
      }
    };
    fetchHistory();
  }, [pathname]); // 🔥 Reloads if page changes

  // --- 5. SEND MESSAGE (BLOCKED ON LOGIN PAGE) ---
  async function sendMessage(overrideText?: string) {
    const textToSend = overrideText || input;
    if (!textToSend.trim()) return;

    window.speechSynthesis.cancel();
    setMessages((prev) => [...prev, { role: "user", text: textToSend }]);
    setInput("");
    
    // 🔥 FIX: If on login page, pretend to be a bot and ask to login
    if (isPublicPage) {
        setTimeout(() => {
            setMessages((prev) => [
                ...prev,
                { role: "bot", text: "I am ready to help! Please **Login** or **Sign Up** to start chatting with me." },
            ]);
        }, 600);
        return;
    }

    setLoading(true);
    const token = Cookies.get("token");

    if (!token) {
        setTimeout(() => {
            setMessages((prev) => [
                ...prev,
                { role: "bot", text: "Please login to use the chatbot mentor." },
            ]);
            setLoading(false);
        }, 500);
        return;
    }

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chat/ai/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`, 
        },
        body: JSON.stringify({ question: textToSend }),
      });

      if (res.status === 401) {
         setMessages((prev) => [...prev, { role: "bot", text: "Your session has expired. Please login again." }]);
         setLoading(false);
         return;
      }

      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const data = await res.json();
      const botReply = data.answer || "I didn't get a valid response.";
      
      setMessages((prev) => [...prev, { role: "bot", text: botReply }]);

    } catch (error) {
      console.error("Failed to send message:", error);
      setMessages((prev) => [
        ...prev,
        { role: "bot", text: "Sorry, I encountered an error connecting to the AI." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !loading) {
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-white rounded-xl overflow-hidden border border-zinc-800 shadow-2xl font-sans">
      
      {/* HEADER */}
      <div className="bg-zinc-900/80 backdrop-blur-md border-b border-zinc-800 p-4 flex items-center justify-between sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-500/20">
                <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
                <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                    CollabQuest AI
                    <Sparkles className="w-3 h-3 text-yellow-400 fill-yellow-400 animate-pulse" />
                </h2>
                <p className="text-xs text-zinc-400">
                    {isPublicPage ? "Login Required" : "Voice Enabled"}
                </p>
            </div>
        </div>
        
        <div className="flex items-center gap-2">
            <button 
                onClick={toggleMute}
                className={`p-2 rounded-full transition-colors ${isSpeaking ? "text-green-400 hover:bg-zinc-800" : "text-zinc-500 hover:bg-zinc-800"}`}
                title={isSpeaking ? "Mute Voice" : "Enable Voice"}
            >
                {isSpeaking ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {onClose && (
            <button 
                onClick={onClose} 
                className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white"
            >
                <X className="w-4 h-4" />
            </button>
            )}
        </div>
      </div>

      {/* MESSAGES */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar scroll-smooth">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 p-8 opacity-60">
            <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mb-2">
                <Bot className="w-8 h-8 text-indigo-500" />
            </div>
            <div>
                <p className="text-zinc-300 font-medium">
                    {isPublicPage ? "Please Login to Chat" : "How can I help you today?"}
                </p>
                {!isPublicPage && <p className="text-xs text-zinc-500 mt-1">Try tapping the mic to speak!</p>}
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
            {messages.map((m, i) => (
            <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}
            >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    m.role === "user" ? "bg-zinc-800" : "bg-indigo-600"
                }`}>
                    {m.role === "user" ? <User className="w-4 h-4 text-zinc-400" /> : <Bot className="w-4 h-4 text-white" />}
                </div>

                {/* Chat Bubble */}
                <div
                    // I added 'overflow-hidden' as a safety net, keep break-words here too.
                    className={`p-3.5 rounded-2xl text-sm leading-relaxed max-w-[85%] shadow-sm break-words overflow-hidden ${
                    m.role === "user"
                        ? "bg-zinc-800 text-zinc-100 rounded-tr-none"
                        : "bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-tl-none"
                    }`}
                >
                <ReactMarkdown
                  components={{
                    // 1. Paragraphs
                    p: ({node, ...props}) => <p className="mb-2 last:mb-0 break-words w-full" {...props} />,
                    
                    // 2. Lists
                    li: ({node, ...props}) => <li className="break-words ml-4" {...props} />,
                    ul: ({node, ...props}) => <ul className="list-disc mt-1 mb-2 space-y-1" {...props} />,
                    ol: ({node, ...props}) => <ol className="list-decimal mt-1 mb-2 space-y-1" {...props} />,

                    // 3. Links
                    a: ({node, ...props}) => <a className="underline text-indigo-200 hover:text-indigo-100 break-words" target="_blank" rel="noopener noreferrer" {...props} />,

                    // 4. Headings (New! Makes headers look better)
                    h1: ({node, ...props}) => <h1 className="text-lg font-bold mt-4 mb-2" {...props} />,
                    h2: ({node, ...props}) => <h2 className="text-base font-bold mt-3 mb-2" {...props} />,

                    // 5. CODE BLOCKS (The Big Improvement)
                    pre: ({node, ...props}) => (
                      <div className="relative my-3 rounded-lg overflow-hidden bg-zinc-950 border border-white/10 shadow-sm">
                        {/* We wrap pre in a div to give it a nice border and solid background */}
                        <pre className="p-3 text-xs font-mono text-zinc-300 whitespace-pre-wrap break-words overflow-x-auto" {...props} />
                      </div>
                    ),

                    // 6. INLINE CODE (Small snippets like `const x = 1`)
                    code: ({node, className, ...props}: any) => {
                      // This check prevents the inline styling from applying to the big code blocks
                      const isInline = !String(className).includes('language-'); 
                      return isInline ? (
                        <code className="bg-black/30 rounded px-1.5 py-0.5 font-mono text-xs font-bold text-white/90 border border-white/10" {...props} />
                      ) : (
                        <code className="font-mono" {...props} />
                      );
                    }
                  }}
                >
                  {m.text}
                </ReactMarkdown>
                </div>
            </motion.div>
            ))}
        </AnimatePresence>

        {loading && (
           <motion.div 
             initial={{ opacity: 0, y: 10 }}
             animate={{ opacity: 1, y: 0 }}
             className="flex gap-3"
           >
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-zinc-800 p-4 rounded-2xl rounded-tl-none flex items-center gap-1.5 w-fit">
                 <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 0.8 }} className="w-2 h-2 bg-zinc-400 rounded-full" />
                 <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }} className="w-2 h-2 bg-zinc-400 rounded-full" />
                 <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.4 }} className="w-2 h-2 bg-zinc-400 rounded-full" />
              </div>
           </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT AREA */}
      <div className="p-4 bg-zinc-900 border-t border-zinc-800 shrink-0">
        <div className={`flex gap-2 items-center bg-zinc-950 border rounded-xl p-1.5 transition-all shadow-inner ${isListening ? "border-red-500 ring-1 ring-red-500/50" : "border-zinc-800 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/50"}`}>
          
          <button
            onClick={toggleListening}
            className={`p-2 rounded-lg transition-all duration-200 ${
                isListening 
                ? "bg-red-500 text-white animate-pulse" 
                : "text-zinc-400 hover:text-white hover:bg-zinc-800"
            }`}
            title="Voice Input"
          >
            <Mic className="w-4 h-4" />
          </button>

          <input
            className="flex-1 bg-transparent text-sm text-white placeholder-zinc-500 px-3 py-2 outline-none min-w-0"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isPublicPage ? "Please login to chat..." : (isListening ? "Listening..." : "Type or speak...")}
            disabled={loading} // Keep enabled on public page so they can try (and get the alert)
            autoComplete="off"
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            className={`p-2 rounded-lg transition-all duration-200 ${
              loading || !input.trim()
                ? "text-zinc-600 bg-zinc-900 cursor-not-allowed"
                : "bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-500/25 hover:scale-105 active:scale-95"
            }`}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}