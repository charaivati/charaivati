// lib/listener/actionTypes.ts
//
// PRIV-ACT-1: pure type definitions shared between lib/listener/actions.ts
// (server-only — imports db/aiClient) and client components under
// components/listen/ (FriendSearchCards, ReminderCard). This file must stay
// free of server-only imports so client components can import types from it
// without pulling in Prisma.

export interface FriendCandidate {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  location: string | null;
  relationship: "friends" | "outgoing" | "incoming" | "none";
}

export type ListenAction =
  | {
      type: "friend_search";
      query: { name: string; location: string | null };
      results: FriendCandidate[];
    }
  | {
      type: "friend_search_empty";
      query: { name: string; location: string | null };
    }
  | {
      type: "reminder_confirm";
      recipient: { id: string; name: string | null; avatarUrl: string | null };
      text: string;
    }
  | {
      type: "reminder_pick";
      candidates: { id: string; name: string | null; avatarUrl: string | null }[];
      text: string;
    }
  | {
      type: "reminder_non_friend";
      candidate: { id: string; name: string | null; avatarUrl: string | null; location: string | null };
      text: string;
    }
  | {
      type: "reminder_not_found";
      name: string;
    };
