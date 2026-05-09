import { CSV_COMMITS_API_URL, CSV_RAW_URL } from "../shared/constants";
import { storage } from "../shared/storage";
import type { ArtistEntry, SyncResult } from "../shared/types";

interface GitHubCommit {
  sha: string;
}

async function fetchLatestSha(): Promise<string | null> {
  try {
    const res = await fetch(CSV_COMMITS_API_URL);
    if (!res.ok) return null;
    const commits: GitHubCommit[] = await res.json();
    return commits[0]?.sha ?? null;
  } catch {
    return null;
  }
}

function parseCsv(text: string): ArtistEntry[] {
  const lines = text.trim().split("\n");
  const entries: ArtistEntry[] = [];

  for (let i = 1; i < lines.length; i++) { // skip header
    const line = lines[i].trim();
    if (!line) continue;

    // CSV format: "Artist Name","artistId"
    const parts = line.split(",");
    if (parts.length < 2) continue;

    const name = parts[0].replace(/^"|"$/g, "").trim();
    const id = parts[parts.length - 1].replace(/^"|"$/g, "").trim();

    if (id) {
      entries.push({ id, name });
    }
  }

  return entries;
}

async function fetchCsv(url: string): Promise<ArtistEntry[]> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch CSV: ${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  return parseCsv(text);
}

export async function fetchAndDiff(csvUrl: string = CSV_RAW_URL): Promise<SyncResult | null> {
  const latestSha = await fetchLatestSha();
  const lastSha = await storage.getLastSyncSha();

  if (latestSha && latestSha === lastSha) {
    // No changes since last sync
    return null;
  }

  const fullList = await fetchCsv(csvUrl);
  const currentIds = new Set(fullList.map((a) => a.id));
  const lastIds = new Set(await storage.getLastKnownArtistIds());

  const newArtists = fullList.filter((a) => !lastIds.has(a.id));
  const removedArtistIds = [...lastIds].filter((id) => !currentIds.has(id));
  const removedArtists: ArtistEntry[] = removedArtistIds.map((id) => ({ id, name: "" }));

  const sha = latestSha ?? `hash-${Date.now()}`;

  return { newArtists, removedArtists, fullList, sha };
}
