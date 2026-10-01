export type TripFilterMember = { id: string; display_name: string; avatar_url: string | null };

export function parseMemberFilter(value: string, currentUserId?: string) {
  return [...new Set(value.split(",").map(id => id.trim()).filter(id => id !== currentUserId && /^[a-zA-Z0-9-]{1,80}$/.test(id)))].slice(0, 200);
}

export function collectFilterMembers(items: { members?: TripFilterMember[] }[], currentUserId?: string) {
  const members = new Map<string, TripFilterMember>();
  for (const item of items) for (const member of item.members || []) members.set(member.id, member);
  return [...members.values()].filter(member => member.id !== currentUserId).sort((a, b) => a.display_name.localeCompare(b.display_name, "th") || a.id.localeCompare(b.id));
}

export function matchesMemberFilter(members: { id: string }[] | undefined, selected: string[]) {
  return !selected.length || Boolean(members?.some(member => selected.includes(member.id)));
}

export function appendTripMemberFilter(where: string[], values: Array<string | number | number[] | string[]>, selected: string[]) {
  if (!selected.length) return;
  values.push(selected);
  const param = `$${values.length}::text[]`;
  where.push(`(t.owner_id::text=ANY(${param}) OR EXISTS(SELECT 1 FROM trip_collaborators selected_member WHERE selected_member.trip_id=t.id AND selected_member.user_id::text=ANY(${param})))`);
}

// Only accounts in trips the current user can access; independent of pagination/filters.
export const tripFilterMembersSql = `SELECT DISTINCT account.id::text AS id, account.display_name, account.avatar_url
  FROM trips t JOIN users account ON (account.id=t.owner_id OR EXISTS(
    SELECT 1 FROM trip_collaborators member WHERE member.trip_id=t.id AND member.user_id=account.id))
  WHERE t.owner_id=$1 OR EXISTS(SELECT 1 FROM trip_collaborators access WHERE access.trip_id=t.id AND access.user_id=$1)
  ORDER BY account.display_name, id`;
