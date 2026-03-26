// lib/ProfileContext.tsx
"use client";

import React, { createContext, useContext } from "react";

type ProfileContextValue = {
  profile: any | null;
  profileLoading: false; // always false — data comes from server
};

const ProfileContext = createContext<ProfileContextValue>({
  profile: null,
  profileLoading: false,
});

export function ProfileProvider({
  profile,
  children,
}: {
  profile: any | null;
  children: React.ReactNode;
}) {
  return (
    <ProfileContext.Provider value={{ profile, profileLoading: false }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}