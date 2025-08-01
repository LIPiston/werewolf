import type { Metadata } from "next";
import "./globals.css";
import { ProfileProvider } from "@/lib/ProfileContext";

export const metadata: Metadata = {
  title: "Werewolf Game",
  description: "A modern Werewolf game built with Next.js and FastAPI",
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-900">
        <ProfileProvider>{children}</ProfileProvider>
      </body>
    </html>
  );
}