// Runs in ISOLATED world — can use chrome.runtime APIs.
// 1. Relays auth token from inject.ts (MAIN world) to service worker.
// 2. Observes the Spotify DOM for artist links and reports encountered IDs.

import { TOKEN_MESSAGE_TYPE } from "../shared/constants";
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
