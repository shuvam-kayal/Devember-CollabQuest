"use client";
import { useState } from "react";
import Sidebar from "./Sidebar";
import GlobalHeader from "./GlobalHeader"; // Uses your existing file
import OnboardingTutorial from "./OnboardingTutorial";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  // Shared state for collapsing sidebar
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#0B0E14]">
      {/* 1. Persistent Sidebar */}
      <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />

      {/* 2. Main Content Wrapper */}
      <div 
        className={`flex-1 flex flex-col transition-all duration-300 ${
          isCollapsed ? "ml-20" : "ml-64"
        }`}
      >
        {/* 3. Your Existing Global Header */}
        {/* It handles notifications, profile, etc. internally */}
        <GlobalHeader />

        {/* 4. Dynamic Page Content */}
        <main className="flex-1 w-full p-6">
          {children}
        </main>
      </div>

    </div>
  );
}