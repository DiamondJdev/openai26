"use client";

import { useState } from "react";
import { apiPost } from "@/lib/client/api";
import { BrandMark } from "@/components/BrandMark";
import { BTN_PRIMARY, OVERLINE } from "@/components/ui";

export function LoginForm({ next }: { next: string }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiPost("/api/employee/login", { username, password });
      // Hard navigation so middleware re-reads the new session cookie.
      window.location.assign(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5">
          <BrandMark />
          <span className="font-display text-lg font-semibold tracking-tight">
            ClaimLens
          </span>
        </div>

        <form
          onSubmit={submit}
          className="mt-6 rounded-lg border border-border bg-surface p-6"
        >
          <p className={OVERLINE}>Employee console</p>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">
            Sign in
          </h1>
          <p className="mt-1 text-sm text-muted">
            Enter your console credentials to continue.
          </p>

          <div className="mt-5 space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium">
                Username
              </label>
              <input
                id="username"
                name="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="off"
                required
                className="mt-1 min-h-touch w-full rounded-md border border-border bg-bg px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="mt-1 min-h-touch w-full rounded-md border border-border bg-bg px-3 py-2"
              />
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-md border border-danger/30 bg-danger-weak px-3 py-2 text-sm text-danger"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || !username || !password}
            className={`${BTN_PRIMARY} mt-5 w-full`}
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-center font-mono text-[11px] uppercase tracking-wider text-muted">
          Private console · authorized staff only
        </p>
      </div>
    </main>
  );
}
