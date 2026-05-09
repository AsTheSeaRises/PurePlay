import { DEFAULT_SETTINGS, GITHUB_REPORT_URL } from "../shared/constants";
import { storage } from "../shared/storage";
import type { Settings } from "../shared/types";

const BLOCKED_PAGE_SIZE = 50;
let blockedDisplayCount = BLOCKED_PAGE_SIZE;

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function getInputValue(id: string): string {
  return (el<HTMLInputElement>(id)).value.trim();
}

function getCheckboxValue(id: string): boolean {
  return (el<HTMLInputElement>(id)).checked;
}

function setInputValue(id: string, value: string | number): void {
  el<HTMLInputElement>(id).value = String(value);
}

function setCheckboxValue(id: string, value: boolean): void {
  el<HTMLInputElement>(id).checked = value;
}

async function loadSettings(): Promise<void> {
  const settings = await storage.getSettings();
  setInputValue("syncFrequencyHours", settings.syncFrequencyHours);
  setInputValue("csvSourceUrl", settings.csvSourceUrl);
  setCheckboxValue("unblockRemovedArtists", settings.unblockRemovedArtists);
  setCheckboxValue("heuristicsEnabled", settings.heuristicsEnabled);
  setInputValue("autoBlockThreshold", settings.autoBlockThreshold);
  setInputValue("flagThreshold", settings.flagThreshold);
  el<HTMLSpanElement>("autoBlockThresholdValue").textContent = String(settings.autoBlockThreshold);
  el<HTMLSpanElement>("flagThresholdValue").textContent = String(settings.flagThreshold);

  const whitelist = await storage.getWhitelist();
  el<HTMLTextAreaElement>("whitelistInput").value = whitelist.map((e) => e.id).join("\n");
}

async function saveSettings(): Promise<void> {
  const settings: Settings = {
    syncFrequencyHours: Math.max(1, parseInt(getInputValue("syncFrequencyHours"), 10) || 24),
    csvSourceUrl: getInputValue("csvSourceUrl") || DEFAULT_SETTINGS.csvSourceUrl,
    unblockRemovedArtists: getCheckboxValue("unblockRemovedArtists"),
    heuristicsEnabled: getCheckboxValue("heuristicsEnabled"),
    autoBlockThreshold: parseInt(getInputValue("autoBlockThreshold"), 10),
    flagThreshold: parseInt(getInputValue("flagThreshold"), 10),
  };

  await storage.setSettings(settings);

  // Update alarm to reflect new frequency
  chrome.alarms.clear("pureplay-sync", () => {
    chrome.alarms.create("pureplay-sync", {
      periodInMinutes: settings.syncFrequencyHours * 60,
      delayInMinutes: settings.syncFrequencyHours * 60,
    });
  });

  // Save whitelist from textarea
  const rawIds = el<HTMLTextAreaElement>("whitelistInput").value
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const existingWhitelist = await storage.getWhitelist();
  const existingIds = new Set(existingWhitelist.map((e) => e.id));

  for (const id of rawIds) {
    if (!existingIds.has(id)) {
      await storage.addToWhitelist({ id, name: id, addedAt: Date.now() });
    }
  }

  const saved = el("savedMsg");
  saved.classList.remove("hidden");
  setTimeout(() => saved.classList.add("hidden"), 2000);
}

async function loadBlockedArtists(filter = ""): Promise<void> {
  const blockedIds = await storage.getBlockedArtistIds();
  const nameMap = await storage.getArtistNameMap();
  const entries = blockedIds.map((id) => ({ id, name: nameMap[id] || "" }));
  const lowerFilter = filter.toLowerCase();
  const filtered = lowerFilter
    ? entries.filter(
        (e) =>
          e.name.toLowerCase().includes(lowerFilter) ||
          e.id.toLowerCase().includes(lowerFilter)
      )
    : entries;

  el("blockedCount").textContent = lowerFilter
    ? `${filtered.length} of ${entries.length} artists`
    : `${entries.length} artists`;

  const list = el("blockedList");
  list.textContent = "";
  const toShow = filtered.slice(0, blockedDisplayCount);
  for (const entry of toShow) {
    const li = document.createElement("li");
    li.className = "blocked-item";
    const nameSpan = document.createElement("span");
    nameSpan.className = "blocked-item-name";
    nameSpan.textContent = entry.name || entry.id;
    const idSpan = document.createElement("span");
    idSpan.className = "blocked-item-id";
    idSpan.textContent = entry.id;
    const link = document.createElement("a");
    link.className = "blocked-item-link";
    link.textContent = "open";
    link.href = "https://open.spotify.com/artist/" + entry.id;
    link.target = "_blank";
    link.rel = "noopener";
    li.appendChild(nameSpan);
    li.appendChild(idSpan);
    li.appendChild(link);
    list.appendChild(li);
  }

  const moreBtn = el("blockedShowMore");
  if (filtered.length > blockedDisplayCount) {
    moreBtn.classList.remove("hidden");
    moreBtn.textContent = "Show more (" + (filtered.length - blockedDisplayCount) + " remaining)";
  } else {
    moreBtn.classList.add("hidden");
  }
}

