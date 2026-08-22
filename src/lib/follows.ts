import { supabase } from './supabase'
import type { AppUser, Follow } from '../types'

/** Every id current user follows -- powers "Following" scope filters and
 * per-row Follow/Following button state across Find People and the
 * follower/following lists. */
export async function fetchFollowingIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from('follows').select('followed_id').eq('follower_id', userId)
  if (error) throw error
  return new Set((data ?? []).map((r) => r.followed_id as string))
}

/** Every id that follows this user -- used to render "Follows you" badges. */
export async function fetchFollowerIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from('follows').select('follower_id').eq('followed_id', userId)
  if (error) throw error
  return new Set((data ?? []).map((r) => r.follower_id as string))
}

export async function isFollowingUser(followerId: string, followedId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('follows')
    .select('id')
    .eq('follower_id', followerId)
    .eq('followed_id', followedId)
    .maybeSingle()

  if (error) throw error
  return Boolean(data)
}

export async function fetchFollowCounts(userId: string): Promise<{ followers: number; following: number }> {
  const [followers, following] = await Promise.all([
    supabase.from('follows').select('id', { count: 'exact', head: true }).eq('followed_id', userId),
    supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', userId),
  ])
  if (followers.error) throw followers.error
  if (following.error) throw following.error
  return { followers: followers.count ?? 0, following: following.count ?? 0 }
}

export async function followUser(followerId: string, followedId: string): Promise<Follow> {
  const { data, error } = await supabase
    .from('follows')
    .insert({ follower_id: followerId, followed_id: followedId })
    .select()
    .single()

  if (error) throw error
  return data as Follow
}

export async function unfollowUser(followerId: string, followedId: string): Promise<void> {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('followed_id', followedId)

  if (error) throw error
}

/** Resolves a list of user ids against the users table and returns them as
 * AppUser rows in the *same order* as the input ids. Two-step (ids, then a
 * batched `.in()` lookup) rather than an embedded join on `follows` --
 * follows has two FKs to users (follower_id, followed_id), and PostgREST
 * needs an explicit constraint-name hint to disambiguate an embedded join
 * on a table shaped like that. A plain lookup sidesteps that fragility
 * entirely, at the cost of one extra round trip. */
async function resolveUsersInOrder(ids: string[]): Promise<AppUser[]> {
  if (ids.length === 0) return []
  const { data, error } = await supabase.from('users').select('*').in('id', ids)
  if (error) throw error
  const byId = new Map((data ?? []).map((u) => [(u as AppUser).id, u as AppUser]))
  // .in() doesn't preserve input order -- re-sort to match the caller's
  // (already-chronological) order rather than whatever Postgres returns.
  return ids.map((id) => byId.get(id)).filter((u): u is AppUser => Boolean(u))
}

/** Followers of userId, most recently followed first -- powers
 * FollowListPanel's "Followers" mode. */
export async function fetchFollowersWithUsers(userId: string): Promise<AppUser[]> {
  const { data, error } = await supabase
    .from('follows')
    .select('follower_id, created_at')
    .eq('followed_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return resolveUsersInOrder((data ?? []).map((r) => r.follower_id as string))
}

/** Who userId follows, most recently followed first -- powers
 * FollowListPanel's "Following" mode. */
export async function fetchFollowingWithUsers(userId: string): Promise<AppUser[]> {
  const { data, error } = await supabase
    .from('follows')
    .select('followed_id, created_at')
    .eq('follower_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return resolveUsersInOrder((data ?? []).map((r) => r.followed_id as string))
}

/** Every follow edge across the group -- powers the Activity feed's "X
 * started following Y" events, same idea as fetchRecentShowRatingsAllUsers. */
export async function fetchAllFollows(limit = 500): Promise<Follow[]> {
  const { data, error } = await supabase
    .from('follows')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []) as Follow[]
}

/** How many people have followed userId since they last opened
 * notifications -- powers NotificationsBell's unread dot. */
export async function fetchNewFollowerCount(userId: string): Promise<number> {
  const { data: userRow, error: userError } = await supabase
    .from('users')
    .select('notifications_seen_at')
    .eq('id', userId)
    .single()

  if (userError) throw userError
  const seenAt = (userRow as { notifications_seen_at: string }).notifications_seen_at

  const { count, error } = await supabase
    .from('follows')
    .select('id', { count: 'exact', head: true })
    .eq('followed_id', userId)
    .gt('created_at', seenAt)

  if (error) throw error
  return count ?? 0
}

/** Marks all current followers as "seen" -- called when the notifications
 * panel opens, clearing the unread dot. */
export async function markFollowNotificationsSeen(userId: string): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ notifications_seen_at: new Date().toISOString() })
    .eq('id', userId)

  if (error) throw error
}

export interface RecentFollowerNotification {
  followId: string
  followerId: string
  followerUsername: string
  createdAt: string
}

/** Recent "X followed you" entries for the notifications panel. */
export async function fetchRecentFollowerNotifications(
  userId: string,
  limit = 20,
): Promise<RecentFollowerNotification[]> {
  const { data, error } = await supabase
    .from('follows')
    .select('id, follower_id, created_at')
    .eq('followed_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  const rows = data ?? []
  const users = await resolveUsersInOrder(rows.map((r) => r.follower_id as string))
  const usernameById = new Map(users.map((u) => [u.id, u.username]))

  return rows.map((r) => ({
    followId: r.id as string,
    followerId: r.follower_id as string,
    followerUsername: usernameById.get(r.follower_id as string) ?? 'unknown',
    createdAt: r.created_at as string,
  }))
}
