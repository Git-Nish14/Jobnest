"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  interviewSchema,
  type InterviewFormData,
  INTERVIEW_TYPES,
  INTERVIEW_STATUSES,
} from "@/lib/validations/forms";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui";
import type { Interview } from "@/types";

interface InterviewFormProps {
  applicationId: string;
  interview?: Interview;
  onSuccess?: () => void;
}

export function InterviewForm({ applicationId, interview, onSuccess }: InterviewFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InterviewFormData>({
    resolver: zodResolver(interviewSchema),
    defaultValues: {
      type: interview?.type || "Phone Screen",
      status: interview?.status || "Scheduled",
      round: interview?.round || 1,
      scheduled_at: interview?.scheduled_at
        ? new Date(interview.scheduled_at).toISOString().slice(0, 16)
        : "",
      duration_minutes: interview?.duration_minutes || 60,
      location: interview?.location || "",
      meeting_url: interview?.meeting_url || "",
      interviewer_names: interview?.interviewer_names?.join(", ") || "",
      preparation_notes: interview?.preparation_notes || "",
      post_interview_notes: interview?.post_interview_notes || "",
    },
  });

  const currentType = watch("type");
  const currentStatus = watch("status");

  const onSubmit = async (data: InterviewFormData) => {
    const supabase = createClient();

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error("Not authenticated");
        return;
      }

      const interviewData = {
        application_id: applicationId,
        user_id: user.id,
        type: data.type,
        status: data.status,
        round: data.round,
        scheduled_at: new Date(data.scheduled_at).toISOString(),
        duration_minutes: data.duration_minutes,
        location: data.location || null,
        meeting_url: data.meeting_url || null,
        interviewer_names: data.interviewer_names
          ? data.interviewer_names.split(",").map((n) => n.trim()).filter(Boolean)
          : null,
        preparation_notes: data.preparation_notes || null,
        post_interview_notes: data.post_interview_notes || null,
      };

      if (interview) {
        const { error } = await supabase
          .from("interviews")
          .update(interviewData)
          .eq("id", interview.id);

        if (error) throw error;
        toast.success("Interview updated");
      } else {
        const { error } = await supabase.from("interviews").insert(interviewData);
        if (error) throw error;
        toast.success("Interview scheduled");
      }

      setOpen(false);
      router.refresh();
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save interview");
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant={interview ? "outline" : "default"} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          {interview ? "Edit Interview" : "Schedule Interview"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {interview ? "Edit Interview" : "Schedule New Interview"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Interview Type</Label>
              <Select
                value={currentType}
                onValueChange={(value) => setValue("type", value as InterviewFormData["type"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERVIEW_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.type && (
                <p className="text-sm text-destructive">{errors.type.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="round">Round</Label>
              <Input
                id="round"
                type="number"
                min="1"
                max="20"
                {...register("round")}
                className={errors.round ? "border-destructive" : ""}
              />
              {errors.round && (
                <p className="text-sm text-destructive">{errors.round.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="scheduled_at">Date & Time *</Label>
              <Input
                id="scheduled_at"
                type="datetime-local"
                {...register("scheduled_at")}
                className={errors.scheduled_at ? "border-destructive" : ""}
              />
              {errors.scheduled_at && (
                <p className="text-sm text-destructive">{errors.scheduled_at.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration_minutes">Duration (minutes)</Label>
              <Input
                id="duration_minutes"
                type="number"
                min="15"
                max="480"
                {...register("duration_minutes")}
                className={errors.duration_minutes ? "border-destructive" : ""}
              />
              {errors.duration_minutes && (
                <p className="text-sm text-destructive">{errors.duration_minutes.message}</p>
              )}
            </div>
          </div>

          {interview && (
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={currentStatus}
                onValueChange={(value) => setValue("status", value as InterviewFormData["status"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERVIEW_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.status && (
                <p className="text-sm text-destructive">{errors.status.message}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="meeting_url">Meeting URL</Label>
            <Input
              id="meeting_url"
              type="url"
              placeholder="https://zoom.us/j/..."
              {...register("meeting_url")}
              className={errors.meeting_url ? "border-destructive" : ""}
            />
            {errors.meeting_url && (
              <p className="text-sm text-destructive">{errors.meeting_url.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              placeholder="Office address or 'Remote'"
              {...register("location")}
              className={errors.location ? "border-destructive" : ""}
            />
            {errors.location && (
              <p className="text-sm text-destructive">{errors.location.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="interviewer_names">Interviewer Names</Label>
            <Input
              id="interviewer_names"
              placeholder="John Doe, Jane Smith"
              {...register("interviewer_names")}
              className={errors.interviewer_names ? "border-destructive" : ""}
            />
            <p className="text-xs text-muted-foreground">
              Separate multiple names with commas
            </p>
            {errors.interviewer_names && (
              <p className="text-sm text-destructive">{errors.interviewer_names.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="preparation_notes">Preparation Notes</Label>
            <Textarea
              id="preparation_notes"
              placeholder="Topics to review, questions to ask..."
              {...register("preparation_notes")}
              rows={3}
              className={errors.preparation_notes ? "border-destructive" : ""}
            />
            {errors.preparation_notes && (
              <p className="text-sm text-destructive">{errors.preparation_notes.message}</p>
            )}
          </div>

          {interview && (
            <div className="space-y-2">
              <Label htmlFor="post_interview_notes">Post-Interview Notes</Label>
              <Textarea
                id="post_interview_notes"
                placeholder="How did it go? Key takeaways..."
                {...register("post_interview_notes")}
                rows={3}
                className={errors.post_interview_notes ? "border-destructive" : ""}
              />
              {errors.post_interview_notes && (
                <p className="text-sm text-destructive">{errors.post_interview_notes.message}</p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {interview ? "Update Interview" : "Schedule Interview"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
