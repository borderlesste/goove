export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Count bytes while reading, rather than buffering an unbounded request first.
export async function readJsonBody(request: Request, maxBytes = 12_000) {
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Invalid JSON request.");
  const decoder = new TextDecoder();
  let size = 0;
  let raw = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new HttpError(413, "Request too large.");
      }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new HttpError(400, "Invalid JSON request.");
  }
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    typeof body.action !== "string" ||
    !body.action ||
    body.action.length > 80
  ) {
    throw new HttpError(400, "Invalid request action.");
  }
  return body;
}
