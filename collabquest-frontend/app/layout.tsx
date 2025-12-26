// app/layout.tsx
import "./globals.css";
// import { Toaster } from 'sonner'; // Example

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#0B0E14] text-white">
        {children}
        {/* <Toaster /> */}
      </body>
    </html>
  );
}