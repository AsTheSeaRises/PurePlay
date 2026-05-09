import { BLOCK_BATCH_SIZE, MAX_RETRY_ATTEMPTS, SPOTIFY_BLOCK_API } from "../shared/constants";
import type { ArtistEntry, BlockResult } from "../shared/types";

interface BlockPayload {
  username: string;
  set: string;
  items: { uri: string }[];
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function blockBatch(
  ids: string[],
  username: string,
  token: string
): Promise<{ success: boolean; retryAfterMs?: number }> {
  const payload: BlockPayload = {
    username,
    set: "artistban",
    items: ids.map((id) => ({ uri: `spotify:artist:${id}` })),
  };

  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(`${SPOTIFY_BLOCK_API}?market=from_token`, {
        method: "POST",
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        return { success: true };
      }

      if (res.status === 401) {
        // Token expired — caller must re-capture
        return { success: false };
      }

      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get("Retry-After") ?? "0", 10);
        const waitMs = retryAfter > 0 ? retryAfter * 1000 : Math.pow(2, attempt) * 1000;
        if (attempt < MAX_RETRY_ATTEMPTS - 1) {
          await sleep(waitMs);
          continue;
        }
        return { success: false, retryAfterMs: waitMs };
      }

      if (res.status >= 500) {
        if (attempt < MAX_RETRY_ATTEMPTS - 1) {
          await sleep(Math.pow(2, attempt) * 1000);
          continue;
        }
      }

      return { success: false };
    } catch {
      if (attempt < MAX_RETRY_ATTEMPTS - 1) {
        await sleep(Math.pow(2, attempt) * 1000);
        continue;
      }
      return { success: false };
    }
  }

  return { success: false };
}

export async function blockArtists(
  artists: ArtistEntry[],
  username: string,
  token: string
): Promise<BlockResult> {
  const blocked: string[] = [];
  const failed: string[] = [];

  const batches: string[][] = [];
  for (let i = 0; i < artists.length; i += BLOCK_BATCH_SIZE) {
    batches.push(artists.slice(i, i + BLOCK_BATCH_SIZE).map((a) => a.id));
  }

  for (const batch of batches) {
    const result = await blockBatch(batch, username, token);
    if (result.success) {
      blocked.push(...batch);
    } else {
      failed.push(...batch);
    }
  }

  return { blocked, failed };
}

export async function unblockArtists(
  artistIds: string[],
  username: string,
  token: string
): Promise<BlockResult> {
  const blocked: string[] = [];
  const failed: string[] = [];

  const batches: string[][] = [];
  for (let i = 0; i < artistIds.length; i += BLOCK_BATCH_SIZE) {
    batches.push(artistIds.slice(i, i + BLOCK_BATCH_SIZE));
  }

  for (const batch of batches) {
    try {
      // Unblock uses the same endpoint with a delete_items key
      const res = await fetch(`${SPOTIFY_BLOCK_API}?market=from_token`, {
        method: "POST",
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          set: "artistban",
          remove_items: batch.map((id) => ({ uri: `spotify:artist:${id}` })),
        }),
      });

      if (res.ok) {
        blocked.push(...batch);
      } else {
        failed.push(...batch);
      }
    } catch {
      failed.push(...batch);
    }
  }

  return { blocked, failed };
}
