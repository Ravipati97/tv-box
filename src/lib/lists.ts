import { supabase } from './supabase'
import type { ShowList, ShowListItem, ShowListWithCount } from '../types'

/** One user's lists, each with how many shows are on it -- for the "My
 * Lists" overview, without fetching every item of every list. */
export async function fetchListsForUser(userId: string): Promise<ShowListWithCount[]> {
  const { data, error } = await supabase
    .from('show_lists')
    .select('*, show_list_items(count)')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map((row) => {
    const { show_list_items, ...list } = row as ShowList & { show_list_items: { count: number }[] }
    return { ...list, itemCount: show_list_items?.[0]?.count ?? 0 }
  })
}

export async function fetchList(listId: string): Promise<ShowList | null> {
  const { data, error } = await supabase.from('show_lists').select('*').eq('id', listId).maybeSingle()
  if (error) throw error
  return (data as ShowList) ?? null
}

export async function fetchListItems(listId: string): Promise<ShowListItem[]> {
  const { data, error } = await supabase
    .from('show_list_items')
    .select('*')
    .eq('list_id', listId)
    .order('added_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as ShowListItem[]
}

/** Every list a show appears on, for a given user -- powers the "Add to a
 * list" picker's added/not-added state on ShowDetail. */
export async function fetchListMembershipForShow(userId: string, showId: number): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('show_list_items')
    .select('list_id, show_lists!inner(user_id)')
    .eq('show_id', showId)
    .eq('show_lists.user_id', userId)

  if (error) throw error
  return new Set((data ?? []).map((row) => row.list_id as string))
}

export async function createList(
  userId: string,
  name: string,
  description?: string | null,
): Promise<ShowList> {
  const { data, error } = await supabase
    .from('show_lists')
    .insert({ user_id: userId, name, description: description ?? null })
    .select()
    .single()

  if (error) throw error
  return data as ShowList
}

export async function deleteList(listId: string): Promise<void> {
  const { error } = await supabase.from('show_lists').delete().eq('id', listId)
  if (error) throw error
}

export interface AddToListInput {
  listId: string
  showId: number
  showName: string
  showPosterPath: string | null
}

export async function addShowToList(input: AddToListInput): Promise<ShowListItem> {
  const { data, error } = await supabase
    .from('show_list_items')
    .upsert(
      {
        list_id: input.listId,
        show_id: input.showId,
        show_name: input.showName,
        show_poster_path: input.showPosterPath,
      },
      { onConflict: 'list_id,show_id' },
    )
    .select()
    .single()

  if (error) throw error
  return data as ShowListItem
}

export async function removeShowFromList(listId: string, showId: number): Promise<void> {
  const { error } = await supabase.from('show_list_items').delete().eq('list_id', listId).eq('show_id', showId)
  if (error) throw error
}
