import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "BETADRiX Trader | Original Crash Game",
  description: "High-octane market multiplier crash game simulation for BETADRiX.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full dark`}
      suppressHydrationWarning
    >
      <body
        className="min-h-full flex flex-col bg-[#07090e] text-slate-100 selection:bg-red-500/30 antialiased"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
