import type { ErrorEntry, FlaggedArtist } from "../shared/types";

interface Status {
  lastSync: number | null;
  sessionBlockCount: number;
  totalBlockCount: number;
  errors: ErrorEntry[];
  flaggedArtists: FlaggedArtist[];
  isSyncing: boolean;
}

function timeAgo(ts: number | null): string {
  if (!ts) return "never";
  const diffMs = Date.now() - ts;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function el(id: string): HTMLElement {
  return document.getElementById(id)!;
}

function renderStatus(status: Status): void {
  const dot = el("statusDot");
  const text = el("statusText");

  if (status.isSyncing) {
    dot.className = "dot syncing";
    text.textContent = "Syncing…";
  } else if (status.errors.length > 0) {
    dot.className = "dot error";
    text.textContent = "Active (with errors)";
  } else {
    dot.className = "dot active";
    text.textContent = "Active";
  }

  el("totalBlocked").textContent = status.totalBlockCount.toLocaleString();
  el("sessionBlocked").textContent =
    status.sessionBlockCount > 0 ? `+${status.sessionBlockCount}` : "0";
  el("flaggedCount").textContent = status.flaggedArtists.length.toString();
  el("lastSync").textContent = `Last sync: ${timeAgo(status.lastSync)}`;
}

function makeButton(label: string, action: string, id: string, name = ""): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.className = "btn-small";
  btn.textContent = label;
  btn.dataset["action"] = action;
  btn.dataset["id"] = id;
  btn.dataset["name"] = name;
  return btn;
}

function renderFlagged(flagged: FlaggedArtist[]): void {
  const section = el("flaggedSection");
  const list = el("flaggedList");

  if (flagged.length === 0) {
    section.classList.add("hidden");
    return;
  }

  section.classList.remove("hidden");
  list.textContent = "";

  for (const artist of flagged) {
    const li = document.createElement("li");
    li.className = "flagged-item";

    const nameSpan = document.createElement("span");
    nameSpan.className = "flagged-name";
    nameSpan.title = artist.name;
    nameSpan.textContent = artist.name || artist.id;

    const scoreSpan = document.createElement("span");
    scoreSpan.className = "flagged-score";
    scoreSpan.textContent = `${artist.score}%`;

    const actions = document.createElement("div");
    actions.className = "flagged-actions";
    actions.appendChild(makeButton("Block", "block", artist.id, artist.name));
    actions.appendChild(makeButton("Allow", "whitelist", artist.id, artist.name));
    actions.appendChild(makeButton("×", "dismiss", artist.id));

    li.appendChild(nameSpan);
    li.appendChild(scoreSpan);
    li.appendChild(actions);
    list.appendChild(li);
  }
}

function renderErrors(errors: ErrorEntry[]): void {
  const section = el("errorsSection");
  const list = el("errorList");

  if (errors.length === 0) {
    section.classList.add("hidden");
    return;
  }

  section.classList.remove("hidden");
  list.textContent = "";

  for (const err of errors) {
    const li = document.createElement("li");
    li.className = "error-item";
    li.textContent = err.message;
    list.appendChild(li);
  }
}

async function loadStatus(): Promise<void> {
  const status = await chrome.runtime.sendMessage({ type: "GET_STATUS" });
  renderStatus(status as Status);
  renderFlagged((status as Status).flaggedArtists);
  renderErrors((status as Status).errors);
}

async function triggerSync(): Promise<void> {
  const btn = el("syncBtn") as HTMLButtonElement;
  btn.disabled = true;
  btn.textContent = "Syncing…";

  await chrome.runtime.sendMessage({ type: "TRIGGER_SYNC" });
  await loadStatus();

  btn.disabled = false;
  btn.textContent = "↻ Sync Now";
}

document.addEventListener("DOMContentLoaded", () => {
  loadStatus();

  el("syncBtn").addEventListener("click", triggerSync);

  el("openOptions").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  el("flaggedList").addEventListener("click", async (e) => {
    const btn = (e.target as HTMLElement).closest("[data-action]") as HTMLElement | null;
    if (!btn) return;

    const action = btn.dataset["action"];
    const id = btn.dataset["id"]!;
    const name = btn.dataset["name"] ?? "";

    if (action === "whitelist") {
      await chrome.runtime.sendMessage({ type: "WHITELIST_ARTIST", id, name });
    } else if (action === "dismiss" || action === "block") {
      await chrome.runtime.sendMessage({ type: "DISMISS_FLAGGED", id });
    }

    await loadStatus();
  });
});
