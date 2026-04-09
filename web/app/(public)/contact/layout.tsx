import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with the Jobnest team — questions, feedback, or partnership enquiries.",
  openGraph: {
    title: "Contact | Jobnest",
    description: "Get in touch with the Jobnest team — questions, feedback, or partnership enquiries.",
    url: "/contact",
  },
  twitter: {
    card: "summary",
    title: "Contact | Jobnest",
    description: "Get in touch with the Jobnest team — questions, feedback, or partnership enquiries.",
  },
};

export default function ContactLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
