// hooks/useCloudinaryUpload.ts
import { useState } from "react";

export interface CloudinaryUploadResult {
  imageUrls: string[];
  videoUrl: string | null;
}

export interface UseCloudinaryUpload {
  uploading: boolean;
  progress: number;
  uploadFiles: (images: File[], video: File | null) => Promise<CloudinaryUploadResult>;
}

export function useCloudinaryUpload(): UseCloudinaryUpload {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  async function uploadSingle(file: File, doneCount: number, total: number): Promise<string> {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      throw new Error("Cloudinary env vars not configured (NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME / NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET)");
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);
    formData.append("folder", "posts");

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
      { method: "POST", body: formData }
    );

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`Cloudinary upload failed (${res.status}): ${text}`);
    }

    const data = await res.json();
    setProgress(Math.round(((doneCount + 1) / total) * 100));
    return data.secure_url as string;
  }

  async function uploadFiles(
    images: File[],
    video: File | null
  ): Promise<CloudinaryUploadResult> {
    const total = images.length + (video ? 1 : 0);

    if (total === 0) {
      return { imageUrls: [], videoUrl: null };
    }

    setUploading(true);
    setProgress(0);

    try {
      const imageUrls: string[] = [];
      for (let i = 0; i < images.length; i++) {
        const url = await uploadSingle(images[i], i, total);
        imageUrls.push(url);
      }

      let videoUrl: string | null = null;
      if (video) {
        videoUrl = await uploadSingle(video, images.length, total);
      }

      return { imageUrls, videoUrl };
    } finally {
      setUploading(false);
    }
  }

  return { uploading, progress, uploadFiles };
}
