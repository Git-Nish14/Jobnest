"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  Button,
  Input,
  Label,
  Textarea,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui";
import type { Contact } from "@/types";

interface ContactFormProps {
  applicationId?: string;
  contact?: Contact;
  onSuccess?: () => void;
}

export function ContactForm({ applicationId, contact, onSuccess }: ContactFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: contact?.name || "",
    title: contact?.title || "",
    email: contact?.email || "",
    phone: contact?.phone || "",
    linkedin_url: contact?.linkedin_url || "",
    notes: contact?.notes || "",
    is_primary: contact?.is_primary || false,
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

      const contactData = {
        user_id: user.id,
        application_id: applicationId || null,
        name: formData.name,
        title: formData.title || null,
        email: formData.email || null,
        phone: formData.phone || null,
        linkedin_url: formData.linkedin_url || null,
        notes: formData.notes || null,
        is_primary: formData.is_primary,
      };

      if (contact) {
        const { error } = await supabase
          .from("contacts")
          .update(contactData)
          .eq("id", contact.id);

        if (error) throw error;
        toast.success("Contact updated");
      } else {
        const { error } = await supabase.from("contacts").insert(contactData);
        if (error) throw error;
        toast.success("Contact added");
      }

      setOpen(false);
      setFormData({
        name: "",
        title: "",
        email: "",
        phone: "",
        linkedin_url: "",
        notes: "",
        is_primary: false,
      });
      router.refresh();
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save contact");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Contact
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            {contact ? "Edit Contact" : "Add Contact"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="Recruiter, Hiring Manager..."
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@company.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="linkedin_url">LinkedIn Profile</Label>
            <Input
              id="linkedin_url"
              type="url"
              placeholder="https://linkedin.com/in/johndoe"
              value={formData.linkedin_url}
              onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="How did you meet? Important details..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_primary"
              checked={formData.is_primary}
              onChange={(e) => setFormData({ ...formData, is_primary: e.target.checked })}
              className="rounded"
            />
            <Label htmlFor="is_primary" className="font-normal cursor-pointer">
              Primary contact for this application
            </Label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {contact ? "Update" : "Add"} Contact
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
