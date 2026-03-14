"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Bell } from "lucide-react";
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
import type { Reminder } from "@/types";

const REMINDER_TYPES = ["Follow Up", "Interview", "Deadline", "Custom"] as const;

interface ReminderFormProps {
  applicationId?: string;
  reminder?: Reminder;
  onSuccess?: () => void;
}

export function ReminderForm({ applicationId, reminder, onSuccess }: ReminderFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getDefaultDateTime = () => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    date.setHours(9, 0, 0, 0);
    return date.toISOString().slice(0, 16);
  };

  const [formData, setFormData] = useState({
    type: reminder?.type || "Follow Up",
    title: reminder?.title || "",
    description: reminder?.description || "",
    remind_at: reminder?.remind_at
      ? new Date(reminder.remind_at).toISOString().slice(0, 16)
      : getDefaultDateTime(),
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

      const reminderData = {
        user_id: user.id,
        application_id: applicationId || null,
        type: formData.type,
        title: formData.title,
        description: formData.description || null,
        remind_at: new Date(formData.remind_at).toISOString(),
      };

      if (reminder) {
        const { error } = await supabase
          .from("reminders")
          .update(reminderData)
          .eq("id", reminder.id);

        if (error) throw error;
        toast.success("Reminder updated");
      } else {
        const { error } = await supabase.from("reminders").insert(reminderData);
        if (error) throw error;
        toast.success("Reminder created");
      }

      setOpen(false);
      setFormData({
        type: "Follow Up",
        title: "",
        description: "",
        remind_at: getDefaultDateTime(),
      });
      router.refresh();
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save reminder");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          New Reminder
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            {reminder ? "Edit Reminder" : "Create Reminder"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="e.g., Follow up with recruiter"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REMINDER_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="remind_at">Remind At *</Label>
              <Input
                id="remind_at"
                type="datetime-local"
                value={formData.remind_at}
                onChange={(e) => setFormData({ ...formData, remind_at: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Additional details..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {reminder ? "Update" : "Create"} Reminder
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
