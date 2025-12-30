import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import FloatingChatbot from "../components/FloatingChatbot";
import "./globals.css";
import SelectionTTS from "@/components/SelectionTTS";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CollabQuest",
  description: "Find your team.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* TTS Listener acts globally here */}
        <SelectionTTS />
        {/* Global floating chatbot */}
        <FloatingChatbot />   
        {children}
      </body>
    </html>
  );
}