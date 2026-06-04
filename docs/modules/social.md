---
module: social
type: api + component
source: app/api/friends/, app/api/circles/, app/api/social/, app/api/posts/, components/social/, components/FriendsList.tsx, components/FriendButton.tsx, components/FriendRequestsPanel.tsx, components/CirclesPanel.tsx
depends_on: [database, auth, user]
used_by: [chat, mobile-shell, navigation-tabs]
stability: stable
status: active
---

# Module: Social

## Purpose
Manages user-to-user relationships (friends, circles), social content (posts, feed), and friend request workflows. Provides the social graph that other features (chat, circles, feed) build on.

## Responsibilities
- Friend request lifecycle: send, accept, decline, remove
- Friend circle (group) CRUD and membership management
- Post creation, retrieval, deletion, and reactions (likes/dislikes)
- Social feed construction
- Rate limiting for post creation (via `social/limits`)
- Content proxying for external media (`social/proxy`)

## Inputs & Outputs

| Direction | Value |
|---|---|
| In | Authenticated user session |
| In | Target userId for friend request or circle member |
| In | Post content (text, image URLs, video URL, slug tags) |
| In | Reaction (like/dislike) on a post |
| Out | Friendship record (confirmed mutual connection) |
| Out | Ordered list of pending friend requests |
| Out | Friend circles with member lists |
| Out | Post feed (ordered by recency, filtered by visibility) |

## Dependencies
- **auth** — all social actions require a valid session
- **database** — Friendship, FriendRequest, FriendCircle, Post models
- **user** — user lookup for profile display on friend lists and posts

## Reverse Dependencies (what breaks if this changes)
- `Friendship` canonical ordering (`userAId < userBId`) is enforced in application code. Queries for friendships rely on this — removing or reversing the ordering in any write path causes duplicate records and broken lookups.
- `chat` module queries the `Friendship` table to verify two users are friends before allowing a DM conversation. Breaking friendship data breaks chat access control.
- Post `visibility: public | friends | private` is enforced at the API layer. Changing the enum values or removing the check exposes private content.

## Runtime Flow

### Sending a friend request
1. Client POSTs to `POST /api/friends/request` with target `userId`
2. API checks: not already friends, not already pending, not self
3. Creates `FriendRequest` with `status: pending`
4. TODO: Confirm whether a notification is sent to the receiver

### Accepting a friend request
1. Client POSTs to `POST /api/friends/accept` with `requestId`
2. API verifies current user is the receiver of the request
3. Updates `FriendRequest.status` to `accepted`
4. Creates `Friendship` with `userAId = min(a,b)`, `userBId = max(a,b)` (canonical ordering)

### Removing a friend
1. Client POSTs to `POST /api/friends/remove` with target `userId`
2. API deletes `Friendship` row (looks up both orderings to handle caller being either side)
3. TODO: Confirm whether pending requests between the two users are also cleaned up

### Creating a post
1. Client POSTs to `POST /api/social/post` or `POST /api/posts`
2. API checks rate limits via `GET /api/social/limits`
3. Creates `Post` with `userId`, content fields, `visibility`, and `slugTags`
4. Returns created post

### Feed retrieval
1. Client fetches `GET /api/social/posts` or `GET /api/posts`
2. API constructs feed: public posts + friends' posts for authenticated user
3. TODO: Confirm pagination strategy (cursor vs offset)

## Key API Routes

| Method | Route | Action |
|---|---|---|
| GET | /api/friends | List accepted friends |
| GET | /api/friends/request | List pending requests (received) |
| POST | /api/friends/request | Send friend request |
| POST | /api/friends/accept | Accept request |
| POST | /api/friends/decline | Decline request |
| POST | /api/friends/remove | Remove friendship |
| GET | /api/circles | List user's circles |
| POST | /api/circles | Create circle |
| GET | /api/circles/[id]/members | Circle member list |
| POST | /api/circles/[id]/members | Add member to circle |
| GET | /api/social/posts | Social feed |
| POST | /api/social/post | Create post |
| GET | /api/posts/[id] | Single post |
| DELETE | /api/posts/[id] | Delete post |
| POST | /api/posts/[id]/like | Like post |
| POST | /api/posts/[id]/dislike | Dislike post |
| GET | /api/social/limits | Check rate limits for post creation |

## Email Friend Invite

The `InviteFriend` component (exported from `components/social/FriendRequestsBox.tsx`) is a standalone widget for inviting non-users by email. It calls `POST /api/invite` and always shows the same generic success message regardless of whether the email is registered — enumeration prevention is fully server-side. See `docs/modules/auth.md` § Feature A for the full invite flow.

| Route | Action |
|---|---|
| `POST /api/invite` | Create invite — sends join email or security notice |
| `GET /claim/{token}` | Claim landing page (server component) |
| `POST /claim/{token}` (Server Action) | Atomic claim — upgrades shell user, creates session |

**Placing the widget:** Import `{ InviteFriend }` from `components/social/FriendRequestsBox.tsx` and render it anywhere a social or friends UI exists.

---

## Key Components

| Component | Role |
|---|---|
| `components/FriendButton.tsx` | Add/remove friend toggle button |
| `components/FriendsList.tsx` | Renders accepted friends list |
| `components/FriendRequestsPanel.tsx` | Full friend requests management panel |
| `components/social/FriendRequestsBox.tsx` | Compact friend requests box + exports `InviteFriend` widget |
| `components/CirclesPanel.tsx` | Circle CRUD and member management UI |

## Database Models Used
- `Friendship` — confirmed mutual connection (canonical order enforced)
- `FriendRequest` — pending/accepted/rejected invitation
- `FriendCircle` — named group owned by a user
- `FriendCircleMember` — M2M: circle ↔ user
- `Post` — user content with visibility and reactions

## Risks & Fragile Areas
- `Friendship` has no DB-level uniqueness constraint on the canonical pair — the application enforces `userAId < userBId`. Any write that bypasses this logic creates duplicate rows that break all friend queries.
- Declining a request sets `status: rejected` but does not delete the row. A re-request from the same sender may be blocked or create a duplicate depending on the check logic. TODO: Verify re-request behavior.
- `Post.likes` and `Post.dislikes` are stored as integers (counters), not as relational records. This means like/dislike attribution is lost — a user can like the same post multiple times unless the API enforces uniqueness. TODO: Verify deduplication logic.
- The `social/proxy` route is cached for 7 days (`Cache-Control: public, max-age=604800`). Cached proxied content cannot be invalidated before expiry.
- Rate limits for post creation are checked via a separate API call (`/api/social/limits`). A race condition is possible under concurrent requests.

## Backlinks
- [[START_HERE.md]] — social graph overview
- [[database.md]] — Friendship, Post model definitions
- [[chat.md]] — friendship check before DM creation
- [[user.md]] — user lookup for display names and avatars
- [[mobile-shell.md]] — social feed in mobile app
