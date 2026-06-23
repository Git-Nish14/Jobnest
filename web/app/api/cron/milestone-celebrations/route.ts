import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendApplicationMilestoneEmail, sendOfferMilestoneEmail } from "@/lib/email/nodemailer";
import { createNotification } from "@/lib/notifications/create";

// Runs every 3h at 0,3,6,9,12,15,18,21 UTC.
// Processes users whose local time is in the 8–10am window so they get the
// email at a reasonable hour regardless of timezone — including fractional
// offsets (UTC+5:30, UTC+9:30, UTC+3:30, etc.).

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const results = { sent: 0, skipped: 0, errors: [] as string[] };

  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data: usersPage, error: usersErr } = await admin.auth.admin.listUsers({ page, perPage });
    if (usersErr) { results.errors.push(`listUsers p${page}: ${usersErr.message}`); break; }

    const users = usersPage?.users ?? [];
    if (users.length === 0) break;
    page++;

    for (const user of users) {
      try {
        if (!user.email) { results.skipped++; continue; }

        // ── Opt-out check ───────────────────────────────────────────────────
        if (user.user_metadata?.notification_prefs?.milestone_emails === false) {
          results.skipped++; continue;
        }

        // ── Timezone window filter ──────────────────────────────────────────
        // Only send in the 8am–10am local window. Default to UTC if timezone
        // has not been captured yet (first few days after deploy).
        const utcOffsetHours: number = user.user_metadata?.utc_offset_hours ?? 0;
        const localHour = ((now.getUTCHours() + utcOffsetHours) % 24 + 24) % 24;
        if (localHour < 8 || localHour >= 10) { results.skipped++; continue; }

        const userId = user.id;
        const displayName: string =
          user.user_metadata?.display_name ?? user.user_metadata?.full_name ?? "";

        // ── Fetch counts ────────────────────────────────────────────────────
        const [
          { count: totalAppsRaw },
          { count: offerCountRaw },
        ] = await Promise.all([
          admin.from("job_applications").select("id", { count: "exact", head: true }).eq("user_id", userId),
          admin.from("job_applications").select("id", { count: "exact", head: true })
            .eq("user_id", userId).in("status", ["Offer", "Accepted"]),
        ]);

        const totalApps = totalAppsRaw ?? 0;
        const offerCount = offerCountRaw ?? 0;

        // Accumulate metadata updates so both milestones (if both fire) are
        // written in a single updateUserById call — prevents the second write
        // from spreading stale user_metadata and overwriting the first update.
        const metadataUpdates: Record<string, unknown> = {};
        let emailsSent = 0;

        // ── Application count milestone (every 100) ─────────────────────────
        const lastAppMilestone: number = user.user_metadata?.app_milestone_last ?? 0;
        const nextAppMilestone = lastAppMilestone + 100;

        if (totalApps >= nextAppMilestone) {
          const milestone = Math.floor(totalApps / 100) * 100;

          // Fetch extra stats for the email body
          const [
            { count: respondedRaw },
            { count: pipelineRaw },
          ] = await Promise.all([
            admin.from("job_applications").select("id", { count: "exact", head: true })
              .eq("user_id", userId).in("status", ["Phone Screen", "Interview", "Offer", "Accepted", "Rejected"]),
            admin.from("job_applications").select("id", { count: "exact", head: true })
              .eq("user_id", userId).in("status", ["Phone Screen", "Interview"]),
          ]);

          const responseRate = totalApps > 0
            ? Math.round(((respondedRaw ?? 0) / totalApps) * 100)
            : 0;

          const { success, error: emailErr } = await sendApplicationMilestoneEmail(
            user.email,
            displayName,
            milestone,
            { responseRate, activePipeline: pipelineRaw ?? 0, totalOffers: offerCount },
          );

          if (!success) {
            results.errors.push(`${user.email} app-milestone: ${emailErr}`);
          } else {
            await createNotification({
              userId,
              type: "system",
              title: `🎉 ${milestone.toLocaleString("en-US")}-application milestone!`,
              body: `You've submitted ${milestone.toLocaleString("en-US")} job applications. Keep the momentum going!`,
              link: "/applications",
              sourceType: "app_milestone",
              sourceId: String(milestone),
            });

            // Stage update — written as one batch at the end of this user's loop
            metadataUpdates.app_milestone_last = milestone;
            emailsSent++;
            console.log(`[cron/milestone] app milestone ${milestone} → ${user.email}`);
          }
        }

        // ── Offer count milestone (every 10) ───────────────────────────────
        if (offerCount >= 10) {
          const lastOfferMilestone: number = user.user_metadata?.offer_milestone_last ?? 0;
          const nextOfferMilestone = lastOfferMilestone + 10;

          if (offerCount >= nextOfferMilestone) {
            const offerMilestone = Math.floor(offerCount / 10) * 10;

            const { success, error: emailErr } = await sendOfferMilestoneEmail(
              user.email,
              displayName,
              offerMilestone,
              totalApps,
            );

            if (!success) {
              results.errors.push(`${user.email} offer-milestone: ${emailErr}`);
            } else {
              await createNotification({
                userId,
                type: "system",
                title: `🏆 ${offerMilestone} offers received!`,
                body: `${offerMilestone} companies have made you an offer. That's extraordinary — you're being chosen!`,
                link: "/salary",
                sourceType: "offer_milestone",
                sourceId: String(offerMilestone),
              });

              // Stage update — written as one batch at the end of this user's loop
              metadataUpdates.offer_milestone_last = offerMilestone;
              emailsSent++;
              console.log(`[cron/milestone] offer milestone ${offerMilestone} → ${user.email}`);
            }
          }
        }

        // ── Flush all metadata updates in a single write ────────────────────
        // Batching prevents the second update from spreading stale
        // user.user_metadata and silently undoing the first update's keys.
        if (Object.keys(metadataUpdates).length > 0) {
          await admin.auth.admin.updateUserById(userId, {
            user_metadata: { ...user.user_metadata, ...metadataUpdates },
          });
          results.sent += emailsSent;
        } else {
          results.skipped++;
        }
      } catch (err) {
        results.errors.push(`user ${user.id}: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }

    if (users.length < perPage) break;
  }

  console.log("[cron/milestone-celebrations] done", results);
  return NextResponse.json({ ok: true, ...results });
}
