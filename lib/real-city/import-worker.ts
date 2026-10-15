import { ImportError } from "@/lib/osm/geo";
import { buildRealCityNetwork } from "@/lib/osm/network-builder";
import type { ImportedOSMFile } from "@/lib/osm/file-import";
import type { ImportErrorCode, RealCityNetwork } from "@/types/real-city";

export type ImportWorkerResponse = { snapshot: RealCityNetwork } | { error: ImportErrorCode };
self.onmessage = (event: MessageEvent<ImportedOSMFile>) => {
  try {
    self.postMessage({
      snapshot: buildRealCityNetwork(event.data.raw, event.data.bbox),
    } satisfies ImportWorkerResponse);
  } catch (error) {
    self.postMessage({
      error: error instanceof ImportError ? error.code : "INVALID_RESPONSE",
    } satisfies ImportWorkerResponse);
  }
};
