import { Suspense } from "react";
import DashboardClient from "./DashboardClient";
import { Loader2 } from "lucide-react";

// This is key for resolving the build error
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dashboard - CollabQuest",
};

export default function DashboardPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#050505] text-white"><Loader2 className="animate-spin text-purple-500" /></div>}>
            <DashboardClient />
        </Suspense>
    );
}