import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Recursively lists all objects under a storage prefix (Supabase paginates at 100).
async function listAllObjects(
  supabase: ReturnType<typeof createAdminClient>,
  bucket: string,
  prefix = ""
): Promise<Array<{ name: string; metadata?: { size?: number } }>> {
  const all: Array<{ name: string; metadata?: { size?: number } }> = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit, offset, sortBy: { column: "name", order: "asc" } });

    if (error || !data) break;

    for (const item of data) {
      if (item.name && !item.id) {
        // Folder (no id) — recurse
        const children = await listAllObjects(supabase, bucket, prefix ? `${prefix}/${item.name}` : item.name);
        all.push(...children);
      } else if (item.name) {
        all.push({ name: prefix ? `${prefix}/${item.name}` : item.name, metadata: item.metadata as { size?: number } });
      }
    }

    if (data.length < limit) break;
    offset += limit;
  }

  return all;
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const shouldPurge = request.nextUrl.searchParams.get("purge") === "true";

  const admin = createAdminClient();
  const results = {
    storage_objects_scanned: 0,
    db_paths_found: 0,
    orphans_found: 0,
    orphan_bytes: 0,
    purged: 0,
    purge_errors: [] as string[],
  };

  try {
    // 1. List all objects in the "documents" bucket
    const storageObjects = await listAllObjects(admin, "documents");
    results.storage_objects_scanned = storageObjects.length;

    if (storageObjects.length === 0) {
      return NextResponse.json({ ok: true, ...results });
    }

    // 2. Fetch all known storage paths from application_documents
    const { data: dbRows, error: dbError } = await admin
      .from("application_documents")
      .select("storage_path, size_bytes");

    if (dbError) throw new Error(`DB query failed: ${dbError.message}`);

    const knownPaths = new Set((dbRows ?? []).map((r) => r.storage_path));
    results.db_paths_found = knownPaths.size;

    // 3. Find orphans: in storage but not in DB
    const orphans = storageObjects.filter((obj) => !knownPaths.has(obj.name));
    results.orphans_found = orphans.length;
    results.orphan_bytes = orphans.reduce(
      (sum, obj) => sum + (obj.metadata?.size ?? 0),
      0
    );

    console.log(
      `[cron/orphan-cleanup] Scanned ${results.storage_objects_scanned} objects, ` +
      `${results.db_paths_found} known DB paths, ${results.orphans_found} orphans ` +
      `(${results.orphan_bytes} bytes)`
    );

    if (orphans.length > 0) {
      if (shouldPurge) {
        // 4. Delete orphans in batches of 20
        const BATCH = 20;
        for (let i = 0; i < orphans.length; i += BATCH) {
          const batch = orphans.slice(i, i + BATCH).map((o) => o.name);
          const { error: removeError } = await admin.storage.from("documents").remove(batch);
          if (removeError) {
            results.purge_errors.push(removeError.message);
          } else {
            results.purged += batch.length;
          }
        }
        console.log(`[cron/orphan-cleanup] Purged ${results.purged} orphan objects`);
      } else {
        // Log paths for manual review
        console.log("[cron/orphan-cleanup] Orphan paths (run with ?purge=true to delete):");
        orphans.slice(0, 50).forEach((o) => console.log(`  - ${o.name} (${o.metadata?.size ?? 0} bytes)`));
      }
    }

    return NextResponse.json({ ok: true, ...results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[cron/orphan-cleanup] Error:", message);
    return NextResponse.json({ ok: false, error: message, ...results }, { status: 500 });
  }
}
