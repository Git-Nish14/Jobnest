import type { ReactNode } from "react";
import { Newsreader, Manrope } from "next/font/google";
import "../globals.css";

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
  style: ["normal", "italic"],
  weight: ["400", "500", "600", "700"],
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

export default function PortfolioLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${newsreader.variable} ${manrope.variable} min-h-screen bg-background text-foreground`}>
      {children}
    </div>
  );
}
