import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Or your preferred font
import "./globals.css"; // Your global styles
import SelectionTTS from "@/components/SelectionTTS"; // Using @/ is safer for paths

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
        
        {children}
      </body>
    </html>
  );
}