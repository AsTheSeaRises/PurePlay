import { MAX_RETRY_ATTEMPTS, RETRY_EXPIRY_MS } from "../shared/constants";
import { storage } from "../shared/storage";
import type { ArtistEntry, RetryEntry } from "../shared/types";
import { blockArtists } from "./blocker";

export async function enqueue(artistIds: string[], failReason: string): Promise<void> {
  const queue = await storage.getRetryQueue();
  const existing = queue.find(
    (e) => JSON.stringify(e.artistIds.sort()) === JSON.stringify(artistIds.sort())
  );

  if (existing) {
    existing.attempts += 1;
    existing.lastAttemptAt = Date.now();
    existing.failReason = failReason;
  } else {
    queue.push({
      artistIds,
      failReason,
      attempts: 1,
      firstFailedAt: Date.now(),
      lastAttemptAt: Date.now(),
    });
  }

  await storage.setRetryQueue(queue);
}

function isExpired(entry: RetryEntry): boolean {
  return Date.now() - entry.firstFailedAt > RETRY_EXPIRY_MS;
}

function isExhausted(entry: RetryEntry): boolean {
  return entry.attempts >= MAX_RETRY_ATTEMPTS;
}

export async function processQueue(username: string, token: string): Promise<void> {
  const queue = await storage.getRetryQueue();
  if (queue.length === 0) return;

  const active: RetryEntry[] = [];
  const stillFailing: RetryEntry[] = [];

  for (const entry of queue) {
    if (isExpired(entry) || isExhausted(entry)) {
      // Discard old/exhausted entries
      continue;
    }
    active.push(entry);
  }

  for (const entry of active) {
    const artists: ArtistEntry[] = entry.artistIds.map((id) => ({ id, name: "" }));
    const result = await blockArtists(artists, username, token);

    if (result.blocked.length > 0) {
      await storage.addBlockedArtistIds(result.blocked);
    }

    if (result.failed.length > 0) {
      stillFailing.push({
        ...entry,
        artistIds: result.failed,
        attempts: entry.attempts + 1,
        lastAttemptAt: Date.now(),
      });
    }
  }

  await storage.setRetryQueue(stillFailing);
}
