// --- TMDB API shapes (only the fields we use) ---

export interface TmdbShowSummary {
  id: number
  name: string
  poster_path: string | null
  first_air_date: string | null
  vote_average: number
}

export interface TmdbSeasonSummary {
  id: number
  season_number: number
  name: string
  episode_count: number
  poster_path: string | null
  air_date: string | null
}

export interface TmdbShowDetail {
  id: number
  name: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  first_air_date: string | null
  genres: { id: number; name: string }[]
  number_of_seasons: number
  number_of_episodes: number
  status: string
  seasons: TmdbSeasonSummary[]
}

export interface TmdbEpisode {
  id: number
  episode_number: number
  season_number: number
  name: string
  overview: string
  still_path: string | null
  air_date: string | null
  runtime: number | null
}

export interface TmdbSeasonDetail {
  id: number
  season_number: number
  name: string
  episodes: TmdbEpisode[]
}

// --- TMDB watch providers (sourced from JustWatch via TMDB's API) ---

export interface TmdbWatchProvider {
  provider_id: number
  provider_name: string
  logo_path: string | null
  display_priority: number
}

export interface TmdbWatchProviderRegion {
  /** TMDB's own watch page for this title/region -- has full deep links + JustWatch attribution. */
  link: string
  flatrate?: TmdbWatchProvider[]
  free?: TmdbWatchProvider[]
  ads?: TmdbWatchProvider[]
  rent?: TmdbWatchProvider[]
  buy?: TmdbWatchProvider[]
}

/** Keyed by ISO 3166-1 country code, e.g. results.US, results.GB. */
export interface TmdbWatchProviders {
  id: number
  results: Record<string, TmdbWatchProviderRegion>
}

/** One entry from the full /watch/providers/tv list (every provider TMDB knows about). */
export interface TmdbProviderListItem {
  provider_id: number
  provider_name: string
  logo_path: string | null
  display_priority: number
  display_priorities: Record<string, number>
}

// --- Manual "where to watch" correction (shared across the group) ---

export interface StreamingOverride {
  id: string
  show_id: number
  provider_id: number | null
  provider_name: string
  provider_logo_path: string | null
  updated_by: string | null
  updated_at: string
}

// --- App / Supabase shapes ---

/** A registered TV Box user. No password/verification -- see AuthContext. */
export interface AppUser {
  id: string
  email: string
  username: string
  created_at: string
}

/** One person's single rating for an entire show (replaces per-episode rating). */
export interface ShowRating {
  id: string
  user_id: string
  show_id: number
  show_name: string
  show_poster_path: string | null
  rating: number
  rated_at: string
}

/** A show_ratings row joined with the rater's username (crowd view). */
export interface ShowRatingWithUser extends ShowRating {
  users: { username: string } | null
}

/** One episode a person has marked watched. Presence = watched; no value/score. */
export interface EpisodeWatched {
  id: string
  user_id: string
  show_id: number
  show_name: string
  show_poster_path: string | null
  /** Snapshot of the show's total episode count as of this watch, for progress badges. */
  show_total_episodes: number | null
  season_number: number
  episode_number: number
  episode_name: string | null
  watched_at: string
  /** True when the actual date wasn't known and watched_at is just a placeholder. */
  watched_at_unknown: boolean
}

/** Keyed lookup: "season-episode" -> watched row, for one user's progress on one show. */
export type WatchedMap = Record<string, EpisodeWatched>
