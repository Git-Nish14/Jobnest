"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// Silently syncs the browser's IANA timezone to user_metadata.timezone once per
// session so the weekly-digest cron can deliver emails at the user's local
// Saturday 21:00 instead of a fixed UTC time.
export function TimezoneSync() {
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return;

    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      if (data.user.user_metadata?.timezone === tz) return;
      supabase.auth.updateUser({ data: { timezone: tz } });
    });
  }, []);

  return null;
}
