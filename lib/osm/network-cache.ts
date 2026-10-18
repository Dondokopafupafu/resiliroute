import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { realCityConfig } from "@/lib/real-city/model-config";
import { validateSnapshot } from "@/lib/real-city/snapshot";
import type { RealCityNetwork } from "@/types/real-city";

export interface CachedNetwork {
  expires: number;
  snapshot: RealCityNetwork;
}

/** A bounded, best-effort cache. No raw OSM contributor metadata or request logs. */
export function createDiskNetworkCache(directory: string | null) {
  const filename = (key: string) => `${createHash("sha256").update(key).digest("hex")}.json`;
  return {
    async get(key: string): Promise<CachedNetwork | null> {
      if (!directory) return null;
      const path = join(/* turbopackIgnore: true */ directory, filename(key));
      try {
        if (
          (await stat(/* turbopackIgnore: true */ path)).size >
          realCityConfig.maxSnapshotBytes + 1024
        )
          return null;
        const value: unknown = JSON.parse(await readFile(/* turbopackIgnore: true */ path, "utf8"));
        if (
          !value ||
          typeof value !== "object" ||
          !("expires" in value) ||
          !("snapshot" in value) ||
          typeof value.expires !== "number" ||
          !Number.isFinite(value.expires) ||
          value.expires <= Date.now() ||
          value.expires > Date.now() + realCityConfig.cacheMs + 1000
        )
          return null;
        return { expires: value.expires, snapshot: validateSnapshot(value.snapshot) };
      } catch {
        // Read-only/serverless storage and expired model versions are cache misses.
        return null;
      }
    },
    async set(key: string, entry: CachedNetwork): Promise<void> {
      if (!directory) return;
      const path = join(/* turbopackIgnore: true */ directory, filename(key));
      const temp = `${path}.${randomUUID()}.tmp`;
      try {
        const text = JSON.stringify({
          expires: entry.expires,
          snapshot: validateSnapshot(entry.snapshot),
        });
        if (Buffer.byteLength(text) > realCityConfig.maxSnapshotBytes + 1024) return;
        await mkdir(/* turbopackIgnore: true */ directory, { recursive: true });
        await writeFile(/* turbopackIgnore: true */ temp, text, {
          encoding: "utf8",
          flag: "wx",
          mode: 0o600,
        });
        await rename(/* turbopackIgnore: true */ temp, path);
        const files = (await readdir(/* turbopackIgnore: true */ directory)).filter((name) =>
          /^[a-f0-9]{64}\.json$/.test(name),
        );
        const sorted = (
          await Promise.all(
            files.map(async (name) => ({
              name,
              modified: (
                await stat(
                  /* turbopackIgnore: true */ join(/* turbopackIgnore: true */ directory, name),
                )
              ).mtimeMs,
            })),
          )
        ).sort((a, b) => b.modified - a.modified);
        // At most 16 selections on disk. Only remove our own hashed cache files.
        await Promise.all(
          sorted
            .slice(16)
            .map(({ name }) =>
              unlink(/* turbopackIgnore: true */ join(/* turbopackIgnore: true */ directory, name)),
            ),
        );
      } catch {
        // A cache write must never turn a successfully built network into failure.
      } finally {
        await unlink(/* turbopackIgnore: true */ temp).catch(() => undefined);
      }
    },
  };
}
