import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { BrandHeader } from "@/components/BrandHeader";
import { MotionProvider } from "@/components/MotionProvider";
import { PickleballField } from "@/components/PickleballField";
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
  title: "Doc IPL People's Choice",
  description: "Vote for the People's Choice at Doc IPL.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0B2A5B",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} bg-navy antialiased`}
    >
      <body className="flex min-h-dvh flex-col font-sans text-white">
        <Suspense fallback={null}>
          <PickleballField />
        </Suspense>
        <MotionProvider>
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5">
            <BrandHeader />
            <main className="flex flex-1 flex-col">{children}</main>
          </div>
        </MotionProvider>
      </body>
    </html>
  );
}
