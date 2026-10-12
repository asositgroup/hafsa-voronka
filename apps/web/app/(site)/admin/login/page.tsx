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
      <div className="flex min-h-screen items-center justify-center p-4 bg-varaq text-siyoh">
        <div className="text-sm text-qalam">{adminUz.common.loading}</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 sm:p-6 bg-varaq text-siyoh">
      <div className="w-full max-w-sm rounded-[16px] bg-white p-6 sm:p-8 flex flex-col gap-5">
        <div className="text-center">
          <h1 className="text-xl font-bold tracking-tight text-siyoh m-0">
            {adminUz.login.title}
          </h1>
          <p className="mt-1 text-xs text-qalam m-0">
            {adminUz.login.subtitle}
          </p>
        </div>

        {error && (
          <div className="rounded-[10px] border border-anor bg-anor/10 p-3 text-xs text-anor">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="block text-xs font-medium text-qalam">
              {adminUz.login.passwordLabel}
            </label>
            <input
              type="password"
              autoFocus
              required
              value={password}
              placeholder={adminUz.login.passwordPlaceholder}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full min-h-[40px] rounded-[10px] border border-chegara bg-white px-3.5 py-2 text-sm text-siyoh placeholder:text-qalam/50 focus:border-siyoh focus:outline-none focus:ring-1 focus:ring-siyoh"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full min-h-[44px] rounded-[10px] bg-siyoh py-2.5 text-xs font-semibold text-varaq hover:opacity-95 transition disabled:opacity-50"
          >
            {loading ? adminUz.login.submitting : adminUz.login.submitButton}
          </button>
        </form>
      </div>
    </div>
  );
}
