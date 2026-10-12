"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { adminLogin, adminMe } from "@/lib/admin/api";
import { adminUz } from "@/lib/i18n/admin";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void adminMe().then((isLoggedIn) => {
      if (!mounted) return;
      if (isLoggedIn) {
        router.replace("/admin");
      } else {
        setChecking(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || loading) return;

    setLoading(true);
    setError(null);

    const result = await adminLogin(password);
    if (result.ok) {
      router.replace("/admin");
      return;
    }

    if (result.status === 401) {
      setError(adminUz.login.errors.wrongPassword);
    } else if (result.status === 429) {
      setError(adminUz.login.errors.rateLimited);
    } else {
      setError(adminUz.login.errors.generic);
    }
    setLoading(false);
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-sm text-zinc-500">{adminUz.common.loading}</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 sm:p-8 backdrop-blur shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 font-bold text-lg">
            VF
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            {adminUz.login.title}
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            {adminUz.login.subtitle}
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-rose-800/60 bg-rose-950/40 p-3 text-xs text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              {adminUz.login.passwordLabel}
            </label>
            <input
              type="password"
              autoFocus
              required
              value={password}
              placeholder={adminUz.login.passwordPlaceholder}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/90 px-3.5 py-2 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full rounded-lg bg-indigo-600 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 transition disabled:opacity-50 shadow-sm"
          >
            {loading ? adminUz.login.submitting : adminUz.login.submitButton}
          </button>
        </form>
      </div>
    </div>
  );
}
