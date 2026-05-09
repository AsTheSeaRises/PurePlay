import { DEFAULT_SETTINGS } from "../shared/constants";
import { storage } from "../shared/storage";
import type { Settings } from "../shared/types";

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
    }
  });
});
