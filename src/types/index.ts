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
