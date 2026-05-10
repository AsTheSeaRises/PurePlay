import { DEFAULT_SETTINGS, STORAGE_KEYS } from "./constants";
import type {
  ErrorEntry,
  FlaggedArtist,
  HeuristicScore,
  RetryEntry,
  Settings,
  UserReport,
  WhitelistEntry,
} from "./types";

async function get<T>(key: string, fallback: T): Promise<T> {
  const result = await chrome.storage.local.get(key);
  return key in result ? result[key] : fallback;
}

async function set(key: string, value: unknown): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

export const storage = {
  async getAuthToken(): Promise<string | null> {
    const result = await chrome.storage.session.get("authToken");
    return result["authToken"] ?? null;
  },

  async setAuthToken(token: string, username: string): Promise<void> {
    await chrome.storage.session.set({ authToken: token });
    await set(STORAGE_KEYS.USERNAME, username);
  },

  async getUsername(): Promise<string | null> {
    return get(STORAGE_KEYS.USERNAME, null);
  },

  async getLastSyncSha(): Promise<string | null> {
    return get(STORAGE_KEYS.LAST_SYNC_SHA, null);
  },

  async setLastSyncSha(sha: string): Promise<void> {
    await set(STORAGE_KEYS.LAST_SYNC_SHA, sha);
    await set(STORAGE_KEYS.LAST_SYNC_TIMESTAMP, Date.now());
  },

  async getLastSyncTimestamp(): Promise<number | null> {
    return get(STORAGE_KEYS.LAST_SYNC_TIMESTAMP, null);
  },

  async getLastKnownArtistIds(): Promise<string[]> {
    return get(STORAGE_KEYS.LAST_KNOWN_ARTIST_IDS, []);
  },

  async setLastKnownArtistIds(ids: string[]): Promise<void> {
    await set(STORAGE_KEYS.LAST_KNOWN_ARTIST_IDS, ids);
  },

  async getBlockedArtistIds(): Promise<string[]> {
    return get(STORAGE_KEYS.BLOCKED_ARTIST_IDS, []);
  },

  async addBlockedArtistIds(ids: string[]): Promise<void> {
    const existing = await this.getBlockedArtistIds();
    const merged = Array.from(new Set([...existing, ...ids]));
    await set(STORAGE_KEYS.BLOCKED_ARTIST_IDS, merged);
    const added = merged.length - existing.length;
    if (added > 0) {
      const session = await get(STORAGE_KEYS.SESSION_BLOCK_COUNT, 0);
      const total = await get(STORAGE_KEYS.TOTAL_BLOCK_COUNT, 0);
      await set(STORAGE_KEYS.SESSION_BLOCK_COUNT, session + added);
      await set(STORAGE_KEYS.TOTAL_BLOCK_COUNT, total + added);
    }
  },

  async getBlockCounts(): Promise<{ session: number; total: number }> {
    const session = await get(STORAGE_KEYS.SESSION_BLOCK_COUNT, 0);
    const total = await get(STORAGE_KEYS.TOTAL_BLOCK_COUNT, 0);
    return { session, total };
  },

  async resetSessionCount(): Promise<void> {
    await set(STORAGE_KEYS.SESSION_BLOCK_COUNT, 0);
  },

  async getRetryQueue(): Promise<RetryEntry[]> {
    return get(STORAGE_KEYS.RETRY_QUEUE, []);
  },

  async setRetryQueue(queue: RetryEntry[]): Promise<void> {
    await set(STORAGE_KEYS.RETRY_QUEUE, queue);
  },

  async getSettings(): Promise<Settings> {
    return get(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
  },

  async setSettings(settings: Settings): Promise<void> {
    await set(STORAGE_KEYS.SETTINGS, settings);
  },

  async getWhitelist(): Promise<WhitelistEntry[]> {
    return get(STORAGE_KEYS.WHITELIST, []);
  },

  async addToWhitelist(entry: WhitelistEntry): Promise<void> {
    const list = await this.getWhitelist();
    if (!list.find((e) => e.id === entry.id)) {
      await set(STORAGE_KEYS.WHITELIST, [...list, entry]);
    }
  },

  async getWhitelistIds(): Promise<Set<string>> {
    const list = await this.getWhitelist();
    return new Set(list.map((e) => e.id));
  },

  async getHeuristicScores(): Promise<Record<string, HeuristicScore>> {
    return get(STORAGE_KEYS.HEURISTIC_SCORES, {});
  },

  async setHeuristicScore(artistId: string, score: HeuristicScore): Promise<void> {
    const scores = await this.getHeuristicScores();
    scores[artistId] = score;
    await set(STORAGE_KEYS.HEURISTIC_SCORES, scores);
  },

  async getFlaggedArtists(): Promise<FlaggedArtist[]> {
    return get(STORAGE_KEYS.FLAGGED_ARTISTS, []);
  },

  async addFlaggedArtist(artist: FlaggedArtist): Promise<void> {
    const flagged = await this.getFlaggedArtists();
    if (!flagged.find((a) => a.id === artist.id)) {
      await set(STORAGE_KEYS.FLAGGED_ARTISTS, [...flagged, artist]);
    }
  },

  async removeFlaggedArtist(artistId: string): Promise<void> {
    const flagged = await this.getFlaggedArtists();
    await set(
      STORAGE_KEYS.FLAGGED_ARTISTS,
      flagged.filter((a) => a.id !== artistId)
    );
  },

  async getErrors(): Promise<ErrorEntry[]> {
    return get(STORAGE_KEYS.ERRORS, []);
  },

  async addError(entry: Omit<ErrorEntry, "timestamp" | "resolved">): Promise<void> {
    const errors = await this.getErrors();
    // Deduplicate: remove previous unresolved errors with the same message
    const deduped = errors.filter((e) => e.resolved || e.message !== entry.message);
    const newErrors = [
      { ...entry, timestamp: Date.now(), resolved: false },
      ...deduped,
    ].slice(0, 50);
    await set(STORAGE_KEYS.ERRORS, newErrors);
  },

  async clearResolvedErrors(): Promise<void> {
    const errors = await this.getErrors();
    await set(STORAGE_KEYS.ERRORS, errors.filter((e) => !e.resolved));
  },

  async clearErrors(): Promise<void> {
    await set(STORAGE_KEYS.ERRORS, []);
  },

  async getArtistNameMap(): Promise<Record<string, string>> {
    return get(STORAGE_KEYS.ARTIST_NAME_MAP, {});
  },

  async setArtistNameMap(map: Record<string, string>): Promise<void> {
    await set(STORAGE_KEYS.ARTIST_NAME_MAP, map);
  },

  async getUserReports(): Promise<UserReport[]> {
    return get(STORAGE_KEYS.USER_REPORTS, []);
  },

  async addUserReport(entry: UserReport): Promise<void> {
    const list = await this.getUserReports();
    const filtered = list.filter((e) => e.id !== entry.id);
    await set(STORAGE_KEYS.USER_REPORTS, [entry, ...filtered]);
  },

  async addArtistName(id: string, name: string): Promise<void> {
    if (!name) return;
    const map = await this.getArtistNameMap();
    if (map[id] === name) return;
    map[id] = name;
    await set(STORAGE_KEYS.ARTIST_NAME_MAP, map);
  },

  async clearAll(): Promise<void> {
    await chrome.storage.local.clear();
    await chrome.storage.session.clear();
  },
};
