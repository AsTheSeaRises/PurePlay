# Chrome Web Store Listing — PurePlay

Use these fields when filling out the Chrome Web Store Developer Dashboard.

---

## Extension Name
PurePlay — Block AI Artists on Spotify

## Summary (132 chars max)
Automatically blocks AI-generated artists on Spotify using a community-maintained list. Keep your music real.

## Category
Productivity

## Language
English

---

## Detailed Description (use this in the "Description" field)

```
PurePlay automatically blocks AI-generated artists from your Spotify account so you only hear music made by real people.

HOW IT WORKS
PurePlay uses a community-maintained list of known AI-generated artists on Spotify. When you open Spotify Web Player, PurePlay syncs with the latest version of this list and blocks any new AI artists it finds. It uses the same "block artist" feature built into Spotify — the same action you'd take manually, just automated.

FEATURES
• Blocks thousands of known AI artists automatically
• Syncs in the background — no maintenance needed
• Whitelist artists you want to keep
• View all blocked artists in the settings page
• Report suspected AI artists back to the community
• Experimental heuristic detection to flag unknown AI artists
• Customisable sync frequency and detection thresholds
• Import/export your whitelist
• Works entirely in your browser — no account or signup needed

PRIVACY
PurePlay stores everything locally on your device. It does not collect, transmit, or sell any personal data. The only network requests go to Spotify (to block artists using your existing session) and GitHub (to download the public community list). There are no PurePlay servers, no analytics, and no tracking.

COMMUNITY
The AI artist blocklist is maintained by the open-source community at github.com/CennoxX/spotify-ai-blocker. Anyone can report new AI artists. PurePlay includes a built-in report button to make this easy.

REQUIREMENTS
• Google Chrome (desktop)
• A Spotify account (free or premium)
• Use Spotify Web Player (open.spotify.com) in Chrome

SUPPORT
Found a bug or have a suggestion? Open an issue on the GitHub repository.
```

---

## Review Notes (paste into "Reviewer notes" during submission)

```
This extension blocks AI-generated artists on Spotify using the platform's built-in "block artist" functionality.

HOST PERMISSIONS JUSTIFICATION:

1. open.spotify.com — Content scripts run here to capture the user's existing Spotify session token from the web player. No credentials are accessed; only the Bearer token that Spotify's own JavaScript creates in the browser.

2. spclient.wg.spotify.com — This is Spotify's internal API endpoint for blocking/unblocking artists (collection/v2/write). This is the same endpoint used when a user manually selects "Don't play this artist" in the Spotify interface. The extension automates this action in bulk.

3. api.spotify.com — Used to retrieve the user's Spotify username (GET /v1/me) and artist metadata for the heuristic detection feature. Only reads publicly available artist information.

4. raw.githubusercontent.com and api.github.com — Used to download a publicly available CSV file listing known AI-generated artists, maintained by an open-source community project (github.com/CennoxX/spotify-ai-blocker). No authentication or personal data is sent to GitHub.

The extension uses no remote code, no analytics, no tracking. All data is stored locally via chrome.storage APIs. The approach is identical to the established Tampermonkey userscript at github.com/CennoxX/spotify-ai-blocker, repackaged as a proper Chrome extension for better UX.

To test: Install the extension, open open.spotify.com, log into Spotify. The extension will automatically capture the session and begin blocking AI artists. Click the extension icon to see the popup with block counts and status.
```

---

## Assets Checklist

| Asset | Size | File |
|---|---|---|
| Extension icon | 128x128 px | `src/assets/icon-128.png` |
| Small promo tile | 440x280 px | `store/promo-small.png` |
| Screenshot 1 | 1280x800 px | `store/screenshot-popup.png` — Take this yourself |
| Screenshot 2 | 1280x800 px | `store/screenshot-options.png` — Take this yourself |

### How to take the screenshots

1. **Popup screenshot:** Open Spotify, wait for sync to complete, click the PurePlay icon. Use Chrome DevTools (Ctrl+Shift+I → toggle device toolbar → set to 1280x800) or a screenshot tool to capture the full browser window with the popup visible.

2. **Options screenshot:** Right-click the PurePlay icon → Options. Capture the full settings page showing the sync settings, blocked artists list, and report section. Resize the window to 1280x800 before capturing.

Tip: The Chrome Web Store shows screenshots at smaller sizes, so make sure text is readable. Consider zooming the browser to 125-150% before capturing.
