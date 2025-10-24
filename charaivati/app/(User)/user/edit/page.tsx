// app/user/edit/page.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function EditProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  // keep a ref so we can call scrollToHash after data loads
  const didInitialScrollRef = useRef(false);

  // fetch profile safely with AbortController + alive guard
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    const email = localStorage.getItem("dev_email") || "mkeot2018@gmail.com";

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/user/profile?email=${encodeURIComponent(email)}`, {
          credentials: 'include',
          signal: controller.signal,
        });
        const d = await res.json().catch(() => null);
        if (!alive) return;
        // support both shapes: { ok: true, user: {...}} or { ok: true, profile: {...} }
        const u = d?.user ?? d?.profile ?? null;
        if (d?.ok) setProfile(u ?? {});
        else setProfile({});
      } catch (e: any) {
        if (e.name === "AbortError") return;
        console.error("fetch profile error", e);
        setError("Could not load profile");
        setProfile({});
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();

    return () => {
      alive = false;
      controller.abort();
    };
  }, []);

  /* -------------------------
     Scroll-to-hash logic
     - exposed as a function so we can call it after profile loads too
  ------------------------- */
  function scrollToHash(hash?: string) {
    if (typeof window === "undefined") return;
    const h = (hash ?? window.location.hash).replace('#', '');
    if (!h) return;
    const el = document.getElementById(h);
    if (!el) return;
    // small delay to ensure layout/async pieces render
    setTimeout(() => {
      try {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const firstInput = el.querySelector('input, textarea, select, button, [tabindex]') as HTMLElement | null;
        (firstInput ?? el as HTMLElement).focus?.();
      } catch {
        (el as HTMLElement).scrollIntoView();
      }
    }, 60);
  }

  // call initial scroll and listen for future hash changes
  useEffect(() => {
    scrollToHash();

    const onHash = () => scrollToHash(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // when profile loads, ensure we scroll once if there is a hash
  useEffect(() => {
    if (!loading && profile != null && !didInitialScrollRef.current) {
      didInitialScrollRef.current = true;
      scrollToHash();
    }
  }, [loading, profile]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const email = localStorage.getItem("dev_email") || "mkeot2018@gmail.com";
    const form = new FormData(e.target as HTMLFormElement);
    const payload: any = { email };

    const height = form.get("height");
    const weight = form.get("weight");
    const sleep = form.get("sleep");
    const steps = form.get("steps");
    const water = form.get("water");

    if (height) payload.heightCm = Number(height);
    if (weight) payload.weightKg = Number(weight);
    if (sleep) payload.sleepHours = Number(sleep);
    if (steps) payload.stepsToday = Number(steps);
    if (water) payload.waterLitres = Number(water);

    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        credentials: 'include',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { raw: text }; }

      if (!res.ok) {
        setError(`Save failed: ${JSON.stringify(data)}`);
        console.error("Save failed", res.status, data);
        return;
      }

      if (data?.ok) {
        // return to overview
        router.push("/user");
      } else {
        setError("Save did not return ok: " + JSON.stringify(data));
      }
    } catch (err: any) {
      console.error("Network/save error:", err);
      setError("Network error: " + (err?.message || String(err)));
    }
  }

  /* -------------------------
     Small inline Avatar uploader component
     - Minimal: validate, POST to /api/user/avatar (expects { ok, avatarUrl } response)
     - Refreshes the page data (router.refresh()) on success so user menu updates
  ------------------------- */
  function ProfileAvatarUploader({ currentUrl }: { currentUrl?: string | null }) {
    const router = useRouter();
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
    const [uploading, setUploading] = useState(false);
    const [uErr, setUErr] = useState<string | null>(null);

    function onFile(e: React.ChangeEvent<HTMLInputElement>) {
      setUErr(null);
      const f = e.target.files?.[0] ?? null;
      if (!f) return;
      if (!['image/png','image/jpeg','image/webp'].includes(f.type)) { setUErr('Use PNG/JPEG/WebP.'); return; }
      if (f.size > 5 * 1024 * 1024) { setUErr('Max 5 MB.'); return; }
      setFile(f);
      setPreview(URL.createObjectURL(f));
    }

    async function upload(e?: React.FormEvent) {
      e?.preventDefault();
      if (!file) { setUErr('Choose a file'); return; }
      setUploading(true);
      try {
        const fd = new FormData();
        fd.append('avatar', file);
        const res = await fetch('/api/user/avatar', { method: 'POST', body: fd, credentials: 'include' });
        const d = await res.json().catch(()=>null);
        if (!res.ok) {
          setUErr(d?.error || 'Upload failed');
          return;
        }
        // refresh to get updated avatar from server
        router.refresh();
        setFile(null);
        setPreview(null);
      } catch (err: any) {
        console.error('upload error', err);
        setUErr('Network error');
      } finally {
        setUploading(false);
      }
    }

    return (
      <form onSubmit={upload} className="flex items-center gap-4">
        <div className="w-24 h-24 rounded-full bg-gray-800 overflow-hidden">
          {preview ? <img src={preview} className="w-full h-full object-cover" alt="avatar preview" /> : (currentUrl ? <img src={currentUrl} className="w-full h-full object-cover" alt="avatar" /> : <div className="text-gray-400 text-sm p-3">No avatar</div>)}
        </div>

        <div className="flex flex-col gap-2">
          <input aria-label="Upload avatar" type="file" accept="image/png,image/jpeg,image/webp" onChange={onFile} />
          {uErr && <div className="text-red-400 text-sm">{uErr}</div>}
          <div className="flex gap-2">
            <button type="submit" className="px-3 py-1 rounded bg-green-600" disabled={uploading || !file}>
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
            <button type="button" className="px-3 py-1 rounded bg-gray-700" onClick={() => { setFile(null); setPreview(currentUrl ?? null); }}>
              Cancel
            </button>
          </div>
        </div>
      </form>
    );
  }

  return (
    <main className="min-h-screen p-6 bg-black text-white">
      <div className="max-w-2xl mx-auto bg-white/6 rounded-xl p-6 space-y-6">
        <h2 className="text-xl font-semibold mb-4">Edit</h2>

        {/* Profile section (avatar, name, bio) */}
        <section id="profile" tabIndex={-1} className="rounded p-4 bg-black/20 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <h3 className="text-lg font-semibold mb-2">Profile</h3>

          {/* Avatar uploader (currentUrl from profile if present) */}
          <ProfileAvatarUploader currentUrl={profile?.avatarUrl ?? null} />

          <div className="mt-4">
            <label className="block">
              <div className="text-sm text-gray-300">Display name</div>
              <input name="displayName" defaultValue={profile?.displayName ?? profile?.profile?.displayName ?? ""} className="w-full p-2 rounded bg-black/40" />
            </label>

            <label className="block mt-3">
              <div className="text-sm text-gray-300">Bio</div>
              <textarea name="bio" defaultValue={profile?.bio ?? profile?.profile?.bio ?? ""} className="w-full p-2 rounded bg-black/40" rows={3} />
            </label>
          </div>
        </section>

        {/* Health section (keeps your existing form) */}
        <section id="health" tabIndex={-1} className="rounded p-4 bg-black/20 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <h3 className="text-lg font-semibold mb-2">Health</h3>

          {loading ? (
            <div>Loading...</div>
          ) : (
            <form onSubmit={save} className="space-y-4">
              {error && <div className="text-red-400">{error}</div>}

              <label className="block">
                <div className="text-sm text-gray-300">Height (cm)</div>
                <input type="number" name="height" defaultValue={profile?.heightCm ?? profile?.profile?.heightCm ?? ""} className="w-full p-2 rounded bg-black/40" />
              </label>

              <label className="block">
                <div className="text-sm text-gray-300">Weight (kg)</div>
                <input type="number" step="0.1" name="weight" defaultValue={profile?.weightKg ?? profile?.profile?.weightKg ?? ""} className="w-full p-2 rounded bg-black/40" />
              </label>

              <label className="block">
                <div className="text-sm text-gray-300">Sleep hours (last night)</div>
                <input type="number" step="0.1" name="sleep" defaultValue={profile?.sleepHours ?? profile?.profile?.sleepHours ?? ""} className="w-full p-2 rounded bg-black/40" />
              </label>

              <label className="block">
                <div className="text-sm text-gray-300">Steps today</div>
                <input type="number" name="steps" defaultValue={profile?.stepsToday ?? profile?.profile?.stepsToday ?? ""} className="w-full p-2 rounded bg-black/40" />
              </label>

              <label className="block">
                <div className="text-sm text-gray-300">Water (litres today)</div>
                <input type="number" step="0.1" name="water" defaultValue={profile?.waterLitres ?? profile?.profile?.waterLitres ?? ""} className="w-full p-2 rounded bg-black/40" />
              </label>

              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => router.back()} className="px-4 py-2 rounded bg-gray-700">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded bg-green-600">Save</button>
              </div>
            </form>
          )}
        </section>

        {/* Learning section */}
        <section id="learning" tabIndex={-1} className="rounded p-4 bg-black/20 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <h3 className="text-lg font-semibold mb-2">Learning</h3>
          <div>Learning settings...</div>
        </section>

        {/* Earning section */}
        <section id="earning" tabIndex={-1} className="rounded p-4 bg-black/20 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <h3 className="text-lg font-semibold mb-2">Earning</h3>
          <div>Earning settings...</div>
        </section>

        {/* Social section */}
        <section id="social" tabIndex={-1} className="rounded p-4 bg-black/20 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <h3 className="text-lg font-semibold mb-2">Social</h3>
          <div>Social settings...</div>
        </section>
      </div>
    </main>
  );
}
