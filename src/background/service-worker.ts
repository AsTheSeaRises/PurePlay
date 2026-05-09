import { ALARM_NAME } from "../shared/constants";
import { storage } from "../shared/storage";
import type { MessageType } from "../shared/types";
import { blockArtists, unblockArtists } from "./blocker";
import { fetchAndDiff } from "./csv-sync";
import { scoreArtist, toFlaggedArtist } from "./heuristics";
import { enqueue, processQueue } from "./retry-queue";

let isSyncing = false;

async function runSyncPipeline(): Promise<void> {
  if (isSyncing) return;
  isSyncing = true;

  try {
    const token = await storage.getAuthToken();
    const username = await storage.getUsername();

    if (!token || !username) {
      await storage.addError({ message: "No auth token — open Spotify first", context: "service-worker" });
      return;
    }

    const settings = await storage.getSettings();

    // Process retry queue first
    await processQueue(username, token);

    // Fetch CSV and compute diff
    const syncResult = await fetchAndDiff(settings.csvSourceUrl);

    if (!syncResult) {
      // No changes since last sync
      return;
    }

    const { newArtists, removedArtists, fullList, sha } = syncResult;

    // Filter out whitelisted artists
    const whitelist = await storage.getWhitelistIds();
    const toBlock = newArtists.filter((a) => !whitelist.has(a.id));

    // Block new artists
    if (toBlock.length > 0) {
      const result = await blockArtists(toBlock, username, token);

      if (result.blocked.length > 0) {
        await storage.addBlockedArtistIds(result.blocked);
      }

      if (result.failed.length > 0) {
        await enqueue(result.failed, "block failed");
        await storage.addError({
          message: `Failed to block ${result.failed.length} artists — queued for retry`,
          context: "blocker",
        });
      }
    }

    // Optionally unblock removed artists
    if (settings.unblockRemovedArtists && removedArtists.length > 0) {
      const toUnblock = removedArtists.filter((a) => !whitelist.has(a.id));
      if (toUnblock.length > 0) {
        await unblockArtists(toUnblock.map((a) => a.id), username, token);
      }
    }

    // Update known state
    await storage.setLastKnownArtistIds(fullList.map((a) => a.id));
    await storage.setLastSyncSha(sha);

    // Run heuristics on artists we haven't scored yet
    if (settings.heuristicsEnabled) {
      const existingScores = await storage.getHeuristicScores();
      const blockedIds = new Set(await storage.getBlockedArtistIds());
      const whitelistIds = await storage.getWhitelistIds();

      // Score only new CSV artists not already handled
      const unscored = toBlock.filter(
        (a) => !existingScores[a.id] && !blockedIds.has(a.id) && !whitelistIds.has(a.id)
      );

      for (const artist of unscored.slice(0, 20)) { // cap per-run to avoid timeout
        const score = await scoreArtist(artist, token);
        if (!score) continue;

        await storage.setHeuristicScore(artist.id, score);

        if (score.score >= settings.autoBlockThreshold && !blockedIds.has(artist.id)) {
          const result = await blockArtists([artist], username, token);
          if (result.blocked.length > 0) {
            await storage.addBlockedArtistIds(result.blocked);
          }
        } else if (score.score >= settings.flagThreshold) {
          await storage.addFlaggedArtist(toFlaggedArtist(artist, score));
        }
      }
    }
  } catch (err) {
    await storage.addError({
      message: err instanceof Error ? err.message : "Unknown sync error",
      context: "service-worker",
    });
  } finally {
    isSyncing = false;
  }
}

function scheduleAlarm(frequencyHours: number): void {
  chrome.alarms.create(ALARM_NAME, {
    periodInMinutes: frequencyHours * 60,
    delayInMinutes: 1,
  });
}

// Alarm fires: run sync pipeline
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    runSyncPipeline();
  }
});

// Message handler: receive token from content script or commands from popup
chrome.runtime.onMessage.addListener((message: MessageType, _sender, sendResponse) => {
  if (message.type === "AUTH_TOKEN") {
    const { token, username } = message;
    storage.setAuthToken(token, username).then(async () => {
      // Schedule recurring alarm if not already set
      const existing = await chrome.alarms.get(ALARM_NAME);
      if (!existing) {
        const settings = await storage.getSettings();
        scheduleAlarm(settings.syncFrequencyHours);
        // Trigger first sync shortly after token capture
        runSyncPipeline();
      }
    });
    return false;
  }

  if (message.type === "TRIGGER_SYNC") {
    runSyncPipeline().then(() => sendResponse({ ok: true }));
    return true; // async response
  }

  if (message.type === "GET_STATUS") {
    Promise.all([
      storage.getLastSyncTimestamp(),
      storage.getBlockCounts(),
      storage.getErrors(),
      storage.getFlaggedArtists(),
    ]).then(([lastSync, counts, errors, flagged]) => {
      sendResponse({
        lastSync,
        sessionBlockCount: counts.session,
        totalBlockCount: counts.total,
        errors: errors.filter((e) => !e.resolved).slice(0, 5),
        flaggedArtists: flagged.slice(0, 10),
        isSyncing,
      });
    });
    return true; // async response
  }

  if (message.type === "WHITELIST_ARTIST") {
    storage
      .addToWhitelist({ id: message.id, name: message.name, addedAt: Date.now() })
      .then(() => storage.removeFlaggedArtist(message.id))
      .then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === "DISMISS_FLAGGED") {
    storage.removeFlaggedArtist(message.id).then(() => sendResponse({ ok: true }));
    return true;
  }

  return false;
});

// On install: initialise alarm
chrome.runtime.onInstalled.addListener(async () => {
  const settings = await storage.getSettings();
  scheduleAlarm(settings.syncFrequencyHours);
});