function parseArtistId(input: string): string | null {
  const trimmed = input.trim();
  const urlMatch = /\/artist\/([A-Za-z0-9]+)/.exec(trimmed);
  if (urlMatch) return urlMatch[1];
  if (/^[A-Za-z0-9]{22}$/.test(trimmed)) return trimmed;
  return null;
}

async function reportArtist(): Promise<void> {
  const raw = getInputValue("reportArtistInput");
  const artistId = parseArtistId(raw);
  if (!artistId) {
    alert("Please enter a valid Spotify artist URL or ID.");
    return;
  }
  const reason = getInputValue("reportReason");
  const nameMap = await storage.getArtistNameMap();
  const artistName = nameMap[artistId] || "Unknown";
  const title = "Report AI artist: " + artistName + " (" + artistId + ")";
  const bodyLines = [
    "**Artist:** " + artistName,
    "**Spotify ID:** " + artistId,
    "**Spotify URL:** https://open.spotify.com/artist/" + artistId,
  ];
  if (reason) bodyLines.push("**Reason:** " + reason);
  bodyLines.push("", "_Reported via PurePlay extension_");
  const body = bodyLines.join("\n");
  const url = GITHUB_REPORT_URL + "?title=" + encodeURIComponent(title) + "&body=" + encodeURIComponent(body);
  window.open(url, "_blank");
}

document.addEventListener("DOMContentLoaded", () => {
  loadSettings();

  el<HTMLInputElement>("autoBlockThreshold").addEventListener("input", (e) => {
    el("autoBlockThresholdValue").textContent = (e.target as HTMLInputElement).value;
  });

  el<HTMLInputElement>("flagThreshold").addEventListener("input", (e) => {
    el("flagThresholdValue").textContent = (e.target as HTMLInputElement).value;
  });

  el("saveBtn").addEventListener("click", saveSettings);

  el("exportWhitelist").addEventListener("click", async () => {
    const whitelist = await storage.getWhitelist();
    const data = JSON.stringify(whitelist, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pureplay-whitelist.json";
    a.click();
    URL.revokeObjectURL(url);
  });

  el("importWhitelist").addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const entries = JSON.parse(text) as { id: string; name: string }[];
        for (const entry of entries) {
          if (entry.id) {
            await storage.addToWhitelist({ id: entry.id, name: entry.name ?? entry.id, addedAt: Date.now() });
          }
        }
        await loadSettings();
      } catch {
        alert("Invalid whitelist file.");
      }
    });
    input.click();
  });

  el("clearAll").addEventListener("click", async () => {
    if (confirm("Clear all PurePlay data? This cannot be undone.")) {
      await storage.clearAll();
      await loadSettings();
      await loadBlockedArtists();
    }
  });

  // Blocked artists viewer
  loadBlockedArtists();

  let searchTimer: number | null = null;
  el<HTMLInputElement>("blockedSearch").addEventListener("input", (e) => {
    if (searchTimer !== null) clearTimeout(searchTimer);
    blockedDisplayCount = BLOCKED_PAGE_SIZE;
    searchTimer = window.setTimeout(() => {
      loadBlockedArtists((e.target as HTMLInputElement).value);
    }, 300);
  });

  el("blockedShowMore").addEventListener("click", () => {
    blockedDisplayCount += BLOCKED_PAGE_SIZE;
    loadBlockedArtists(el<HTMLInputElement>("blockedSearch").value);
  });

  // Report AI artist
  el("reportBtn").addEventListener("click", reportArtist);
});
