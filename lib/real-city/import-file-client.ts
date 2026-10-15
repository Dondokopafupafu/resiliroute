import { ImportError } from "@/lib/osm/geo";
import { parseOSMFile } from "@/lib/osm/file-import";
import { realCityConfig } from "./model-config";
import type { ImportWorkerResponse } from "./import-worker";
import type { BoundingBox, RealCityNetwork } from "@/types/real-city";

export async function buildFromOSMFile(
  file: File,
  bbox: BoundingBox | null,
  signal: AbortSignal,
): Promise<RealCityNetwork> {
  if (file.size > realCityConfig.maxResponseBytes) throw new ImportError("TOO_COMPLEX");
  const text = await file.text();
  if (signal.aborted) throw new ImportError("CANCELLED");
  const input = parseOSMFile(text, bbox);
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./import-worker.ts", import.meta.url), { type: "module" });
    const cleanup = () => {
      worker.terminate();
      signal.removeEventListener("abort", abort);
    };
    const abort = () => {
      cleanup();
      reject(new ImportError("CANCELLED"));
    };
    signal.addEventListener("abort", abort, { once: true });
    worker.onmessage = (event: MessageEvent<ImportWorkerResponse>) => {
      cleanup();
      if ("error" in event.data) reject(new ImportError(event.data.error));
      else resolve(event.data.snapshot);
    };
    worker.onerror = () => {
      cleanup();
      reject(new ImportError("INVALID_RESPONSE"));
    };
    worker.postMessage(input);
  });
}
