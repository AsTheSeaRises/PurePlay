# Spotify AI Blocker — Improvement Plan

A prioritised roadmap for improving [CennoxX/spotify-ai-blocker](https://github.com/CennoxX/spotify-ai-blocker), moving from a static community list to a more resilient, scalable, and user-friendly tool.

---

## P0 — Critical / Do First

### Differential Blocking (Performance & Safety)

- **Problem:** The script currently processes the full CSV artist list on every run. As the list grows (857+ commits and climbing), this means hundreds of POST requests to Spotify's private API per session — risking rate limiting or account flags.
- **Solution:** Track a `last_synced_commit` or `last_csv_hash` in localStorage. On each run, fetch only new/changed entries since the last sync and block only those. Unblock removed entries if applicable.
- **Bonus:** Reduces API call volume by 90%+ on typical runs.

### Error Handling & Retry Logic

- **Problem:** No described error handling. If Spotify's private API returns a 429 (rate limit) or 5xx, the script likely fails silently.
- **Solution:** Wrap block requests in try/catch with exponential backoff. Log failures to localStorage for later retry. Surface errors via console or UI.

---

## P1 — High Impact

### Heuristic Pre-Filter (Proactive Detection)

- **Problem:** The list is purely reactive — an AI artist must be manually reported, verified, and merged before any user is protected. New AI artists appear faster than the community can catalogue them.
- **Solution:** Add a heuristic scoring layer that flags *likely* AI artists based on observable metadata:
  - **Catalogue velocity:** New artist profile + high track count in short time (e.g. 50+ tracks within 3 months of first release).
  - **Track duration clustering:** AI tracks often cluster around 2:00–3:00 with low variance.
  - **Naming patterns:** Generic/formulaic artist names, song titles with repetitive structures.
  - **No Verified badge:** Absence of Spotify's "Verified by Spotify" designation.
  - **Missing external links:** No social media, no website, no label affiliation.
- **Approach:** Score each artist 0–100. Auto-block above a high-confidence threshold; flag for review in a mid-range; ignore below.
- **Stretch:** Integrate Deezer's open-source [AI music detection model](https://github.com/deezer/ismir25-ai-music-detector) as an external classifier for audio-level signals.

### UI Feedback & Status Indicator

- **Problem:** Users have no visibility into whether the script is running, what it's doing, or if it's broken.
- **Solution:** Add a lightweight status element (badge, floating indicator, or Tampermonkey menu entry) showing:
  - Last run timestamp.
  - Number of artists blocked (total and this session).
  - Any errors or skipped artists.
  - Link to manually trigger a re-sync.

---

## P2 — Medium Impact

### Browser Extension Packaging

- **Problem:** Tampermonkey is a high barrier to entry. Requires Chrome-specific permission grants and familiarity with userscript managers. Excludes Safari and mobile users entirely.
- **Solution:** Package as a Manifest V3 browser extension for Chrome and Firefox (Safari via WebExtension API as stretch). Benefits:
  - Proper auto-update mechanism via extension stores.
  - Options/settings page for user preferences (e.g. block threshold, whitelist).
  - Declarative permissions model (no need to explain Tampermonkey setup).
  - Better onboarding — one-click install from the Chrome Web Store.
- **Note:** The core blocking logic (token capture, API calls) stays the same; it's primarily a packaging and distribution change.

### False Positive Protection / Whitelist

- **Problem:** No mechanism to recover from false positives. If a legitimate artist is added to the CSV, users have to manually find and unblock them, and the script may re-block on the next run.
- **Solution:**
  - Maintain a user-local whitelist in localStorage. Whitelisted artist IDs are never blocked.
  - Add a "Report false positive" action (Tampermonkey menu or extension popup) that submits an issue or vote to the repo.
  - In the CSV/repo: add a verification confidence level or source field so contested entries can be flagged.

---

## P3 — Nice to Have

### Scalable Community Pipeline

- **Problem:** Submissions are GitHub issues, almost all from one contributor. Verification is manual and creates a single-maintainer bottleneck.
- **Solution:**
  - Automated pre-screening: a GitHub Action that runs heuristic checks on submitted artist IDs (fetch Spotify metadata via public endpoints, score against the heuristic rules) and auto-labels high-confidence submissions.
  - Community voting on borderline cases (could use GitHub reactions on issues as a lightweight mechanism).
  - Periodic bulk-scan of Spotify's catalogue for new artists matching heuristic patterns, generating candidate issues automatically.

### Cross-Platform Unification

- **Problem:** Multiple parallel projects exist (Spicetify plugin, this userscript, Soul Over AI list). They maintain separate lists and have no interoperability.
- **Solution:**
  - Publish the CSV as a shared, versioned API endpoint (e.g. a simple JSON API on GitHub Pages or a CDN).
  - Other tools (Spicetify plugins, mobile apps, other browser extensions) can consume the same canonical list.
  - Define a shared schema for artist entries (ID, name, confidence, source, date added).

### Analytics & Reporting Dashboard

- **Problem:** No aggregate visibility into the AI music landscape — how fast the list is growing, which genres are most affected, how many users are blocking.
- **Solution:** A simple static site (GitHub Pages) showing:
  - List growth over time.
  - Genre/style distribution of blocked artists.
  - Submission rate and verification backlog.
  - Opt-in anonymised usage stats (number of active script users, total blocks).

---

## Technical Notes

- **Spotify API fragility:** The script relies on undocumented private APIs and token capture via fetch hooks. Any Spotify web player update could break it. Consider abstracting the API interaction layer so it can be patched independently of the detection/UI logic.
- **ToS risk:** This approach technically violates Spotify's Terms of Service. No bans reported to date, but the differential blocking and rate limiting improvements in P0 directly reduce this risk surface.
- **Testing:** No test suite exists. Even basic integration tests (mock the Spotify API, verify block/unblock behaviour, test CSV parsing edge cases) would significantly improve contributor confidence.