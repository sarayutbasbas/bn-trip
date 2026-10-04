type AvatarMember = { id: string; role: string; email?: string | null };

/** Reserve visible slots for the owner and email members, then render left to right. */
export function tripAvatarOrder<T extends AvatarMember>(members: T[], limit = 3) {
  const rank = (person: T) => person.role === "owner" ? 2 : person.id.startsWith("guest:") ? 0 : 1;
  const prioritized = [...members].sort((a, b) => rank(b) - rank(a));
  const visible = prioritized.slice(0, Math.max(1, limit)).reverse();
  return { visible, hidden: Math.max(0, members.length - visible.length) };
}
