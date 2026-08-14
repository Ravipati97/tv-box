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

// --- App / Supabase shapes ---

/** A registered TV Box user. No password/verification -- see AuthContext. */
export interface AppUser {
  id: string
  email: string
  username: string
  created_at: string
}

export interface EpisodeRating {
  id: string
  user_id: string
  show_id: number
  show_name: string
  show_poster_path: string | null
  season_number: number
  episode_number: number
  episode_name: string | null
  rating: number
  rated_at: string
}

/** Keyed lookup: "season-episode" -> rating value */
export type RatingMap = Record<string, EpisodeRating>

/** An episode_ratings row joined with the rater's username (crowd view). */
export interface EpisodeRatingWithUser extends EpisodeRating {
  users: { username: string } | null
}

/** Keyed lookup: "season-episode" -> every rating (any user) for that episode */
export type CrowdMap = Record<string, EpisodeRatingWithUser[]>

export const REACTION_EMOJI = ['🔥', '😂', '😭', '💀'] as const
export type ReactionEmoji = (typeof REACTION_EMOJI)[number]

export interface RatingReaction {
  id: string
  rating_id: string
  user_id: string
  emoji: string
  created_at: string
}

/** Keyed lookup: episode_ratings.id -> every reaction on that rating */
export type ReactionMap = Record<string, RatingReaction[]>
