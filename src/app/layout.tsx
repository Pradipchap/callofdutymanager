import type { Metadata } from "next";
import { Rajdhani, Teko } from "next/font/google";
import "./globals.css";

const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
});

const teko = Teko({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "CODM Tournament Manager",
  description: "Call of Duty Mobile private one-shot one-kill tournament manager",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${rajdhani.variable} ${teko.variable}`}>{children}</body>
    </html>
  );
}
