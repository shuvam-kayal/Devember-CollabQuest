import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import FloatingChatbot from "../components/FloatingChatbot";
import "./globals.css";
import SelectionTTS from "@/components/SelectionTTS";
import Footer from "@/components/Footer";

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
      <body className={`${inter.className} min-h-screen flex flex-col bg-black text-white`}>
        <SelectionTTS />
        <FloatingChatbot />   
        <div className="flex-grow relative">
            {children}
        </div>

        <Footer />
      </body>
    </html>
  );
}