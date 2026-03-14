"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ROUTES } from "@/config/constants";
import type { JobApplicationInsert, JobApplicationUpdate } from "@/types";

interface UseApplicationsReturn {
  isPending: boolean;
  error: string | null;
  createApplication: (data: JobApplicationInsert) => Promise<boolean>;
  updateApplication: (id: string, data: JobApplicationUpdate) => Promise<boolean>;
  deleteApplication: (id: string) => Promise<boolean>;
}

export function useApplications(): UseApplicationsReturn {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const supabase = createClient();

  const createApplication = useCallback(
    async (data: JobApplicationInsert): Promise<boolean> => {
      setError(null);

      const { error: insertError } = await supabase
        .from("job_applications")
        .insert(data);

      if (insertError) {
        setError(insertError.message);
        return false;
      }

      startTransition(() => {
        router.push(ROUTES.APPLICATIONS);
        router.refresh();
      });

      return true;
    },
    [supabase, router]
  );

  const updateApplication = useCallback(
    async (id: string, data: JobApplicationUpdate): Promise<boolean> => {
      setError(null);

      const { error: updateError } = await supabase
        .from("job_applications")
        .update(data)
        .eq("id", id);

      if (updateError) {
        setError(updateError.message);
        return false;
      }

      startTransition(() => {
        router.push(ROUTES.APPLICATION_DETAIL(id));
        router.refresh();
      });

      return true;
    },
    [supabase, router]
  );

  const deleteApplication = useCallback(
    async (id: string): Promise<boolean> => {
      setError(null);

      const { error: deleteError } = await supabase
        .from("job_applications")
        .delete()
        .eq("id", id);

      if (deleteError) {
        setError(deleteError.message);
        return false;
      }

      startTransition(() => {
        router.push(ROUTES.APPLICATIONS);
        router.refresh();
      });

      return true;
    },
    [supabase, router]
  );

  return {
    isPending,
    error,
    createApplication,
    updateApplication,
    deleteApplication,
  };
}
