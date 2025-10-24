"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setMessage("Logging in...");

    try {
      const res = await fetch("/api/user/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage("❌ " + (data?.error || "Login failed"));
        return;
      }

      // success — ensure session cookie present (if server sets cookie)
      setMessage("✅ Login successful! Redirecting...");

      // prefer client-side navigation
      try {
        // use next/navigation router first
        router.push("/user");
      } catch (err) {
        // fallback to full page redirect
        window.location.href = "/user";
      }
    } catch (err: any) {
      console.error(err);
      setMessage("Network error");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="w-full max-w-md bg-white/10 rounded-xl p-6 shadow-lg">
        <h1 className="text-2xl font-semibold mb-4">Login</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="Email" className="w-full p-2 rounded bg-black/50 border border-gray-600" />
          <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Password" className="w-full p-2 rounded bg-black/50 border border-gray-600" />
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 p-2 rounded-lg">Login</button>
        </form>
        {message && <p className="mt-3 text-sm">{message}</p>}
      </div>
    </main>
  );
}
