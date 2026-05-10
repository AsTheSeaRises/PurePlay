import { ALARM_NAME, SPOTIFY_API_BASE } from "../shared/constants";
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

    // We have valid credentials — clear any stale "no auth token" errors from
    // earlier failed attempts before the user opened Spotify.
    await storage.clearErrors();

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

    // Save artist name map for the blocked viewer
    const nameMap: Record<string, string> = {};
    for (const a of fullList) {
      nameMap[a.id] = a.name;
    }
    await storage.setArtistNameMap(nameMap);

    // Clear any stale errors from previous failed attempts
    await storage.clearErrors();
  } catch (err) {
    await storage.addError({
      message: err instanceof Error ? err.message : "Unknown sync error",
      context: "service-worker",
    });
  } finally {
    isSyncing = false;
  }
}

async function handleEncounteredArtists(artists: { id: string; name: string }[]): Promise<void> {
  const settings = await storage.getSettings();
  if (!settings.heuristicsEnabled) return;

  const token = await storage.getAuthToken();
  const username = await storage.getUsername();
  if (!token || !username) return;

  const csvIds = new Set(await storage.getLastKnownArtistIds());
  const blockedIds = new Set(await storage.getBlockedArtistIds());
  const whitelistIds = await storage.getWhitelistIds();
  const existingScores = await storage.getHeuristicScores();

  // Only score artists we haven't seen before and that aren't already handled
  const toScore = artists.filter(
    (a) =>
      !csvIds.has(a.id) &&
      !blockedIds.has(a.id) &&
      !whitelistIds.has(a.id) &&
      !existingScores[a.id]
  );

  for (const artist of toScore) {
    const score = await scoreArtist(artist, token);
    if (!score) continue;

    await storage.setHeuristicScore(artist.id, score);

    if (score.score >= settings.autoBlockThreshold) {
      const result = await blockArtists([artist], username, token);
      if (result.blocked.length > 0) {
        await storage.addBlockedArtistIds(result.blocked);
      }
    } else if (score.score >= settings.flagThreshold) {
      await storage.addFlaggedArtist(toFlaggedArtist(artist, score));
    }
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

// Keyboard command: forward to the active Spotify tab so the content script
// can read the currently playing artist and open a report issue.
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "report-current-artist") return;
  const tabs = await chrome.tabs.query({ url: "https://open.spotify.com/*" });
  const tab = tabs.find((t) => t.active) ?? tabs[0];
  if (!tab?.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "REPORT_CURRENT_ARTIST" });
  } catch {
    // Content script absent (tab predates extension install/reload) — reload so
    // the manifest content scripts inject. User presses the shortcut again.
    chrome.tabs.reload(tab.id);
  }
});


// Message handler: receive token from content script or commands from popup
chrome.runtime.onMessage.addListener((message: MessageType, _sender, sendResponse) => {
  if (message.type === "AUTH_TOKEN") {
    const { token, username } = message;

    (async () => {
      let resolvedUsername = username;
      if (!resolvedUsername) {
        try {
          const res = await fetch(`${SPOTIFY_API_BASE}/me`, {
            headers: { Authorization: token },
          });
          if (res.ok) {
            const data = await res.json();
            resolvedUsername = data.id ?? "";
          }
        } catch { /* API fallback failed, will retry on next token capture */ }
      }

      await storage.setAuthToken(token, resolvedUsername);

      const existing = await chrome.alarms.get(ALARM_NAME);
      if (!existing) {
        const settings = await storage.getSettings();
        scheduleAlarm(settings.syncFrequencyHours);
      }

      // Always sync when we get a fresh token (guard prevents concurrent runs)
      runSyncPipeline();
    })();

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

  if (message.type === "REPORT_AND_BLOCK") {
    const { id, name } = message;
    (async () => {
      await storage.addUserReport({ id, name, reportedAt: Date.now() });
      await storage.addArtistName(id, name);
      const token = await storage.getAuthToken();
      const username = await storage.getUsername();
      if (!token || !username) {
        sendResponse({ ok: false, error: "no-auth" });
        return;
      }
      const result = await blockArtists([{ id, name }], username, token);
      if (result.blocked.length > 0) {
        await storage.addBlockedArtistIds(result.blocked);
      }
      sendResponse({ ok: result.blocked.length > 0, failed: result.failed });
    })();
    return true;
  }

  if (message.type === "ARTISTS_ENCOUNTERED") {
    handleEncounteredArtists(message.artists);
    return false; // fire-and-forget, no response needed
  }

  return false;
});

// On install: initialise alarm
chrome.runtime.onInstalled.addListener(async () => {
  const settings = await storage.getSettings();
  scheduleAlarm(settings.syncFrequencyHours);
});
