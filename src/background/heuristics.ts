import { SPOTIFY_API_BASE } from "../shared/constants";
import type { ArtistEntry, FlaggedArtist, HeuristicScore } from "../shared/types";

interface SpotifyArtist {
  id: string;
  name: string;
  popularity: number;
  followers: { total: number };
  external_urls: { spotify: string };
  genres: string[];
}

interface SpotifyAlbum {
  id: string;
  release_date: string;
  total_tracks: number;
}

interface SpotifyTrack {
  duration_ms: number;
}

async function spotifyGet<T>(path: string, token: string): Promise<T | null> {
  try {
    const res = await fetch(`${SPOTIFY_API_BASE}${path}`, {
      headers: { Authorization: token },
    });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

function stdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function monthsBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA);
  const b = new Date(dateB);
  return Math.abs((b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()));
}

const AI_NAME_PATTERNS = [
  /^[a-z\s]+$/, // all lowercase, no uppercase at all
  /\b(lofi|lo-fi|chill|study|sleep|relax|focus|ambient)\b/i,
  /^\w+\s+(beats?|sounds?|music|vibes?|waves?)$/i,
  /^(the\s+)?\w+\s+\w+\s+(project|collective|ensemble)$/i,
];

function scoreNamingPatterns(name: string): number {
  let matches = 0;
  for (const pattern of AI_NAME_PATTERNS) {
    if (pattern.test(name)) matches++;
  }
  return Math.min(matches * 5, 10); // max 10 pts
}

export async function scoreArtist(
  artist: ArtistEntry,
  token: string
): Promise<HeuristicScore | null> {
  const artistData = await spotifyGet<SpotifyArtist>(`/artists/${artist.id}`, token);
  if (!artistData) return null;

  const signals: Record<string, number> = {};
  let totalScore = 0;

  // Signal 1: Naming patterns (10 pts)
  signals.namingPatterns = scoreNamingPatterns(artistData.name);
  totalScore += signals.namingPatterns;

  // Signal 2: Low followers relative to popularity (10 pts)
  const { total: followers } = artistData.followers;
  if (followers < 100 && artistData.popularity > 10) {
    signals.lowFollowers = 10;
  } else if (followers < 500) {
    signals.lowFollowers = 5;
  } else {
    signals.lowFollowers = 0;
  }
  totalScore += signals.lowFollowers;

  // Signal 3: Missing external links (15 pts) — only Spotify URL means no socials
  const externalKeys = Object.keys(artistData.external_urls);
  signals.missingLinks = externalKeys.length <= 1 ? 15 : 0;
  totalScore += signals.missingLinks;

  // Signal 4 & 5: Catalogue velocity + track duration clustering (50 pts combined)
  const albumsData = await spotifyGet<{ items: SpotifyAlbum[]; total: number }>(
    `/artists/${artist.id}/albums?limit=50&include_groups=single,album`,
    token
  );

  if (albumsData && albumsData.items.length > 0) {
    const albums = albumsData.items;
    const totalTracks = albums.reduce((sum, a) => sum + a.total_tracks, 0);

    // Sort by release date to find span
    const dates = albums
      .map((a) => a.release_date)
      .filter(Boolean)
      .sort();

    const spanMonths = dates.length >= 2 ? monthsBetween(dates[0], dates[dates.length - 1]) : 0;
    const tracksPerMonth = spanMonths > 0 ? totalTracks / spanMonths : totalTracks;

    // Score velocity: 50+ tracks in <3 months is peak AI behaviour
    if (tracksPerMonth >= 16 || (totalTracks >= 50 && spanMonths <= 3)) {
      signals.catalogueVelocity = 30;
    } else if (tracksPerMonth >= 8) {
      signals.catalogueVelocity = 15;
    } else {
      signals.catalogueVelocity = 0;
    }
    totalScore += signals.catalogueVelocity;

    // Sample track durations from first album
    if (albums[0]) {
      const tracksData = await spotifyGet<{ items: SpotifyTrack[] }>(
        `/albums/${albums[0].id}/tracks?limit=50`,
        token
      );

      if (tracksData && tracksData.items.length > 0) {
        const durations = tracksData.items.map((t) => t.duration_ms / 1000); // convert to seconds
        const meanDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
        const durationStdDev = stdDev(durations);

        // AI tracks cluster 120-180s with very low variance
        if (meanDuration >= 110 && meanDuration <= 190 && durationStdDev < 20) {
          signals.durationClustering = 20;
        } else if (meanDuration >= 100 && meanDuration <= 200 && durationStdDev < 30) {
          signals.durationClustering = 10;
        } else {
          signals.durationClustering = 0;
        }
        totalScore += signals.durationClustering;
      }
    }
  }

  // Signal 6: No verified badge via genres proxy (15 pts)
  // No public API for verified badge; use genre count as a proxy —
  // AI artists typically have 0 or very generic genres
  if (artistData.genres.length === 0) {
    signals.noVerifiedProxy = 15;
  } else if (artistData.genres.length <= 1) {
    signals.noVerifiedProxy = 7;
  } else {
    signals.noVerifiedProxy = 0;
  }
  totalScore += signals.noVerifiedProxy;

  const score = Math.min(totalScore, 100);

  let status: HeuristicScore["status"];
  // Thresholds determined by settings at call time — callers pass them via settings
  // Here we just set raw status; service-worker applies threshold logic
  if (score >= 80) {
    status = "auto-blocked";
  } else if (score >= 50) {
    status = "flagged";
  } else {
    status = "ignored";
  }

  return {
    score,
    signals,
    scoredAt: Date.now(),
    status,
  };
}

export function toFlaggedArtist(artist: ArtistEntry, score: HeuristicScore): FlaggedArtist {
  return {
    id: artist.id,
    name: artist.name,
    score: score.score,
    scoredAt: score.scoredAt,
  };
}
