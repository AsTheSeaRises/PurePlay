# PurePlay — Block AI Artists on Spotify

**PurePlay** is a free Chrome extension that automatically blocks AI-generated artists from your Spotify account. Once installed, it works silently in the background — no maintenance needed.

---

## What It Does

Spotify is increasingly filled with AI-generated "artists": algorithmically produced music with fake names designed to game streaming payouts and crowd out real musicians. PurePlay uses a community-maintained list of these artists and blocks them from your Spotify account automatically.

- Blocks thousands of known AI artists from your Spotify account
- Syncs automatically whenever you open Spotify
- Updates as the community list grows — no action needed from you
- Lets you whitelist artists you want to keep
- Lets you report suspected AI artists back to the community

---

## Installation

> PurePlay is not yet on the Chrome Web Store. Follow these steps to install it manually — it only takes a couple of minutes.

### Step 1: Download the extension

1. Go to the [Releases page](https://github.com/your-username/pureplay/releases) *(or wherever the built zip is hosted)*
2. Download the latest `pureplay-vX.X.X.zip` file
3. Unzip it somewhere you won't accidentally move or delete it (e.g. your Documents folder)

### Step 2: Open Chrome's extensions page

1. In Chrome, click the three-dot menu in the top-right corner
2. Go to **More Tools → Extensions**  
   *(or type `chrome://extensions` in the address bar and press Enter)*

### Step 3: Enable Developer Mode

1. In the top-right corner of the Extensions page, toggle on **Developer mode**

### Step 4: Load the extension

1. Click **Load unpacked**
2. Navigate to the folder you unzipped in Step 1 and select the `dist` folder inside it
3. PurePlay should now appear in your extensions list

### Step 5: Pin the extension (optional but recommended)

1. Click the puzzle-piece icon in the top-right of Chrome
2. Click the pin icon next to PurePlay so it always shows in your toolbar

---

## First Use

1. Open [Spotify Web Player](https://open.spotify.com) in Chrome
2. Log in if you aren't already
3. PurePlay will automatically detect your session and begin syncing

That's it. The first sync will block all currently known AI artists. You'll see the count in the PurePlay popup (click the icon in your toolbar).

---

## Understanding the Popup

Click the PurePlay icon in your Chrome toolbar to open the popup:

| Item | What it means |
|---|---|
| **Active** (green dot) | Extension is running normally |
| **Active (with errors)** (yellow dot) | Something went wrong — see the error message below |
| **Syncing…** (animated dot) | Currently checking for new AI artists to block |
| **Total blocked** | How many AI artists have been blocked on your account |
| **This session** | Artists blocked since you last opened Spotify |
| **Flagged for review** | Artists detected as *possibly* AI but not yet blocked — you decide |
| **Last sync** | When PurePlay last checked for updates |
| **↻ Sync Now** | Manually trigger a sync right now |
| **⚙ Settings** | Open the full settings page |

---

## Settings Page

Open PurePlay's settings by clicking **⚙ Settings** in the popup, or right-clicking the extension icon and choosing **Options**.

### Sync settings

- **Sync frequency:** How often PurePlay checks for new AI artists (default: every 24 hours)
- **CSV source URL:** The community list it syncs from. You can point this at a custom list if you have one
- **Unblock artists removed from the list:** If an artist gets removed from the community list, PurePlay will unblock them automatically

### Heuristics (experimental)

PurePlay can also *detect* AI artists it hasn't seen before by analysing patterns in their music and metadata. This is off by default.

- **Enable heuristic AI detection:** Turn on the experimental detector
- **Auto-block threshold:** Artists scoring above this confidence level get blocked automatically
- **Flag for review threshold:** Artists scoring above this level appear in the popup for you to review manually

### Whitelist

Artists on your whitelist will never be blocked, even if they appear on the community list.

- Paste Spotify artist IDs (one per line) to protect specific artists
- Use **Import / Export** to back up or restore your whitelist

### Blocked Artists Viewer

See a full list of every artist PurePlay has blocked on your account. You can search by name or ID.

### Report AI Artist

Found an AI artist that isn't on the list yet? Report it to the community.

1. Paste the artist's Spotify URL or ID into the field
2. Add an optional reason
3. Click **Report on GitHub** — this opens a pre-filled GitHub issue for the community to review

---

## How to Find a Spotify Artist ID

You need the Artist ID to add someone to your whitelist or to report them. Here's the easiest way to find it:

### Using the Spotify Web Player (easiest method)

1. Go to [open.spotify.com](https://open.spotify.com) and search for the artist
2. Click on their name to open their artist page
3. Look at the **address bar** in your browser

The URL will look like this:

```
https://open.spotify.com/artist/4Z8WiqH9PZ97uS6Z2MjaSI?si=...
```

The Artist ID is the string of characters **between `/artist/` and the `?`**.

In the example above: **`4Z8WiqH9PZ97uS6Z2MjaSI`**

> The ID is always exactly 22 characters, containing only letters and numbers.

---

## Frequently Asked Questions

**Does PurePlay access my Spotify password or payment info?**  
No. It only reads the temporary session token that Spotify Web Player creates when you log in. This is the same kind of token Spotify uses internally to load your library.

**Will it slow down Spotify?**  
No. PurePlay runs in the background and only contacts Spotify briefly during sync. You won't notice any difference.

**How does it actually block artists?**  
It uses the same "block artist" feature built into Spotify — the same one you'd use if you right-clicked an artist and chose "Don't play this artist". PurePlay just does it in bulk automatically.

**Can I undo the blocks?**  
Yes. You can unblock artists directly in Spotify (artist page → three dots → Unblock). You can also enable "Unblock artists removed from the list" in settings, which will automatically unblock artists if they're ever removed from the community list.

**What is the community list?**  
It's a CSV file maintained by the [CennoxX/spotify-ai-blocker](https://github.com/CennoxX/spotify-ai-blocker) project. Anyone can submit new artists via GitHub Issues. PurePlay checks this list for updates every 24 hours by default.

**I whitelisted an artist and they still got blocked. Why?**  
Make sure you saved the settings after adding them to the whitelist. Also check that the ID you entered is correct — use the steps above to find the exact ID from the Spotify URL.

**The popup shows "No auth token". What do I do?**  
This means PurePlay hasn't captured your Spotify session yet. Make sure you have Spotify Web Player open at [open.spotify.com](https://open.spotify.com) in the same Chrome window, and that you're logged in. Try refreshing the Spotify tab. If the error persists, try clicking "Clear all data & reset" in Settings, then refresh Spotify.

---

## Contributing

Found an AI artist not on the list? Use the **Report AI Artist** feature in the settings page, or open an issue directly on the [community list repo](https://github.com/CennoxX/spotify-ai-blocker/issues/new).

---

## Acknowledgements

The artist blocklist is maintained by the community at [CennoxX/spotify-ai-blocker](https://github.com/CennoxX/spotify-ai-blocker). PurePlay is just a more convenient way to use it.
