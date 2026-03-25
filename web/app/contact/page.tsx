"use client";

import { useState, useRef } from "react";
import { Send, Mail, MessageSquare, User, Loader2, CheckCircle2, Github } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";
import { fetchWithRetry, getNetworkErrorMessage } from "@/lib/utils/fetch-retry";
import { Navbar, Footer } from "@/components/layout";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const contactSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  subject: z.string().min(5, "Subject must be at least 5 characters"),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

type ContactFormData = z.infer<typeof contactSchema>;

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
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
  });

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
    <div className="flex min-h-screen flex-col">
      <Navbar user={null} />

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            {/* Left Column - Info */}
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Get in Touch</h1>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                Have a question, suggestion, or feedback? We&apos;d love to hear from you.
                Fill out the form and we&apos;ll get back to you as soon as possible.
              </p>

              <div className="mt-8 space-y-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Email Support</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      We typically respond within 24-48 hours during business days.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <MessageSquare className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Feedback Welcome</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Your feedback helps us improve Jobnest for everyone.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Github className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Report Issues</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Found a bug?{" "}
                      <a
                        href="https://github.com/techifive"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Report on GitHub
                      </a>
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-10 rounded-xl border bg-muted/30 p-6">
                <h3 className="font-semibold">Frequently Asked Questions</h3>
                <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-foreground">Is Jobnest free?</span>
                    <span>— Yes, completely free forever.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-foreground">Is my data secure?</span>
                    <span>— Yes, we use industry-standard encryption.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-medium text-foreground">Can I export my data?</span>
                    <span>— Yes, you can export your data anytime.</span>
                  </li>
                </ul>
              </div>

              <div className="mt-6 text-sm text-muted-foreground">
                Jobnest is a product of{" "}
                <a
                  href="https://techifive.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  Techifive
                </a>
              </div>
            </div>

            {/* Right Column - Form */}
            <div>
              <div className="rounded-xl border bg-card p-6 shadow-sm sm:p-8">
                {isSuccess ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                      <CheckCircle2 className="h-8 w-8 text-green-600" />
                    </div>
                    <h3 className="mt-4 text-xl font-semibold">Message Sent!</h3>
                    <p className="mt-2 text-muted-foreground">
                      Thank you for reaching out. We&apos;ll get back to you soon.
                    </p>
                    <Button
                      type="button"
                      className="mt-6"
                      onClick={() => setIsSuccess(false)}
                    >
                      Send Another Message
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Name
                      </Label>
                      <Input
                        id="name"
                        placeholder="Your name"
                        {...register("name")}
                        aria-invalid={errors.name ? true : undefined}
                      />
                      {errors.name && (
                        <p className="text-sm text-destructive">{errors.name.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email" className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Email
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="your@email.com"
                        {...register("email")}
                        aria-invalid={errors.email ? true : undefined}
                      />
                      {errors.email && (
                        <p className="text-sm text-destructive">{errors.email.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="subject" className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Subject
                      </Label>
                      <Input
                        id="subject"
                        placeholder="How can we help?"
                        {...register("subject")}
                        aria-invalid={errors.subject ? true : undefined}
                      />
                      {errors.subject && (
                        <p className="text-sm text-destructive">{errors.subject.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="message">Message</Label>
                      <textarea
                        id="message"
                        rows={5}
                        placeholder="Tell us more about your inquiry..."
                        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        {...register("message")}
                        aria-invalid={!!errors.message || undefined}
                      />
                      {errors.message && (
                        <p className="text-sm text-destructive">{errors.message.message}</p>
                      )}
                    </div>

                    {error && (
                      <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                        {error}
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full gap-2"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          Send Message
                        </>
                      )}
                    </Button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer variant="simple" />
    </div>
  );
}
