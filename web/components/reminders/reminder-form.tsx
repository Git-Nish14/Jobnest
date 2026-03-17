"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Bell } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  reminderSchema,
  type ReminderFormData,
  REMINDER_TYPES,
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
import type { Reminder } from "@/types";

interface ReminderFormProps {
  applicationId?: string;
  reminder?: Reminder;
  onSuccess?: () => void;
}

function getDefaultDateTime(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return date.toISOString().slice(0, 16);
}

export function ReminderForm({ applicationId, reminder, onSuccess }: ReminderFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ReminderFormData>({
    resolver: zodResolver(reminderSchema),
    defaultValues: {
      type: reminder?.type || "Follow Up",
      title: reminder?.title || "",
      description: reminder?.description || "",
      remind_at: reminder?.remind_at
        ? new Date(reminder.remind_at).toISOString().slice(0, 16)
        : getDefaultDateTime(),
    },
  });

  const currentType = watch("type");

  const onSubmit = async (data: ReminderFormData) => {
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
        type: data.type,
        title: data.title,
        description: data.description || null,
        remind_at: new Date(data.remind_at).toISOString(),
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
      reset({
        type: "Follow Up",
        title: "",
        description: "",
        remind_at: getDefaultDateTime(),
      });
      router.refresh();
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save reminder");
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen && !reminder) {
      reset({
        type: "Follow Up",
        title: "",
        description: "",
        remind_at: getDefaultDateTime(),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="e.g., Follow up with recruiter"
              {...register("title")}
              className={errors.title ? "border-destructive" : ""}
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select
                value={currentType}
                onValueChange={(value) => setValue("type", value as ReminderFormData["type"])}
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
              {errors.type && (
                <p className="text-sm text-destructive">{errors.type.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="remind_at">Remind At *</Label>
              <Input
                id="remind_at"
                type="datetime-local"
                {...register("remind_at")}
                className={errors.remind_at ? "border-destructive" : ""}
              />
              {errors.remind_at && (
                <p className="text-sm text-destructive">{errors.remind_at.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Additional details..."
              {...register("description")}
              rows={3}
              className={errors.description ? "border-destructive" : ""}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            )}
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
