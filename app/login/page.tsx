'use client';

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ensureSessionId, getStoredUser, setStoredUser } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const existing = getStoredUser();
    if (existing) {
      setUserId(existing.userId);
      setName(existing.name);
    }
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!userId.trim() || !name.trim()) {
      setError("Both fields are required.");
      return;
    }

    ensureSessionId();
    setStoredUser({ userId: userId.trim(), name: name.trim() });
    router.replace("/");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg"
      >
        <h1 className="mb-4 text-2xl font-semibold text-slate-900">Sign in</h1>
        <p className="mb-6 text-sm text-slate-600">
          Enter any user ID and display name to start the reservation queue demo.
        </p>
        <label className="mb-4 block text-sm font-medium text-slate-700">
          User ID
          <input
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
            placeholder="user-123"
          />
        </label>
        <label className="mb-4 block text-sm font-medium text-slate-700">
          Display name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
            placeholder="Ada Lovelace"
          />
        </label>
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          className="w-full rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Continue
        </button>
      </form>
    </div>
  );
}
