"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { getNetworkErrorMessage } from "@/lib/utils/fetch-retry";
import { contactFormSchema, type ContactFormData } from "@/lib/validations/forms";
import {
  Button,
  Input,
  Label,
  Textarea,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import type { Contact } from "@/types";
import { OUTREACH_STATUSES, type OutreachStatus } from "@/types/networking";

interface ContactFormProps {
  applicationId?: string;
  contact?: Contact;
  onSuccess?: () => void;
}

export function ContactForm({ applicationId, contact, onSuccess }: ContactFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const submittingRef = useRef(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: contact?.name || "",
      title: contact?.title || "",
      company: contact?.company || "",
      school: contact?.school || "",
      email: contact?.email || "",
      phone: contact?.phone || "",
      linkedin_url: contact?.linkedin_url || "",
      notes: contact?.notes || "",
      is_primary: contact?.is_primary || false,
      outreach_status: (OUTREACH_STATUSES as readonly string[]).includes(contact?.outreach_status ?? "")
        ? (contact!.outreach_status as OutreachStatus)
        : "Not Contacted",
    },
  });

  const isPrimary = watch("is_primary");
  const outreachStatus = watch("outreach_status");

  const onSubmit = async (data: ContactFormData) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
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
        name: data.name,
        title: data.title || null,
        company: data.company || null,
        school: data.school || null,
        email: data.email || null,
        phone: data.phone || null,
        linkedin_url: data.linkedin_url || null,
        notes: data.notes || null,
        is_primary: data.is_primary,
        outreach_status: data.outreach_status ?? "Not Contacted",
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
      reset({
        name: "",
        title: "",
        company: "",
        school: "",
        email: "",
        phone: "",
        linkedin_url: "",
        notes: "",
        is_primary: false,
        outreach_status: "Not Contacted",
      });
      router.refresh();
      onSuccess?.();
    } catch (err) {
      toast.error(getNetworkErrorMessage(err));
    } finally {
      submittingRef.current = false;
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen && !contact) {
      reset({
        name: "",
        title: "",
        company: "",
        school: "",
        email: "",
        phone: "",
        linkedin_url: "",
        notes: "",
        is_primary: false,
        outreach_status: "Not Contacted",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
          <DialogDescription className="sr-only">
            {contact ? "Update this contact's name, company, and details." : "Add a new networking contact with their name, company, and role."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="John Doe"
                {...register("name")}
                className={errors.name ? "border-destructive" : ""}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="Recruiter, Hiring Manager..."
                {...register("title")}
                className={errors.title ? "border-destructive" : ""}
              />
              {errors.title && (
                <p className="text-sm text-destructive">{errors.title.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                placeholder="Acme Corp"
                {...register("company")}
                className={errors.company ? "border-destructive text-[16px] sm:text-sm" : "text-[16px] sm:text-sm"}
              />
              {errors.company && (
                <p className="text-sm text-destructive">{errors.company.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="school">School <span className="text-muted-foreground font-normal text-xs">(alumni)</span></Label>
              <Input
                id="school"
                placeholder="MIT, Georgia Tech…"
                {...register("school")}
                className={errors.school ? "border-destructive text-[16px] sm:text-sm" : "text-[16px] sm:text-sm"}
              />
              {errors.school && (
                <p className="text-sm text-destructive">{errors.school.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@company.com"
                {...register("email")}
                className={errors.email ? "border-destructive" : ""}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1 (555) 123-4567"
                {...register("phone")}
                className={errors.phone ? "border-destructive" : ""}
              />
              {errors.phone && (
                <p className="text-sm text-destructive">{errors.phone.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="linkedin_url">LinkedIn Profile</Label>
            <Input
              id="linkedin_url"
              type="url"
              placeholder="https://linkedin.com/in/johndoe"
              {...register("linkedin_url")}
              className={errors.linkedin_url ? "border-destructive" : ""}
            />
            {errors.linkedin_url && (
              <p className="text-sm text-destructive">{errors.linkedin_url.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="How did you meet? Important details..."
              {...register("notes")}
              rows={3}
              className={errors.notes ? "border-destructive" : ""}
            />
            {errors.notes && (
              <p className="text-sm text-destructive">{errors.notes.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="outreach_status">Outreach Status</Label>
            <Select
              value={outreachStatus ?? "Not Contacted"}
              onValueChange={(v) => setValue("outreach_status", v as OutreachStatus)}
            >
              <SelectTrigger id="outreach_status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OUTREACH_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_primary"
              checked={isPrimary}
              onChange={(e) => setValue("is_primary", e.target.checked)}
              className="rounded"
              aria-label="Primary contact for this application"
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
