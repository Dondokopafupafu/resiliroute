import type { NetworkImportProfile } from "@/types/real-city";

/** Only events from actual acquisition/build stages, never a timed animation. */
export interface NetworkImportProgress {
  stage: "cache" | "fetching" | "building" | "downloading" | "extracting";
  profile: NetworkImportProfile;
  attempt?: number;
  attempts?: number;
  bytesReceived?: number;
  totalBytes?: number;
  regionName?: string;
}

export type NetworkProgressListener = (progress: NetworkImportProgress) => void;
