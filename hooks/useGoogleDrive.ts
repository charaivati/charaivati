// ============================================================================
// COMPLETE FILE: hooks/useGoogleDrive.ts (UPDATED WITH PROXY URLS)
// ============================================================================
import { useEffect, useState, useCallback } from "react";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const SCOPES = ["https://www.googleapis.com/auth/drive.file"];
const DRIVE_FOLDER_NAME = "charaivati_content";
const CHUNK_SIZE = 10 * 1024 * 1024; // 10 MB

export type PostData = {
  id: string;
  author?: string | { name?: string; email?: string } | null;
  timeISO: string;
  content?: string;
  images?: string[];
  video?: { name: string; size: number; url: string; gdriveId?: string } | null;
  likes?: number;
  synced?: boolean;
  gdriveId?: string;
};

export type UserInfo = { name?: string; email?: string };

declare global {
  interface Window {
    google?: any;
    __charaivati_token_client?: any;
  }
}

export function useGoogleDrive() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ loaded: number; total: number; percent: number } | null>(null);

  async function debugFetch(url: string, opts: RequestInit = {}) {
    try {
      const resp = await fetch(url, opts);
      const text = await resp.text();
      let body: any = null;
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
      console.debug("debugFetch:", { url, status: resp.status, body });
      if (!resp.ok) {
        const errorInfo = {
          url,
          status: resp.status,
          statusText: resp.statusText,
          body,
          headers: Object.fromEntries(resp.headers.entries()),
        };
        console.error("debugFetch HTTP error:", errorInfo);
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }
      return body;
    } catch (err: any) {
      const errorDetails = {
        url,
        message: err?.message || String(err),
        name: err?.name,
        stack: err?.stack,
      };
      console.error("debugFetch error:", errorDetails);
      if (err instanceof Error) {
        throw err;
      }
      throw new Error(`debugFetch failed: ${err?.message || JSON.stringify(err)}`);
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return;

    const existingToken = localStorage.getItem("gdrive_token");
    const existingFolder = localStorage.getItem("gdrive_folder_id");
    const existingUser = localStorage.getItem("gdrive_user_info");

    if (existingToken) {
      setAccessToken(existingToken);
      setIsAuthenticated(true);
    }
    if (existingFolder) setFolderId(existingFolder);
    if (existingUser) {
      try {
        setUserInfo(JSON.parse(existingUser));
      } catch {
        setUserInfo(null);
      }
    }

    if (!window.google) {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.defer = true;
      s.onload = () => initGoogleClients();
      document.head.appendChild(s);
    } else {
      initGoogleClients();
    }
  }, []);

  function initGoogleClients() {
    if (!window.google) {
      console.warn("Google Identity script not present");
      return;
    }

    try {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (resp: any) => {
          try {
            const parts = (resp?.credential || "").split(".");
            if (parts.length >= 2) {
              const decoded = JSON.parse(atob(parts[1]));
              const u: UserInfo = { name: decoded?.name || decoded?.email, email: decoded?.email };
              setUserInfo(u);
              localStorage.setItem("gdrive_user_info", JSON.stringify(u));
            }
          } catch (e) {
            console.warn("Failed to decode ID token:", e);
          }
        },
      });
      try {
        window.google.accounts.id.prompt();
      } catch (e) {
        console.debug("accounts.id.prompt() failed or blocked:", e);
      }
    } catch (e) {
      console.warn("Failed to init ID client:", e);
    }

    try {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES.join(" "),
        prompt: "",
        callback: (tokenResponse: any) => {
          if (tokenResponse?.error) {
            console.error("Token client error:", tokenResponse);
            return;
          }
          console.log("Token received, setting authenticated state");
          setAccessToken(tokenResponse.access_token);
          setIsAuthenticated(true);
          localStorage.setItem("gdrive_token", tokenResponse.access_token);
          ensureFolder(tokenResponse.access_token).catch((e) => console.warn("ensureFolder error", e));
        },
      });
      window.__charaivati_token_client = tokenClient;
    } catch (e) {
      console.error("initTokenClient failed:", e);
    }
  }

  const connectDrive = useCallback(() => {
    const tc = (window as any).__charaivati_token_client;
    if (!tc) {
      console.warn("Token client not ready; ensure google identity script loaded");
      return;
    }
    try {
      console.log("Requesting access token...");
      tc.requestAccessToken({ prompt: "consent" });
    } catch (e) {
      console.error("tokenClient.requestAccessToken() failed:", e);
    }
  }, []);

  const disconnect = useCallback(() => {
    console.log("Disconnecting Drive...");
    setIsAuthenticated(false);
    setAccessToken(null);
    setFolderId(null);
    setUserInfo(null);
    localStorage.removeItem("gdrive_token");
    localStorage.removeItem("gdrive_folder_id");
    localStorage.removeItem("gdrive_user_info");
  }, []);

  const ensureFolder = useCallback(
    async (token?: string | null) => {
      try {
        const t = token ?? accessToken ?? localStorage.getItem("gdrive_token");
        if (!t) {
          console.warn("ensureFolder: no token");
          return null;
        }

        const existing = localStorage.getItem("gdrive_folder_id");
        if (existing) {
          setFolderId(existing);
          return existing;
        }

        const q = `name='${DRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&spaces=drive&fields=files(id,name)`;
        const resp = await debugFetch(url, { headers: { Authorization: `Bearer ${t}` } });
        let folderResult = resp?.files?.[0]?.id;
        if (!folderResult) {
          const createRes = await debugFetch("https://www.googleapis.com/drive/v3/files", {
            method: "POST",
            headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
            body: JSON.stringify({ name: DRIVE_FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }),
          });
          folderResult = createRes?.id;
        }
        if (folderResult) {
          setFolderId(folderResult);
          localStorage.setItem("gdrive_folder_id", folderResult);
          return folderResult;
        }
        return null;
      } catch (e: any) {
        console.error("ensureFolder failed:", {
          message: e?.message || String(e),
          name: e?.name,
        });
        return null;
      }
    },
    [accessToken]
  );

  const uploadFileMultipart = async (file: File, folderIdParam: string, token: string, namePrefix: string) => {
    if (!token || !folderIdParam) {
      console.warn("uploadFileMultipart missing token/folderId");
      return null;
    }
    try {
      const boundary = "-------CHUNK_" + Date.now();
      const meta = { name: `${namePrefix}_${file.name}`, parents: [folderIdParam] };
      const header = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n`;
      const fileHeader = `\r\n--${boundary}\r\nContent-Type: ${file.type || "application/octet-stream"}\r\n\r\n`;
      const footer = `\r\n--${boundary}--`;
      const arrayBuffer = await file.arrayBuffer();
      const parts = [new TextEncoder().encode(header), new TextEncoder().encode(fileHeader), new Uint8Array(arrayBuffer), new TextEncoder().encode(footer)];
      const body = new Blob(parts, { type: `multipart/related; boundary=${boundary}` });

      const url = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` },
        body,
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Multipart upload failed:", res.status, errorText);
        return null;
      }

      const data = await res.json();
      if (data?.id) {
        console.log("File uploaded successfully:", data.id);
        try {
          await fetch(`https://www.googleapis.com/drive/v3/files/${data.id}/permissions`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ role: "reader", type: "anyone" }),
          });
        } catch (permErr) {
          console.warn("Failed to set permission for file:", data.id);
        }
        return data.id;
      }
      console.error("uploadFileMultipart failed/no id:", data);
      return null;
    } catch (e) {
      console.error("uploadFileMultipart failed:", e);
      return null;
    }
  };

  const resumableUpload = async (file: File, token: string, folderIdParam: string, onProgress?: (p: { loaded: number; total: number; percent: number }) => void) => {
    if (!token || !folderIdParam) {
      console.warn("resumableUpload missing token/folderId");
      return null;
    }
    try {
      const initiate = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Upload-Content-Type": file.type || "application/octet-stream",
          "X-Upload-Content-Length": String(file.size),
        },
        body: JSON.stringify({ name: `${Date.now()}_${file.name}`, mimeType: file.type || "application/octet-stream", parents: [folderIdParam] }),
      });

      if (!initiate.ok) {
        const t = await initiate.text();
        console.error("resumable init failed", initiate.status, t);
        return null;
      }

      const uploadUrl = initiate.headers.get("location");
      if (!uploadUrl) throw new Error("No upload URL returned");

      let uploaded = 0;
      const total = file.size;
      for (let start = 0; start < total; start += CHUNK_SIZE) {
        const end = Math.min(start + CHUNK_SIZE, total);
        const chunk = file.slice(start, end);

        const putResp = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream", "Content-Range": `bytes ${start}-${end - 1}/${total}` },
          body: chunk,
        });

        if (putResp.status === 200 || putResp.status === 201) {
          const result = await putResp.json();
          try {
            await fetch(`https://www.googleapis.com/drive/v3/files/${result.id}/permissions`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
              body: JSON.stringify({ role: "reader", type: "anyone" }),
            });
          } catch (permErr) {
            console.warn("resumable: permission set failed");
          }
          return result.id;
        } else if (putResp.status !== 308) {
          const text = await putResp.text();
          console.error("Resumable chunk failed:", putResp.status, text);
          return null;
        }
        uploaded = end;
        onProgress?.({ loaded: uploaded, total, percent: Math.round((uploaded / total) * 100) });
      }
      return null;
    } catch (e) {
      console.error("resumableUpload error:", e);
      return null;
    }
  };

  const uploadPost = useCallback(
    async (post: PostData, imageFiles: File[], videoFile: File | null) => {
      const t = accessToken ?? localStorage.getItem("gdrive_token");
      let fId = folderId ?? localStorage.getItem("gdrive_folder_id");
      if (!t) {
        console.warn("uploadPost: no access token — call connectDrive()");
        return null;
      }
      if (!fId) {
        fId = await ensureFolder(t);
        if (!fId) {
          console.warn("uploadPost: could not create folder");
          return null;
        }
      }

      setLoading(true);
      const updated: PostData = { ...post };

      try {
        if (imageFiles && imageFiles.length > 0) {
          const urls: string[] = [];
          for (const f of imageFiles) {
            const id = await uploadFileMultipart(f, fId, t, `img_${Date.now()}`);
            // ✅ UPDATED: Use proxy URL instead of direct Google Drive link
            if (id) urls.push(`/api/social/proxy?id=${id}&type=image`);
          }
          if (urls.length) updated.images = urls;
        }

        if (videoFile) {
          const vidId = await resumableUpload(videoFile, t, fId, (p) => setUploadProgress(p));
          // ✅ UPDATED: Use proxy URL instead of direct Google Drive link
          if (vidId) updated.video = { name: videoFile.name, size: videoFile.size, url: `/api/social/proxy?id=${vidId}&type=video`, gdriveId: vidId };
        }

        try {
          const blob = new Blob([JSON.stringify(updated)], { type: "application/json" });
          const metaFile = new File([blob], `post_${post.id}.json`, { type: "application/json" });
          const metaId = await uploadFileMultipart(metaFile, fId, t, `post_${post.id}`);
          if (metaId) {
            updated.gdriveId = metaId;
            console.log("Post metadata uploaded:", metaId);
          }
        } catch (e) {
          console.warn("metadata upload failed", e);
        }

        setUploadProgress(null);
        setLoading(false);
        return updated;
      } catch (e: any) {
        console.error("uploadPost failed:", {
          message: e?.message || String(e),
          name: e?.name,
        });
        setUploadProgress(null);
        setLoading(false);
        return null;
      }
    },
    [accessToken, folderId, ensureFolder]
  );

  const fetchPosts = useCallback(async (): Promise<PostData[] | null> => {
    const t = accessToken ?? localStorage.getItem("gdrive_token");
    const fId = folderId ?? localStorage.getItem("gdrive_folder_id");

    if (!t) {
      console.warn("fetchPosts: no access token");
      return null;
    }
    if (!fId) {
      console.warn("fetchPosts: no folderId");
      return null;
    }

    try {
      const q = `'${fId}' in parents and name contains 'post_' and trashed=false`;
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&spaces=drive&fields=files(id,name)&pageSize=100&orderBy=modifiedTime desc`;

      const resp = await debugFetch(url, { headers: { Authorization: `Bearer ${t}` } });
      const posts: PostData[] = [];

      console.log("Found post files:", resp?.files?.length || 0);

      if (resp?.files && Array.isArray(resp.files)) {
        for (const f of resp.files) {
          try {
            const contentUrl = `https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`;
            const contentResp = await fetch(contentUrl, { headers: { Authorization: `Bearer ${t}` } });

            if (!contentResp.ok) {
              console.warn(`Failed to fetch post ${f.id}: ${contentResp.status}`);
              continue;
            }

            const txt = await contentResp.text();
            try {
              const parsed = JSON.parse(txt) as PostData;
              posts.push(parsed);
              console.log("Parsed post:", parsed.id);
            } catch {
              console.warn("Could not parse drive post JSON:", f.name);
            }
          } catch (innerErr) {
            console.warn("Failed to fetch post content:", f.name, innerErr);
          }
        }
      }

      console.log("Total posts loaded:", posts.length);
      return posts.sort((a, b) => new Date(b.timeISO).getTime() - new Date(a.timeISO).getTime());
    } catch (e) {
      console.error("fetchPosts error:", e);
      return null;
    }
  }, [accessToken, folderId]);

  return {
    isAuthenticated,
    accessToken,
    folderId,
    userInfo,
    loading,
    uploadProgress,
    connectDrive,
    disconnect,
    uploadPost,
    fetchPosts,
    ensureFolder,
  };
}