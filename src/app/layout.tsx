import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { ChatWidget } from "./chat-widget";
import { UserNav } from "./user-nav";
import { Geist, Geist_Mono, Creepster } from "next/font/google";
import "./globals.css";

const display = Creepster({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "The Garden",
  description: "Careers at The Garden. Cultivate a new world order.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${display.variable}`}
    >
      <body>
        <nav className="site-nav">
          <div className="site-nav-inner">
            <Link href="/" className="site-nav-brand">
              <Image
                src="/logo.png"
                alt=""
                width={799}
                height={1080}
                sizes="48px"
                preload
                style={{ height: 48, width: "auto" }}
              />
              The Garden
            </Link>
            <Link href="/">Home</Link>
            <Link href="/jobs">Jobs</Link>
            <Suspense fallback={null}>
              <UserNav />
            </Suspense>
          </div>
        </nav>
        {children}
        <ChatWidget />
      </body>
    </html>
  );
}
