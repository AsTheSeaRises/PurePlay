# Privacy Policy — PurePlay

**Last updated:** May 9, 2026

PurePlay is a Chrome extension that blocks AI-generated artists on Spotify. This policy explains what data the extension accesses and how it is handled.

---

## Data PurePlay Accesses

### Spotify Session Token
When you use Spotify Web Player, PurePlay reads the temporary authentication token that Spotify creates in your browser. This token is used solely to send "block artist" and "unblock artist" requests to Spotify on your behalf — the same action you would take manually through the Spotify interface.

### Spotify Username
Your Spotify username (user ID) is read from the Spotify API to associate block actions with your account. This is required by Spotify's internal API to process block requests.

### Blocked Artist Data
PurePlay stores a list of artist IDs that have been blocked, along with artist names from the community CSV list, to display in the extension's settings page. This data is stored locally on your device.

### Extension Settings
Your preferences (sync frequency, thresholds, whitelist) are stored locally on your device using Chrome's built-in storage.

---

## Where Data Is Stored

All data is stored **locally on your device** using Chrome's extension storage APIs:

- **`chrome.storage.session`** — Temporary session data (auth token). Cleared automatically when you close Chrome.
- **`chrome.storage.local`** — Persistent settings and blocked artist lists. Stays on your device until you clear it.

No data is stored on any external server owned or operated by PurePlay.

---

## External Services

PurePlay communicates with the following external services:

| Service | Purpose | Data Sent |
|---|---|---|
| **Spotify** (`open.spotify.com`, `spclient.wg.spotify.com`, `api.spotify.com`) | Block/unblock artists, read artist metadata | Your existing Spotify session token, artist IDs to block |
| **GitHub** (`raw.githubusercontent.com`, `api.github.com`) | Download the community AI artist list and check for updates | No personal data — only reads a public CSV file |

---

## What PurePlay Does NOT Do

- Does **not** collect, transmit, or sell any personal information
- Does **not** track your listening history or browsing activity
- Does **not** store your Spotify password
- Does **not** send any data to PurePlay servers (there are none)
- Does **not** modify your Spotify playlists or library — only blocks/unblocks artists
- Does **not** use analytics, telemetry, or any third-party tracking

---

## Data Sharing

PurePlay does not share any data with third parties. The only network requests are to Spotify (to execute block actions using your existing session) and to GitHub (to download the public community artist list).

---

## Your Control

- You can view all blocked artists in the extension's settings page
- You can clear all extension data at any time using the "Clear all data & reset" button in settings
- You can uninstall the extension at any time, which removes all locally stored data
- You can whitelist artists to prevent them from being blocked
- Unblocking artists on Spotify directly (through the Spotify interface) is always available

---

## Changes to This Policy

If this policy is updated, the changes will be reflected in this document with an updated date. The extension does not auto-update its privacy policy — changes are only made through new extension versions.

---

## Contact

If you have questions about this privacy policy, please open an issue on the [GitHub repository](https://github.com/your-username/pureplay/issues).
