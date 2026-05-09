// Runs in MAIN world — has direct access to window and Spotify's fetch.
// Patches window.fetch AND XMLHttpRequest to intercept the Authorization header.
// Relays captured token to the ISOLATED world via postMessage.

import { TOKEN_MESSAGE_TYPE } from "../shared/constants";

const originalFetch = window.fetch.bind(window);
const originalXhrOpen = XMLHttpRequest.prototype.open;
const originalXhrSetHeader = XMLHttpRequest.prototype.setRequestHeader;
let capturedToken: string | null = null;

function extractUsername(): string | null {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.includes(":") && !key.startsWith("anonymous:")) {
      return key.split(":")[0];
    }
  }
  return null;
}

function reportToken(authorization: string): void {
  if (!authorization || authorization === capturedToken) return;
  if (!/^Bearer\s+/i.test(authorization)) return;

  capturedToken = authorization;
  const username = extractUsername();
  console.log("[PurePlay] captured Spotify auth token");
  window.postMessage(
    { type: TOKEN_MESSAGE_TYPE, token: authorization, username },
    "https://open.spotify.com"
  );
}

function extractAuthFromHeaders(headers: HeadersInit | undefined): string | null {
  if (!headers) return null;
  if (headers instanceof Headers) {
    return headers.get("authorization");
  }
  if (Array.isArray(headers)) {
    const found = headers.find(([k]) => k.toLowerCase() === "authorization");
    return found?.[1] ?? null;
  }
  const record = headers as Record<string, string>;
  return record["authorization"] ?? record["Authorization"] ?? null;
}

// ── fetch patch ──────────────────────────────────────────────────────────────
window.fetch = async function (input, init) {
  let auth = extractAuthFromHeaders(init?.headers);

  // If input is a Request object, the headers may live on it instead of init
  if (!auth && input instanceof Request) {
    auth = input.headers.get("authorization");
  }

  if (auth) reportToken(auth);

  return originalFetch(input as RequestInfo, init);
};

// ── XHR patch ────────────────────────────────────────────────────────────────
XMLHttpRequest.prototype.open = function (
  this: XMLHttpRequest,
  ...args: Parameters<typeof originalXhrOpen>
) {
  return originalXhrOpen.apply(this, args);
};

XMLHttpRequest.prototype.setRequestHeader = function (
  this: XMLHttpRequest,
  name: string,
  value: string
) {
  if (name.toLowerCase() === "authorization") {
    reportToken(value);
  }
  return originalXhrSetHeader.apply(this, [name, value]);
};

// ── Token bootstrap from page globals ────────────────────────────────────────
// Spotify caches its access token in window.Spotify or similar globals shortly
// after page load. Poll briefly to catch it even if no API call has fired yet.
let bootstrapAttempts = 0;
const bootstrapTimer = setInterval(() => {
  bootstrapAttempts++;
  if (capturedToken || bootstrapAttempts > 40) {
    clearInterval(bootstrapTimer);
    return;
  }
  try {
    // Spotify stores the access token JSON under this localStorage key
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.includes("access_token") || key.endsWith(":access_token")) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw);
          const token = parsed?.accessToken ?? parsed?.access_token;
          if (token) {
            reportToken("Bearer " + token);
            return;
          }
        } catch {
          // not JSON, ignore
        }
      }
    }
  } catch {
    // localStorage access errors, ignore
  }
}, 500);
