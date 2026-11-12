import { ApiError } from "@/lib/api/errors";

/** Enforce the limit while reading, including responses without Content-Length. */
export async function readLimitedResponse(response: Response, maxBytes: number): Promise<Buffer> {
  if (Number(response.headers.get("content-length")) > maxBytes) {
    await response.body?.cancel();
    throw ApiError.badRequest("File exceeds the download size limit.");
  }
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return Buffer.concat(chunks);
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw ApiError.badRequest("File exceeds the download size limit.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
}
