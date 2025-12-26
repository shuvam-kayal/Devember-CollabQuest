// app/(dashboard)/layout.tsx
import MainLayout from "@/components/MainLayout";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    // This adds the Sidebar/Header to Dashboard, Find Team, Chat, etc.
    <MainLayout>
       {children}
    </MainLayout>
  );
}