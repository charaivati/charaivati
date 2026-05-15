const CLOUD_NAME = "dyphnp3oc";
const UPLOAD_PRESET = "posts_unsigned";
const FOLDER = "posts";

export type StoreImageRecord = {
  id: string;
  url: string;
  cloudinaryId: string | null;
  fileHash: string;
  fileName: string | null;
  uploadedAt: string;
};

export type UploadResult = StoreImageRecord & { alreadyExisted: boolean };

export async function uploadStoreImage(file: File, storeId: string): Promise<UploadResult> {
  // Step 1 — hash client-side
  const hashBuffer = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  const fileHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Step 2 — DB check first
  const checkRes = await fetch("/api/store/images/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ storeId, fileHash }),
  });
  if (checkRes.ok) {
    const checkData = await checkRes.json();
    if (checkData.exists) {
      return { ...checkData.image, alreadyExisted: true };
    }
  }

  // Step 3 — upload to Cloudinary with hash as public_id
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", UPLOAD_PRESET);
  fd.append("folder", FOLDER);
  fd.append("public_id", fileHash);

  const cloudRes = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: "POST",
    body: fd,
  });
  const cloudData = await cloudRes.json();
  if (!cloudData.secure_url) {
    throw new Error("Cloudinary upload failed");
  }

  // Step 4 — save to DB (upsert handles race conditions)
  const saveRes = await fetch("/api/store/images/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      storeId,
      url: cloudData.secure_url,
      cloudinaryId: cloudData.public_id ?? null,
      fileHash,
      fileName: file.name ?? null,
    }),
  });
  if (!saveRes.ok) throw new Error("Failed to save image to library");

  const saved: StoreImageRecord = await saveRes.json();
  return { ...saved, alreadyExisted: false };
}
