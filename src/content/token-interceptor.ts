// Runs in ISOLATED world — can use chrome.runtime APIs.
// Listens for token messages from inject.ts (MAIN world) and relays to service worker.

import { TOKEN_MESSAGE_TYPE } from "../shared/constants";

interface TokenMessage {
  type: string;
  token: string;
  username: string | null;
}

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
