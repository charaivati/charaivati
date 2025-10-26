"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * UserDirectory_and_Profile.tsx
 * Single-file React component that shows:
 * - a responsive grid of user cards (fetches /api/users)
 * - click a user card to open a slide-over profile panel (fetches /api/users/:id)
 *
 * Tailwind CSS assumed. Uses framer-motion for smooth animations.
 * Drop this component into a Next.js client page (e.g. app/users/page.tsx or pages/users/index.tsx).
 *
 * Notes for integration:
 * - Implement API endpoints: GET /api/users -> list of users (id, name, avatar, title, shortBio)
 *                        GET /api/users/:id -> full user profile
 * - This component is intentionally framework-agnostic for client-side usage.
 */

type UserSummary = {
  id: string;
  name: string;
  avatar?: string | null;
  title?: string | null;
  shortBio?: string | null;
};

type UserProfile = UserSummary & {
  email?: string | null;
  location?: string | null;
  joinedAt?: string | null; // ISO date
  about?: string | null;
  links?: { label: string; href: string }[];
};

export default function UserDirectory() {
  const [users, setUsers] = useState<UserSummary[] | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoadingUsers(true);
    fetch("/api/users")
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load users: ${r.status}`);
        return r.json();
      })
      .then((data: UserSummary[]) => {
        if (!mounted) return;
        setUsers(data);
        setError(null);
      })
      .catch((err) => {
        console.error(err);
        if (!mounted) return;
        setError(err.message || "Failed to load users");
      })
      .finally(() => mounted && setLoadingUsers(false));

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedUserId) {
      setProfile(null);
      return;
    }

    let mounted = true;
    setLoadingProfile(true);
    fetch(`/api/users/${selectedUserId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load profile: ${r.status}`);
        return r.json();
      })
      .then((data: UserProfile) => {
        if (!mounted) return;
        setProfile(data);
      })
      .catch((err) => {
        console.error(err);
        if (!mounted) return;
        setError(err.message || "Failed to load profile");
      })
      .finally(() => mounted && setLoadingProfile(false));

    return () => {
      mounted = false;
    };
  }, [selectedUserId]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Users</h1>
          <div className="text-sm text-gray-600">{users ? `${users.length} users` : "Loading..."}</div>
        </header>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-red-700">{error}</div>
        )}

        {/* Users grid */}
        <section>
          {loadingUsers ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="animate-pulse p-4 bg-white rounded-lg shadow-sm border" />
              ))}
            </div>
          ) : users && users.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => setSelectedUserId(u.id)}
                  className="text-left group bg-white p-4 rounded-xl border hover:shadow-lg focus:shadow-outline transition-shadow duration-150"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center">
                      {u.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={u.avatar} alt={`${u.name} avatar`} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-lg font-medium text-gray-600">{initials(u.name)}</span>
                      )}
                    </div>
                    <div>
                      <div className="font-medium">{u.name}</div>
                      <div className="text-sm text-gray-500">{u.title || "Member"}</div>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-gray-600 line-clamp-3">{u.shortBio || "No bio provided."}</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-md border bg-white p-6 text-gray-600">No users found.</div>
          )}
        </section>

        {/* Slide-over profile */}
        <AnimatePresence>
          {selectedUserId && (
            <motion.aside
              key="profile-panel"
              initial={{ x: 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 400, opacity: 0 }}
              className="fixed top-0 right-0 h-full w-full md:w-[520px] bg-white shadow-2xl border-l z-50 overflow-auto"
            >
              <div className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center">
                      {profile?.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={profile.avatar} alt={profile?.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl font-medium text-gray-600">{profile ? initials(profile.name) : ""}</span>
                      )}
                    </div>
                    <div>
                      <div className="text-lg font-semibold">{profile?.name || (loadingProfile ? "Loading..." : "User")}</div>
                      <div className="text-sm text-gray-500">{profile?.title}</div>
                    </div>
                  </div>
                  <div>
                    <button
                      onClick={() => setSelectedUserId(null)}
                      className="rounded-md px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200"
                    >
                      Close
                    </button>
                  </div>
                </div>

                <div className="mt-6">
                  {loadingProfile ? (
                    <div className="space-y-3">
                      <div className="h-4 bg-gray-100 rounded w-3/4 animate-pulse"></div>
                      <div className="h-3 bg-gray-100 rounded w-1/2 animate-pulse"></div>
                      <div className="h-40 bg-gray-100 rounded animate-pulse"></div>
                    </div>
                  ) : profile ? (
                    <div className="space-y-4">
                      <div className="text-sm text-gray-600">{profile.about || "No additional info."}</div>

                      <dl className="grid grid-cols-1 gap-2 text-sm text-gray-700">
                        <div className="flex justify-between border rounded p-2">
                          <dt className="text-gray-500">Email</dt>
                          <dd>{profile.email || "-"}</dd>
                        </div>
                        <div className="flex justify-between border rounded p-2">
                          <dt className="text-gray-500">Location</dt>
                          <dd>{profile.location || "-"}</dd>
                        </div>
                        <div className="flex justify-between border rounded p-2">
                          <dt className="text-gray-500">Joined</dt>
                          <dd>{profile.joinedAt ? formatDate(profile.joinedAt) : "-"}</dd>
                        </div>
                      </dl>

                      {profile.links && profile.links.length > 0 && (
                        <div>
                          <h3 className="text-sm font-medium">Links</h3>
                          <ul className="mt-2 space-y-2">
                            {profile.links.map((l) => (
                              <li key={l.href}>
                                <a
                                  className="text-sm underline truncate block"
                                  target="_blank"
                                  rel="noreferrer"
                                  href={l.href}
                                >
                                  {l.label} — {l.href}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="pt-4 border-t flex gap-3">
                        <button className="flex-1 rounded-md px-4 py-2 border">Message</button>
                        <button className="rounded-md px-4 py-2 bg-blue-600 text-white">Make Admin</button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">No profile data.</div>
                  )}
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* light backdrop when profile open */}
      <AnimatePresence>
        {selectedUserId && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedUserId(null)}
            className="fixed inset-0 bg-black z-40"
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------- helpers ----------
function initials(name?: string) {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDate(iso?: string) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString();
  } catch (e) {
    return iso;
  }
}
