// Runs in MAIN world — has direct access to window and Spotify's fetch.
// Patches window.fetch to intercept the Authorization header.
// Relays captured token to the ISOLATED world via postMessage.

import { TOKEN_MESSAGE_TYPE } from "../shared/constants";

const originalFetch = window.fetch.bind(window);
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

window.fetch = async function (input, init) {
  const headers = init?.headers;
  if (headers) {
    let authorization: string | undefined;

    if (headers instanceof Headers) {
      authorization = headers.get("authorization") ?? undefined;
    } else if (Array.isArray(headers)) {
      const found = headers.find(([k]) => k.toLowerCase() === "authorization");
      authorization = found?.[1];
    } else {
      const record = headers as Record<string, string>;
      authorization =
        record["authorization"] ?? record["Authorization"];
    }

    if (authorization && authorization !== capturedToken) {
      capturedToken = authorization;
      const username = extractUsername();
      window.postMessage(
        { type: TOKEN_MESSAGE_TYPE, token: authorization, username },
        "https://open.spotify.com"
      );
    }
  }

  return originalFetch(input, init);
};
