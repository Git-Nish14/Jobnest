"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Upload, X, FileText, Sparkles, Link, AlignLeft } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { uploadFile } from "@/lib/utils/storage";
import { applicationSchema, type ApplicationFormData } from "@/lib/validations/application";
import { getNetworkErrorMessage } from "@/lib/utils/fetch-retry";
import { APPLICATION_STATUSES, APPLICATION_SOURCES } from "@/config";
import type { JobApplication } from "@/types";
import {
  Button,
  Input,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";

interface ApplicationFormProps {
  application?: JobApplication;
  userId: string;
}

export function ApplicationForm({ application, userId }: ApplicationFormProps) {
  const router = useRouter();
  const isEditing = !!application;
  const submittingRef = useRef(false);

  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [coverLetterFile, setCoverLetterFile] = useState<File | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ApplicationFormData>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      company: application?.company || "",
      position: application?.position || "",
      status: application?.status || "Applied",
      applied_date:
        application?.applied_date || new Date().toISOString().split("T")[0],
      job_id: application?.job_id || "",
      job_url: application?.job_url || "",
      salary_range: application?.salary_range || "",
      location: application?.location || "",
      notes: application?.notes || "",
      job_description: application?.job_description || "",
      source: (application?.source as ApplicationFormData["source"]) || "",
    },
  });

  const currentStatus = watch("status");
  const currentSource = watch("source");

  // ── JD Parser ────────────────────────────────────────────────────────────
  const [parseModalOpen, setParseModalOpen] = useState(false);
  const [parseTab, setParseTab] = useState<"url" | "text">("url");
  const [parseUrl, setParseUrl] = useState("");
  const [parseText, setParseText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const handleParse = useCallback(async () => {
    setParseError(null);
    setParsing(true);
    try {
      const body = parseTab === "url"
        ? { url: parseUrl.trim() }
        : { text: parseText.trim() };
      const res = await fetch("/api/applications/parse-jd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json() as {
        company?: string | null;
        position?: string | null;
        location?: string | null;
        salary_range?: string | null;
        job_description?: string | null;
        fetchFailed?: boolean;
        error?: string;
      };

      if (data.fetchFailed) {
        setParseTab("text");
        setParseError(data.error ?? "Couldn't fetch that URL — paste the text instead.");
        setParsing(false);
        return;
      }
      if (!res.ok) {
        setParseError(data.error ?? "Failed to parse. Please try again.");
        setParsing(false);
        return;
      }

      // Pre-fill form fields with extracted values
      if (data.company)         setValue("company",         data.company);
      if (data.position)        setValue("position",        data.position);
      if (data.location)        setValue("location",        data.location ?? "");
      if (data.salary_range)    setValue("salary_range",    data.salary_range ?? "");
      if (data.job_description) setValue("job_description", data.job_description);

      setParseModalOpen(false);
      setParseUrl("");
      setParseText("");
      toast.success("Job posting imported — review and edit the fields below.");
    } catch {
      setParseError("Request failed. Check your connection and try again.");
    } finally {
      setParsing(false);
    }
  }, [parseTab, parseUrl, parseText, setValue]);

  const onSubmit = async (data: ApplicationFormData) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    const supabase = createClient();

    try {
      let applicationId = application?.id;
      let resumePath = application?.resume_path;
      let coverLetterPath = application?.cover_letter_path;

      // Clean up empty strings to null
      const cleanData = {
        ...data,
        job_id: data.job_id || null,
        job_url: data.job_url || null,
        salary_range: data.salary_range || null,
        location: data.location || null,
        notes: data.notes || null,
        job_description: data.job_description || null,
        source: data.source || null,
      };

      if (isEditing) {
        const { error: updateError } = await supabase
          .from("job_applications")
          .update({
            ...cleanData,
            updated_at: new Date().toISOString(),
          })
          .eq("id", application.id);

        if (updateError) throw updateError;
        toast.success("Application updated successfully");
      } else {
        const { data: newApp, error: insertError } = await supabase
          .from("job_applications")
          .insert({
            ...cleanData,
            user_id: userId,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        applicationId = newApp.id;
        toast.success("Application created successfully");
      }

      // Upload files if provided
      if (resumeFile && applicationId) {
        resumePath = await uploadFile(
          supabase,
          userId,
          applicationId,
          resumeFile,
          "resume"
        );
      }

      if (coverLetterFile && applicationId) {
        coverLetterPath = await uploadFile(
          supabase,
          userId,
          applicationId,
          coverLetterFile,
          "cover_letter"
        );
      }

      // Update file paths if files were uploaded
      if ((resumeFile || coverLetterFile) && applicationId) {
        const { error: fileUpdateError } = await supabase
          .from("job_applications")
          .update({
            resume_path: resumePath,
            cover_letter_path: coverLetterPath,
          })
          .eq("id", applicationId);

        if (fileUpdateError) throw fileUpdateError;
      }

      router.push("/applications");
      router.refresh();
    } catch (err) {
      toast.error(getNetworkErrorMessage(err));
    } finally {
      submittingRef.current = false;
    }
  };

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "resume" | "coverLetter"
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size must be less than 5MB");
        return;
      }
      if (file.type !== "application/pdf") {
        toast.error("Only PDF files are allowed");
        return;
      }
      if (type === "resume") {
        setResumeFile(file);
      } else {
        setCoverLetterFile(file);
      }
    }
  };

  return (
    <div className="db-content-card">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="db-headline text-2xl font-semibold text-[#1a1c1b]">
            {isEditing ? "Edit Application" : "New Application"}
          </h2>
          <p className="text-sm text-[#55433d]/70 mt-1">
            {isEditing ? "Update the details of your job application" : "Track a new job application"}
          </p>
        </div>
        {!isEditing && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5"
            onClick={() => { setParseModalOpen(true); setParseError(null); }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Import from job posting
          </Button>
        )}
      </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Company & Position */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company">Company *</Label>
              <Input
                id="company"
                placeholder="e.g., Google"
                {...register("company")}
                className={errors.company ? "border-destructive" : ""}
              />
              {errors.company && (
                <p className="text-sm text-destructive">
                  {errors.company.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="position">Position *</Label>
              <Input
                id="position"
                placeholder="e.g., Software Engineer"
                {...register("position")}
                className={errors.position ? "border-destructive" : ""}
              />
              {errors.position && (
                <p className="text-sm text-destructive">
                  {errors.position.message}
                </p>
              )}
            </div>
          </div>

          {/* Status, Source & Date */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={currentStatus}
                onValueChange={(value) =>
                  setValue("status", value as ApplicationFormData["status"])
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {APPLICATION_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="source">Source</Label>
              <Select
                value={currentSource || ""}
                onValueChange={(value) =>
                  setValue("source", (value || "") as ApplicationFormData["source"])
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Where did you find it?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— Not specified —</SelectItem>
                  {APPLICATION_SOURCES.map((src) => (
                    <SelectItem key={src} value={src}>
                      {src}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="applied_date">Applied Date</Label>
              <Input
                id="applied_date"
                type="date"
                {...register("applied_date")}
                className={errors.applied_date ? "border-destructive" : ""}
              />
              {errors.applied_date && (
                <p className="text-sm text-destructive">
                  {errors.applied_date.message}
                </p>
              )}
            </div>
          </div>

          {/* Job ID & URL */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="job_id">Job ID</Label>
              <Input
                id="job_id"
                placeholder="e.g., JOB-12345"
                {...register("job_id")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="job_url">Job URL</Label>
              <Input
                id="job_url"
                type="url"
                placeholder="https://..."
                {...register("job_url")}
                className={errors.job_url ? "border-destructive" : ""}
              />
              {errors.job_url && (
                <p className="text-sm text-destructive">
                  {errors.job_url.message}
                </p>
              )}
            </div>
          </div>

          {/* Salary & Location */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="salary_range">Salary Range</Label>
              <Input
                id="salary_range"
                placeholder="e.g., $100k - $150k"
                {...register("salary_range")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                placeholder="e.g., Remote, New York, NY"
                {...register("location")}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Interview notes, contacts, etc."
              {...register("notes")}
            />
          </div>

          {/* Job Description */}
          <div className="space-y-2">
            <Label htmlFor="job_description">
              Job Description
              <span className="ml-1.5 text-xs text-[#55433d]/50 font-normal">
                (paste the full JD — powers ATS scan &amp; NESTAi tailoring)
              </span>
            </Label>
            <Textarea
              id="job_description"
              placeholder="Paste the full job description here…"
              rows={6}
              {...register("job_description")}
              className={errors.job_description ? "border-destructive" : ""}
            />
            {errors.job_description && (
              <p className="text-sm text-destructive">
                {errors.job_description.message}
              </p>
            )}
          </div>

          {/* File Uploads */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Resume (PDF)</Label>
              <div className="flex items-center gap-2">
                <label className="flex-1 cursor-pointer">
                  <div className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-[#dbc1b9]/50 rounded-lg hover:border-[#99462a]/40 hover:bg-[#99462a]/5 transition-colors">
                    {resumeFile ? (
                      <>
                        <FileText className="h-4 w-4 text-[#55433d]/60" />
                        <span className="text-sm truncate">{resumeFile.name}</span>
                      </>
                    ) : application?.resume_path ? (
                      <>
                        <FileText className="h-4 w-4 text-[#55433d]/60" />
                        <span className="text-sm">Current file uploaded</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 text-[#55433d]/50" />
                        <span className="text-sm text-[#55433d]/50">Upload PDF</span>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => handleFileChange(e, "resume")}
                  />
                </label>
                {resumeFile && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setResumeFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Cover Letter (PDF)</Label>
              <div className="flex items-center gap-2">
                <label className="flex-1 cursor-pointer">
                  <div className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-[#dbc1b9]/50 rounded-lg hover:border-[#99462a]/40 hover:bg-[#99462a]/5 transition-colors">
                    {coverLetterFile ? (
                      <>
                        <FileText className="h-4 w-4 text-[#55433d]/60" />
                        <span className="text-sm truncate">
                          {coverLetterFile.name}
                        </span>
                      </>
                    ) : application?.cover_letter_path ? (
                      <>
                        <FileText className="h-4 w-4 text-[#55433d]/60" />
                        <span className="text-sm">Current file uploaded</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 text-[#55433d]/50" />
                        <span className="text-sm text-[#55433d]/50">Upload PDF</span>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => handleFileChange(e, "coverLetter")}
                  />
                </label>
                {coverLetterFile && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setCoverLetterFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isEditing ? "Save Changes" : "Create Application"}
            </Button>
          </div>
        </form>

      {/* ── JD Parser modal ────────────────────────────────────────────── */}
      {parseModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setParseModalOpen(false)}
        >
          <div
            className="bg-[#faf9f7] dark:bg-[#0a0a0a] rounded-2xl border shadow-2xl w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#99462a]" />
                <span className="font-semibold text-sm">Import from job posting</span>
              </div>
              <button
                type="button"
                onClick={() => setParseModalOpen(false)}
                className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Tab selector */}
              <div className="flex rounded-lg border overflow-hidden">
                <button
                  type="button"
                  onClick={() => { setParseTab("url"); setParseError(null); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-colors ${parseTab === "url" ? "bg-[#99462a] text-white" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Link className="h-3.5 w-3.5" /> URL
                </button>
                <button
                  type="button"
                  onClick={() => { setParseTab("text"); setParseError(null); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-colors ${parseTab === "text" ? "bg-[#99462a] text-white" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <AlignLeft className="h-3.5 w-3.5" /> Paste text
                </button>
              </div>

              {parseTab === "url" ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Job posting URL</label>
                  <input
                    type="url"
                    value={parseUrl}
                    onChange={(e) => setParseUrl(e.target.value)}
                    placeholder="https://example.com/jobs/senior-engineer"
                    className="w-full rounded-lg border border-[#dbc1b9]/50 bg-[#f4f3f1] px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-[#99462a]/40"
                  />
                  <p className="text-[11px] text-muted-foreground">Works for most public job pages. LinkedIn and Indeed may block auto-fetch — use Paste text instead.</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Job description text</label>
                  <textarea
                    value={parseText}
                    onChange={(e) => setParseText(e.target.value)}
                    placeholder="Paste the full job posting here…"
                    rows={8}
                    className="w-full rounded-lg border border-[#dbc1b9]/50 bg-[#f4f3f1] px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-[#99462a]/40 resize-none"
                  />
                </div>
              )}

              {parseError && (
                <p className="text-xs text-destructive bg-destructive/8 border border-destructive/20 rounded-lg px-3 py-2">
                  {parseError}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={() => setParseModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={parsing || (parseTab === "url" ? !parseUrl.trim() : parseText.trim().length < 50)}
                  onClick={handleParse}
                >
                  {parsing ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Extracting…</> : <><Sparkles className="mr-1.5 h-3.5 w-3.5" />Import fields</>}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
