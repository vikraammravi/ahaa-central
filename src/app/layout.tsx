import type { Metadata } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { ConfirmationHost } from "@/components/shared/ConfirmationHost";
import { platformDeployment } from "@/lib/app-surface";
import { PLATFORM_CONSOLE_TITLE } from "@/features/platform/brand";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: platformDeployment() ? PLATFORM_CONSOLE_TITLE : "Aaha Central",
  description: platformDeployment() ? "Business platform administration" : "Central Kitchen operations for Aaha branches",
  robots: {
    index: false,
    follow: false,
    nosnippet: true,
    noimageindex: true,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${serif.variable} h-full antialiased${platformDeployment() ? " platform-surface" : ""}`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        {children}
        <ConfirmationHost/>
      </body>
    </html>
  );
}
