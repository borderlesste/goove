import { test } from "node:test";
import assert from "node:assert/strict";
import { HttpError, readJsonBody } from "../supabase/functions/_shared/http.ts";

const request = (body) => new Request("https://example.test", { method: "POST", body });

test("accepts an action object and rejects malformed JSON and invalid shapes", async () => {
  assert.deepEqual(await readJsonBody(request('{"action":"catalog"}')), { action: "catalog" });
  for (const body of ["{", "null", "[]", '"catalog"', "{}", '{"action":1}']) {
    await assert.rejects(readJsonBody(request(body)), (error) => error instanceof HttpError && error.status === 400);
  }
});

test("caps streamed requests by UTF-8 bytes even without Content-Length", async () => {
  const body = JSON.stringify({ action: "catalog", text: "é".repeat(6_000) });
  assert.ok(body.length < 12_000);
  await assert.rejects(readJsonBody(request(body)), (error) => error.status === 413);
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{"action":"catalog",'));
      controller.enqueue(new Uint8Array(12_000));
    },
  });
  const streamedRequest = new Request("https://example.test", { method: "POST", body: stream, duplex: "half" });
  await assert.rejects(readJsonBody(streamedRequest), (error) => error.status === 413);
});
