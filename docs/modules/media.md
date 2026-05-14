---
module: media
type: library + api
source: hooks/useCloudinaryUpload.ts, hooks/useGoogleDrive.ts, app/api/cloudinary/, app/api/drive-video/
depends_on: [auth]
used_by: [user, store, pages, social]
stability: stable
status: active
---

# Module: Media

## Purpose
Handles all media upload, storage, and retrieval. Images and videos go to Cloudinary. Files go to AWS S3. Google Drive is integrated for video hosting and streaming. Upload authorization uses signed requests so credentials never reach the client.

## Responsibilities
- Generate signed Cloudinary upload parameters (server-side)
- Handle direct-to-Cloudinary image uploads (client-side, after signing)
- Store returned Cloudinary URLs on the relevant DB record
- Stream Google Drive videos via a server-side proxy route
- Provide a React hook for Cloudinary uploads
- Provide a React hook for Google Drive file selection

## Inputs & Outputs

| Direction | Value |
|---|---|
| In | Authenticated user session (for signing uploads) |
| In | Image file (browser File object) |
| In | Google Drive file ID |
| Out | Signed upload parameters (timestamp, signature, API key, cloud name) |
| Out | Cloudinary URL stored on User, Store, StoreBlock, StoreBanner, etc. |
| Out | Proxied video stream from Google Drive |

## Dependencies
- **auth** — upload signing requires a session to prevent unauthorized uploads
- **Cloudinary** — external service; credentials from `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- **AWS S3** — external; credentials from `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`
- **Google Drive API** — external; OAuth credentials required

## Reverse Dependencies (what breaks if this changes)
- `POST /api/cloudinary/sign` is called before every upload. If this endpoint changes its response shape, `hooks/useCloudinaryUpload.ts` fails silently and uploads are blocked.
- Cloudinary URLs stored in the DB are permanent references. Changing the Cloudinary cloud name or folder structure without migrating stored URLs breaks all image display.
- `GET /api/drive-video/[id]` proxies video streams. If Google Drive changes its download API or the OAuth token expires, all Drive-hosted videos stop streaming.
- The CSP `img-src` and `media-src` directives in `next.config.mjs` include `res.cloudinary.com`. Removing this breaks all Cloudinary image display.

## Runtime Flow

### Image upload (Cloudinary)
1. Client calls `hooks/useCloudinaryUpload.ts`
2. Hook POSTs to `POST /api/cloudinary/sign` with upload metadata
3. Server generates a signed upload request (timestamp + HMAC signature using API secret)
4. Client uploads file directly to Cloudinary using the signed parameters
5. Cloudinary returns a URL
6. Client saves the URL to the relevant resource (e.g. `POST /api/user/avatar`)

### Google Drive video streaming
1. Client renders a video player pointing to `GET /api/drive-video/[fileId]`
2. API route fetches the file from Google Drive using server-side OAuth credentials
3. Streams the response back to the client
4. Cloudinary CSP `frame-src` does not include Drive — Drive videos load as direct streams, not iframes

### Google Drive file selection
1. Client uses `hooks/useGoogleDrive.ts` to open a Drive file picker
2. User selects a file
3. Hook returns the Drive file ID
4. Client stores the file ID and constructs the proxy URL `/api/drive-video/[fileId]`

## Key API Routes

| Method | Route | Action |
|---|---|---|
| POST | /api/cloudinary/sign | Generate signed upload params |
| GET | /api/drive-video/[id] | Proxy-stream a Google Drive video |

## Key Hooks

| Hook | Role |
|---|---|
| `hooks/useCloudinaryUpload.ts` | Orchestrates signing + upload; returns URL and progress state |
| `hooks/useGoogleDrive.ts` | Opens Google Drive picker; returns selected file ID |

## Environment Variables Required
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_S3_BUCKET`
- Google OAuth credentials (TODO: confirm exact variable names)

## Database Models Used
Media URLs are stored as string fields on various models — there is no dedicated media table:
- `User.avatarUrl`
- `Page.avatarUrl`
- `StoreBlock.mediaUrl`
- `StoreBanner.imageUrl`
- `StoreImage.imageUrl` + `StoreImage.imageKey` (S3)
- `Post.imageUrls[]`, `Post.videoUrl`

## Risks & Fragile Areas
- No media deletion logic observed. When a store image is deleted from `StoreImage`, the Cloudinary/S3 object may remain, causing storage to grow indefinitely.
- `StoreImage.imageKey` suggests S3 storage for store images, while other images use Cloudinary URLs. The split between Cloudinary and S3 usage is not clearly documented. TODO: Confirm which media types go to which service.
- Google Drive OAuth token refresh behavior is unclear. If the token expires during a long video stream, the stream is interrupted. TODO: Confirm token refresh strategy in `app/api/drive-video/`.
- `hooks/useGoogleDrive.ts` requires the Google Drive Picker API script to be loaded. This is subject to the CSP `script-src` directive allowing `accounts.google.com`. Confirm the picker loads correctly in production.
- `images.unoptimized: true` is set in `next.config.mjs`. Next.js image optimization is disabled — all images are served at full resolution unless resized in Cloudinary transforms.

## Backlinks
- [[START_HERE.md]] — CSP and media source notes
- [[user.md]] — avatar upload flow
- [[store.md]] — product images, banners, store image library
- [[pages.md]] — page avatar images
- [[social.md]] — post image and video attachments
