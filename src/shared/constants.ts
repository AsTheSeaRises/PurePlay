export const CSV_REPO_OWNER = "CennoxX";
export const CSV_REPO_NAME = "spotify-ai-blocker";
export const CSV_FILE_PATH = "SpotifyAiArtists.csv";
export const CSV_RAW_URL = `https://raw.githubusercontent.com/${CSV_REPO_OWNER}/${CSV_REPO_NAME}/main/${CSV_FILE_PATH}`;
export const CSV_COMMITS_API_URL = `https://api.github.com/repos/${CSV_REPO_OWNER}/${CSV_REPO_NAME}/commits?path=${CSV_FILE_PATH}&per_page=1`;

export const SPOTIFY_BLOCK_API = "https://spclient.wg.spotify.com/collection/v2/write";
export const SPOTIFY_API_BASE = "https://api.spotify.com/v1";
export const SPOTIFY_ARTIST_VIEW_API = "https://spclient.wg.spotify.com/artistview/v1/artist";

export const ALARM_NAME = "pureplay-sync";
export const TOKEN_MESSAGE_TYPE = "PUREPLAY_TOKEN";
export const BLOCK_BATCH_SIZE = 50;
export const MAX_RETRY_ATTEMPTS = 5;
export const RETRY_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const DEFAULT_SETTINGS = {
  syncFrequencyHours: 24,
  heuristicsEnabled: false,
  autoBlockThreshold: 80,
  flagThreshold: 50,
  unblockRemovedArtists: false,
  csvSourceUrl: CSV_RAW_URL,
};

export const STORAGE_KEYS = {
  AUTH_TOKEN: "authToken",
  USERNAME: "username",
  LAST_SYNC_SHA: "lastSyncSha",
  LAST_SYNC_TIMESTAMP: "lastSyncTimestamp",
  LAST_KNOWN_ARTIST_IDS: "lastKnownArtistIds",
  BLOCKED_ARTIST_IDS: "blockedArtistIds",
  SESSION_BLOCK_COUNT: "sessionBlockCount",
  TOTAL_BLOCK_COUNT: "totalBlockCount",
  RETRY_QUEUE: "retryQueue",
  HEURISTIC_SCORES: "heuristicScores",
  FLAGGED_ARTISTS: "flaggedArtists",
  WHITELIST: "whitelist",
  SETTINGS: "settings",
  ERRORS: "errors",
} as const;
