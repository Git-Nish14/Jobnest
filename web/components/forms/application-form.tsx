"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Upload, X, FileText } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { uploadFile } from "@/lib/utils/storage";
import { applicationSchema, type ApplicationFormData } from "@/lib/validations/application";
import { APPLICATION_STATUSES } from "@/config";
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";

interface ApplicationFormProps {
  application?: JobApplication;
  userId: string;
}

export function ApplicationForm({ application, userId }: ApplicationFormProps) {
  const router = useRouter();
  const isEditing = !!application;

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
    },
  });

  const currentStatus = watch("status");

  const onSubmit = async (data: ApplicationFormData) => {
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
      toast.error(err instanceof Error ? err.message : "An error occurred");
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
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? "Edit Application" : "New Application"}</CardTitle>
        <CardDescription>
          {isEditing
            ? "Update the details of your job application"
            : "Track a new job application"}
        </CardDescription>
      </CardHeader>
      <CardContent>
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

          {/* Status & Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          {/* File Uploads */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Resume (PDF)</Label>
              <div className="flex items-center gap-2">
                <label className="flex-1 cursor-pointer">
                  <div className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg hover:border-primary/50 transition-colors">
                    {resumeFile ? (
                      <>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm truncate">{resumeFile.name}</span>
                      </>
                    ) : application?.resume_path ? (
                      <>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Current file uploaded</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          Upload PDF
                        </span>
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
                  <div className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg hover:border-primary/50 transition-colors">
                    {coverLetterFile ? (
                      <>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm truncate">
                          {coverLetterFile.name}
                        </span>
                      </>
                    ) : application?.cover_letter_path ? (
                      <>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Current file uploaded</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          Upload PDF
                        </span>
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
      </CardContent>
    </Card>
  );
}
