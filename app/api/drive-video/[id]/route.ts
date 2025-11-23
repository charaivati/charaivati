// app/api/drive-video/[id]/route.ts
import { NextResponse } from "next/server";

/**
 * NOTE: This is a stub. You MUST implement server-side OAuth & token refresh,
 * use Google Drive "files.get?alt=media" to stream bytes, and set appropriate headers.
 *
 * Example flow:
 *  - Get service account / user oauth token
 *  - Call https://www.googleapis.com/drive/v3/files/{fileId}?alt=media with Authorization header
 *  - Stream the response back to client (pipe)
 *
 * For now this endpoint returns 501 to remind you to implement it.
 */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  return NextResponse.json({ ok: false, error: "Not implemented. Implement Drive streaming at /api/drive-video/[id]" }, { status: 501 });
}
