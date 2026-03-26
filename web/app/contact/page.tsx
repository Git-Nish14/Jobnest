"use client";

import { useState, useRef } from "react";
import { Send, Mail, MessageSquare, User, Loader2, CheckCircle2, Github } from "lucide-react";
import { fetchWithRetry, getNetworkErrorMessage } from "@/lib/utils/fetch-retry";
import { Navbar, Footer } from "@/components/layout";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Newsreader, Manrope } from "next/font/google";
import "../landing.css";

const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-newsreader", display: "swap", style: ["normal", "italic"], weight: ["400", "500", "600", "700"] });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });

const contactSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  subject: z.string().min(5, "Subject must be at least 5 characters"),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

type ContactFormData = z.infer<typeof contactSchema>;

const INFO_ITEMS = [
  {
    icon: Mail,
    title: "Email Support",
    body: "We typically respond within 24–48 hours during business days.",
  },
  {
    icon: MessageSquare,
    title: "Feedback Welcome",
    body: "Your feedback helps us improve Jobnest for everyone.",
  },
  {
    icon: Github,
    title: "Report Issues",
    body: null,
  },
];

const FAQS = [
  { q: "Is Jobnest free?", a: "Yes, completely free forever." },
  { q: "Is my data secure?", a: "Yes, we use industry-standard encryption." },
  { q: "Can I export my data?", a: "Yes, you can export your data anytime." },
];

export default function ContactPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactFormData>({ resolver: zodResolver(contactSchema) });

  const onSubmit = async (data: ContactFormData) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetchWithRetry("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to send message");
      }
      setIsSuccess(true);
      reset();
    } catch (err) {
      setError(getNetworkErrorMessage(err));
    } finally {
      setIsSubmitting(false);
      submittingRef.current = false;
    }
  };

  return (
    <div className={`${newsreader.variable} ${manrope.variable} flex min-h-screen flex-col landing-root`}>
      <Navbar user={null} />

      <main className="flex-1 py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">

          {/* Header */}
          <div className="text-center mb-14">
            <h1 className="landing-serif text-4xl sm:text-5xl font-medium text-[#1a1c1b] mb-4">
              Get in Touch
            </h1>
            <p className="text-[#55433d] text-lg max-w-md mx-auto leading-relaxed">
              Have a question, suggestion, or feedback? We&apos;d love to hear from you.
            </p>
          </div>

          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">

            {/* Left — Info */}
            <div className="space-y-6">
              {INFO_ITEMS.map(({ icon: Icon, title, body }) => (
                <div key={title} className="flex items-start gap-4">
                  <div className="h-11 w-11 shrink-0 rounded-xl bg-[#ffdbd0] flex items-center justify-center">
                    <Icon className="h-5 w-5 text-[#99462a]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#1a1c1b]">{title}</h3>
                    {body ? (
                      <p className="mt-1 text-sm text-[#55433d]">{body}</p>
                    ) : (
                      <p className="mt-1 text-sm text-[#55433d]">
                        Found a bug?{" "}
                        <a href="https://github.com/techifive" target="_blank" rel="noopener noreferrer" className="text-[#99462a] hover:underline font-medium">
                          Report on GitHub
                        </a>
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {/* FAQ */}
              <div className="mt-8 rounded-2xl bg-[#f4f3f1] p-6">
                <h3 className="landing-serif text-lg font-semibold text-[#1a1c1b] mb-4">
                  Frequently Asked Questions
                </h3>
                <div className="space-y-3">
                  {FAQS.map(({ q, a }) => (
                    <div key={q} className="flex gap-2 text-sm">
                      <span className="font-semibold text-[#1a1c1b] shrink-0">{q}</span>
                      <span className="text-[#55433d]">— {a}</span>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-sm text-[#55433d]/70">
                Jobnest is a product of{" "}
                <a href="https://techifive.com" target="_blank" rel="noopener noreferrer" className="font-medium text-[#99462a] hover:underline">
                  Techifive
                </a>
              </p>
            </div>

            {/* Right — Form */}
            <div className="bg-[#f4f3f1] rounded-2xl p-6 sm:p-8">
              {isSuccess ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-16 w-16 rounded-full bg-[#006d34]/12 flex items-center justify-center mb-4">
                    <CheckCircle2 className="h-8 w-8 text-[#006d34]" />
                  </div>
                  <h3 className="landing-serif text-2xl font-semibold text-[#1a1c1b] mb-2">Message Sent!</h3>
                  <p className="text-[#55433d] mb-6">Thank you for reaching out. We&apos;ll get back to you soon.</p>
                  <button type="button" className="landing-btn-primary" onClick={() => setIsSuccess(false)}>
                    Send Another Message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                  {/* Name */}
                  <div>
                    <label htmlFor="name" className="atelier-label flex items-center gap-1.5 mb-1.5">
                      <User className="h-3.5 w-3.5" /> Name
                    </label>
                    <input
                      id="name"
                      type="text"
                      placeholder="Your name"
                      className="atelier-input"
                      aria-invalid={!!errors.name}
                      {...register("name")}
                    />
                    {errors.name && <p className="atelier-field-error">{errors.name.message}</p>}
                  </div>

                  {/* Email */}
                  <div>
                    <label htmlFor="email" className="atelier-label flex items-center gap-1.5 mb-1.5">
                      <Mail className="h-3.5 w-3.5" /> Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      className="atelier-input"
                      aria-invalid={!!errors.email}
                      {...register("email")}
                    />
                    {errors.email && <p className="atelier-field-error">{errors.email.message}</p>}
                  </div>

                  {/* Subject */}
                  <div>
                    <label htmlFor="subject" className="atelier-label flex items-center gap-1.5 mb-1.5">
                      <MessageSquare className="h-3.5 w-3.5" /> Subject
                    </label>
                    <input
                      id="subject"
                      type="text"
                      placeholder="How can we help?"
                      className="atelier-input"
                      aria-invalid={!!errors.subject}
                      {...register("subject")}
                    />
                    {errors.subject && <p className="atelier-field-error">{errors.subject.message}</p>}
                  </div>

                  {/* Message */}
                  <div>
                    <label htmlFor="message" className="atelier-label mb-1.5 block">Message</label>
                    <textarea
                      id="message"
                      rows={5}
                      placeholder="Tell us more about your inquiry..."
                      className="atelier-input resize-none"
                      aria-invalid={!!errors.message}
                      {...register("message")}
                    />
                    {errors.message && <p className="atelier-field-error">{errors.message.message}</p>}
                  </div>

                  {error && (
                    <div className="atelier-error">{error}</div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="atelier-btn-primary w-full"
                  >
                    {isSubmitting ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                    ) : (
                      <><Send className="h-4 w-4" /> Send Message</>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer variant="simple" />
    </div>
  );
}
