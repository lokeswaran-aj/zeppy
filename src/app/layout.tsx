import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { AppNavbar } from "@/components/app/app-navbar";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Zeppy",
    template: "%s | Zeppy",
  },
  description: "Multilingual AI phone investigations with live transcripts and ranked recommendations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="min-h-screen bg-background">
          <AppNavbar />
          {children}
        </div>
      </body>
    </html>
  );
}
