import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/analysis/route";

afterEach(() => vi.unstubAllEnvs());
const request = (body: string, headers: HeadersInit = {}) =>
  new NextRequest("http://localhost:3000/api/analysis", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });

describe("Harbor analysis request boundary", () => {
  it("rejects oversized UTF-8 bodies by bytes before computing a brief", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const body = JSON.stringify({
      scenarioId: "normal",
      closedEdgeIds: [],
      padding: "あ".repeat(1500),
    });
    expect(body.length).toBeLessThan(4096);
    expect(new TextEncoder().encode(body).byteLength).toBeGreaterThan(4096);
    const response = await POST(request(body));
    expect(response.status).toBe(413);
  });

  it("stops reading an oversized chunked body even without Content-Length", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("x".repeat(4097)));
      },
      cancel,
    });
    const supplied = new NextRequest("http://localhost:3000/api/analysis", {
      method: "POST",
      body,
      duplex: "half",
    });
    const response = await Promise.race([
      POST(supplied),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("BODY_NOT_BOUNDED")), 500),
      ),
    ]);
    expect(response.status).toBe(413);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("contains a failed body stream without an unhandled server exception", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error("disconnected client"));
      },
    });
    const supplied = new NextRequest("http://localhost:3000/api/analysis", {
      method: "POST",
      body,
      duplex: "half",
    });
    const response = await POST(supplied);
    expect(response.status).toBe(400);
    expect(JSON.stringify(await response.json())).not.toContain("disconnected client");
  });

  it("rejects invalid JSON and cross-origin requests", async () => {
    expect((await POST(request("{"))).status).toBe(400);
    expect((await POST(request("{}", { origin: "https://other.example" }))).status).toBe(403);
  });
});
