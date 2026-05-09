export interface ArtistEntry {
  id: string;
  name: string;
}

export interface RetryEntry {
  artistIds: string[];
  failReason: string;
  attempts: number;
  firstFailedAt: number;
  lastAttemptAt: number;
}

export interface HeuristicScore {
  score: number;
  signals: Record<string, number>;
  scoredAt: number;
  status: "auto-blocked" | "flagged" | "ignored";
}

export interface FlaggedArtist {
  id: string;
  name: string;
  score: number;
  scoredAt: number;
}

export interface WhitelistEntry {
  id: string;
  name: string;
  addedAt: number;
  reason?: string;
}

export interface ErrorEntry {
  message: string;
  timestamp: number;
  context: string;
  resolved: boolean;
}

export interface Settings {
  syncFrequencyHours: number;
  heuristicsEnabled: boolean;
  autoBlockThreshold: number;
  flagThreshold: number;
  unblockRemovedArtists: boolean;
  csvSourceUrl: string;
}

export interface StorageSchema {
  authToken: string | null;
  username: string | null;
  lastSyncSha: string | null;
  lastSyncTimestamp: number | null;
  lastKnownArtistIds: string[];
  blockedArtistIds: string[];
  sessionBlockCount: number;
  totalBlockCount: number;
  retryQueue: RetryEntry[];
  heuristicScores: Record<string, HeuristicScore>;
  flaggedArtists: FlaggedArtist[];
  whitelist: WhitelistEntry[];
  settings: Settings;
  errors: ErrorEntry[];
}

export type MessageType =
  | { type: "AUTH_TOKEN"; token: string; username: string }
  | { type: "TRIGGER_SYNC" }
  | { type: "GET_STATUS" }
  | { type: "WHITELIST_ARTIST"; id: string; name: string }
  | { type: "DISMISS_FLAGGED"; id: string }
  | { type: "ARTISTS_ENCOUNTERED"; artists: ArtistEntry[] };

export interface SyncResult {
  newArtists: ArtistEntry[];
  removedArtists: ArtistEntry[];
  fullList: ArtistEntry[];
  sha: string;
}

export interface BlockResult {
  blocked: string[];
  failed: string[];
}
