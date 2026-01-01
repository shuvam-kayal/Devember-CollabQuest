import { Suspense } from "react";
import NetworkClient from "./NetworkClient";
import { Loader2 } from "lucide-react";

// Forces dynamic rendering to prevent static build issues
export const dynamic = "force-dynamic";

export const metadata = {
  title: "My Network - CollabQuest",
};

export default function NetworkPage() {
    return (
        <Suspense fallback={<div className="h-screen bg-gray-950 flex items-center justify-center text-white"><Loader2 className="animate-spin w-12 h-12 text-purple-500" /></div>}>
            <NetworkClient />
        </Suspense>
    );
}