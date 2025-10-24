// app/(user)/user/registration/page.tsx
"use client";

import React from "react";
import UserFormModal from "@/components/UserFormModal"; // adjust path if different

export default function RegistrationPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-black text-white p-6">
      <div className="max-w-2xl w-full">
        <h1 className="text-2xl font-semibold mb-4">Register / Join</h1>
        <p className="mb-6 text-sm text-gray-300">Click the button to open the registration form.</p>

        {/* The modal component shows a button and opens itself */}
        <UserFormModal />
      </div>
    </main>
  );
}
