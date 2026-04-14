// Cloudmersive multi-engine AV scan. Fails open when key absent. Free: 800 calls/month.
// https://api.cloudmersive.com/docs/virus.asp

export interface ScanResult {
  clean: boolean;
  skipped: boolean;
  threat?: string;
  error?: string;
}

const CLOUDMERSIVE_URL = "https://api.cloudmersive.com/virus/scan/file";
const TIMEOUT_MS = 15_000;

export async function scanBuffer(buffer: Buffer, filename = "upload"): Promise<ScanResult> {
  const apiKey = process.env.CLOUDMERSIVE_API_KEY;
  if (!apiKey) return { clean: true, skipped: true };

  try {
    const form = new FormData();
    form.append("inputFile", new Blob([new Uint8Array(buffer)]), filename);

    const res = await fetch(CLOUDMERSIVE_URL, {
      method: "POST",
      headers: { Apikey: apiKey },
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      console.error(`[virus-scan] ${res.status}:`, await res.text());
      return { clean: true, skipped: true, error: `HTTP ${res.status}` };
    }

    const data = await res.json() as {
      CleanResult: boolean;
      FoundViruses?: { FileName: string; VirusName: string }[] | null;
      ErrorOccurred?: boolean;
    };

    if (data.ErrorOccurred) {
      return { clean: true, skipped: true, error: "Cloudmersive scan error" };
    }

    return { clean: data.CleanResult === true, skipped: false, threat: data.FoundViruses?.[0]?.VirusName };
  } catch (err) {
    console.error("[virus-scan] failed:", err);
    return { clean: true, skipped: true, error: String(err) };
  }
}
