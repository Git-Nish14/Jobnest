"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
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

const INTERVIEW_TYPES = [
  "Phone Screen",
  "Technical",
  "Behavioral",
  "On-site",
  "Panel",
  "Final",
  "Other",
] as const;

const INTERVIEW_STATUSES = [
  "Scheduled",
  "Completed",
  "Cancelled",
  "Rescheduled",
  "No Show",
] as const;

interface InterviewFormProps {
  applicationId: string;
  interview?: Interview;
  onSuccess?: () => void;
}

export function InterviewForm({ applicationId, interview, onSuccess }: InterviewFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
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
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

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
        type: formData.type,
        status: formData.status,
        round: formData.round,
        scheduled_at: new Date(formData.scheduled_at).toISOString(),
        duration_minutes: formData.duration_minutes,
        location: formData.location || null,
        meeting_url: formData.meeting_url || null,
        interviewer_names: formData.interviewer_names
          ? formData.interviewer_names.split(",").map((n) => n.trim())
          : null,
        preparation_notes: formData.preparation_notes || null,
        post_interview_notes: formData.post_interview_notes || null,
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
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Interview Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value as any })}
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="round">Round</Label>
              <Input
                id="round"
                type="number"
                min="1"
                value={formData.round}
                onChange={(e) =>
                  setFormData({ ...formData, round: parseInt(e.target.value) || 1 })
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="scheduled_at">Date & Time *</Label>
              <Input
                id="scheduled_at"
                type="datetime-local"
                value={formData.scheduled_at}
                onChange={(e) =>
                  setFormData({ ...formData, scheduled_at: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                min="15"
                max="480"
                value={formData.duration_minutes}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    duration_minutes: parseInt(e.target.value) || 60,
                  })
                }
              />
            </div>
          </div>

          {interview && (
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData({ ...formData, status: value as any })
                }
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
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="meeting_url">Meeting URL</Label>
            <Input
              id="meeting_url"
              type="url"
              placeholder="https://zoom.us/j/..."
              value={formData.meeting_url}
              onChange={(e) =>
                setFormData({ ...formData, meeting_url: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              placeholder="Office address or 'Remote'"
              value={formData.location}
              onChange={(e) =>
                setFormData({ ...formData, location: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="interviewer_names">Interviewer Names</Label>
            <Input
              id="interviewer_names"
              placeholder="John Doe, Jane Smith"
              value={formData.interviewer_names}
              onChange={(e) =>
                setFormData({ ...formData, interviewer_names: e.target.value })
              }
            />
            <p className="text-xs text-muted-foreground">
              Separate multiple names with commas
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="preparation_notes">Preparation Notes</Label>
            <Textarea
              id="preparation_notes"
              placeholder="Topics to review, questions to ask..."
              value={formData.preparation_notes}
              onChange={(e) =>
                setFormData({ ...formData, preparation_notes: e.target.value })
              }
              rows={3}
            />
          </div>

          {interview && (
            <div className="space-y-2">
              <Label htmlFor="post_interview_notes">Post-Interview Notes</Label>
              <Textarea
                id="post_interview_notes"
                placeholder="How did it go? Key takeaways..."
                value={formData.post_interview_notes}
                onChange={(e) =>
                  setFormData({ ...formData, post_interview_notes: e.target.value })
                }
                rows={3}
              />
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
