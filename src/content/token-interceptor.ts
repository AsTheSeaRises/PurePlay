// Runs in ISOLATED world — can use chrome.runtime APIs.
// 1. Relays auth token from inject.ts (MAIN world) to service worker.
// 2. Observes the Spotify DOM for artist links and reports encountered IDs.
// 3. Alt+Shift+R shortcut: report the currently playing artist to the community.

import { TOKEN_MESSAGE_TYPE, GITHUB_REPORT_URL } from "../shared/constants";
import type { ArtistEntry } from "../shared/types";

interface TokenMessage {
  type: string;
  token: string;
  username: string | null;
}

// ── Token relay ──────────────────────────────────────────────────────────────

window.addEventListener("message", (event) => {
  if (
    event.origin !== "https://open.spotify.com" ||
    !event.data ||
    event.data.type !== TOKEN_MESSAGE_TYPE
  ) {
    return;
  }

  const { token, username } = event.data as TokenMessage;
  if (!token) return;

  chrome.runtime.sendMessage({
    type: "AUTH_TOKEN",
    token,
    username: username ?? "",
  });
});

// ── Artist link observer ─────────────────────────────────────────────────────
// Spotify renders artist links as <a href="/artist/ARTIST_ID">Artist Name</a>
// We watch for these appearing in the DOM and report unknown ones to the
// service worker for heuristic scoring.

const ARTIST_HREF_RE = /^\/artist\/([A-Za-z0-9]+)$/;
const seenIds = new Set<string>(); // dedupe within this page session
let pendingArtists: ArtistEntry[] = [];
let debounceTimer: number | null = null;

function flush(): void {
  if (pendingArtists.length === 0) return;
  chrome.runtime.sendMessage({ type: "ARTISTS_ENCOUNTERED", artists: pendingArtists });
  pendingArtists = [];
}

function scanNodes(nodes: NodeList): void {
  nodes.forEach((node) => {
    if (!(node instanceof Element)) return;

    const anchors: HTMLAnchorElement[] = [];
    if (node instanceof HTMLAnchorElement) anchors.push(node);
    anchors.push(...Array.from(node.querySelectorAll<HTMLAnchorElement>("a[href]")));

    for (const anchor of anchors) {
      const href = anchor.getAttribute("href") ?? "";
      const match = ARTIST_HREF_RE.exec(href);
      if (!match) continue;

      const id = match[1];
      if (seenIds.has(id)) continue;
      seenIds.add(id);

      const name = anchor.textContent?.trim() ?? "";
      pendingArtists.push({ id, name });
    }
  });

  if (pendingArtists.length > 0) {
    // Debounce: batch reports 1s after last DOM mutation to avoid flooding
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    debounceTimer = self.setTimeout(flush, 1000);
  }
}

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    scanNodes(mutation.addedNodes);
  }
});

function startObserver(): void {
  observer.observe(document.body, { childList: true, subtree: true });
  scanNodes(document.body.childNodes);
}

if (document.body) {
  startObserver();
} else {
  document.addEventListener("DOMContentLoaded", startObserver, { once: true });
}

// ── Quick-report shortcut ───────────────────────────────────────────────────
// Triggered by chrome.commands (registered in manifest.json) and forwarded
// here by the service worker. Using chrome.commands instead of a DOM keydown
// listener avoids conflicts with Chrome's built-in shortcuts (e.g. Ctrl+Shift+R
// is hard-reload) and lets the user rebind the key in chrome://extensions/shortcuts.

function getCurrentArtist(): { id: string; name: string } | null {
  const selectors = [
    '[data-testid="nowplaying-widget"] a[href*="/artist/"]',
    '[data-testid="context-item-info-artist"] a[href*="/artist/"]',
    'footer a[href*="/artist/"]',
  ];
  for (const selector of selectors) {
    const anchor = document.querySelector<HTMLAnchorElement>(selector);
    if (!anchor) continue;
    const match = /\/artist\/([A-Za-z0-9]+)/.exec(anchor.getAttribute("href") ?? "");
    if (!match) continue;
    return { id: match[1], name: anchor.textContent?.trim() ?? "" };
  }
  return null;
}

function showToast(message: string): void {
  const toast = document.createElement("div");
  toast.textContent = message;
  Object.assign(toast.style, {
    position: "fixed",
    bottom: "80px",
    left: "50%",
    transform: "translateX(-50%)",
    background: "#1db954",
    color: "#fff",
    padding: "10px 20px",
    borderRadius: "6px",
    fontSize: "14px",
    fontFamily: "sans-serif",
    zIndex: "999999",
    pointerEvents: "none",
    boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
    opacity: "1",
    transition: "opacity 0.3s",
  });
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

chrome.runtime.onMessage.addListener((message) => {
  if (!message || message.type !== "REPORT_CURRENT_ARTIST") return;

  const artist = getCurrentArtist();
  if (!artist) {
    showToast("PurePlay: play a track first, then try again");
    return;
  }

  const title = `Report AI artist: ${artist.name} (${artist.id})`;
  const body = [
    `**Artist:** ${artist.name}`,
    `**Spotify ID:** ${artist.id}`,
    `**Spotify URL:** https://open.spotify.com/artist/${artist.id}`,
    "",
    "_Reported via PurePlay extension_",
  ].join("\n");

  const url = `${GITHUB_REPORT_URL}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
  window.open(url, "_blank", "noopener");
  showToast(`Reporting "${artist.name}" - check the new tab`);
});
