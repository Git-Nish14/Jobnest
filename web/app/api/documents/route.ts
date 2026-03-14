import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");

  if (!path) {
    return NextResponse.json({ error: "Path is required" }, { status: 400 });
  }

  const supabase = await createClient();

  // Verify user is authenticated
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify the path belongs to the user (path format: userId/applicationId/filename)
  const pathParts = path.split("/");
  if (pathParts[0] !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Download the file from Supabase storage
  const { data, error } = await supabase.storage
    .from("documents")
    .download(path);

  if (error || !data) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  // Return the file with appropriate headers
  const arrayBuffer = await data.arrayBuffer();

  return new NextResponse(arrayBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
