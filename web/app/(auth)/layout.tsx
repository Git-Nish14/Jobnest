import { Newsreader, Manrope } from "next/font/google";
import "./auth.css";

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
  style: ["normal", "italic"],
  weight: ["400", "500", "600", "700", "800"],
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${newsreader.variable} ${manrope.variable} min-h-screen bg-[#faf9f7] font-(family-name:--font-manrope)`}>
      {children}
    </div>
  );
}
