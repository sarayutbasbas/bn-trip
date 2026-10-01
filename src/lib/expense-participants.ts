import type { SplitExpense } from "./personal-expenses";

type Member = { id: string; display_name: string | null; email: string | null; avatar_url: string | null };
type Guest = { id: string; name: string };

export function expenseParticipants(cost: SplitExpense, members: Member[], guests: Guest[]) {
  const selected = Array.isArray(cost.splitMemberIds) ? new Set(cost.splitMemberIds) : null;
  const selectedGuests = new Set(cost.splitGuestIds || []);
  return [
    ...members.filter((member) => !selected || selected.has(member.id)).map((member) => ({
      id: `member:${member.id}`, name: member.display_name || member.email || "?", avatar: member.avatar_url,
    })),
    ...guests.filter((guest) => selectedGuests.has(guest.id)).map((guest) => ({
      id: `guest:${guest.id}`, name: guest.name, avatar: null,
    })),
  ];
}
