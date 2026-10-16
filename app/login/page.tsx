'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get('from') || '/';

  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.ok) {
        router.replace(from);
        router.refresh();
      } else {
        setError(data.error || 'Inloggen mislukt.');
      }
    } catch {
      setError('Er ging iets mis. Probeer opnieuw.');
    } finally {
      setLoading(false);
    }
  }

  return (
    // Links hun eigen vloer (PVC visgraat Riva Natural Oak, van vloeruniq.nl),
    // rechts het formulier. Op een telefoon alleen het formulier, met de foto
    // als smalle band erboven.
    <main className="grid min-h-screen bg-canvas text-ink lg:grid-cols-[1.15fr_1fr]">
      <div className="relative h-40 overflow-hidden lg:h-auto">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/vloer.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/55 via-ink/10 to-transparent" />
        <div className="absolute bottom-0 left-0 hidden p-10 text-white lg:block">
          <p className="max-w-sm text-[22px] font-semibold leading-snug tracking-tight">
            Elke vloer, elke offerte, elke euro marge op één plek.
          </p>
          <p className="mt-2 text-[13px] text-white/75">PVC Visgraat · Riva Natural Oak</p>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 lg:p-12">
        <form onSubmit={onSubmit} className="w-full max-w-sm animate-rise-in">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo.svg" alt="Vloeruniq" width={150} height={28} className="h-7 w-auto" />
          <h1 className="mt-8 text-[24px] font-bold tracking-tight">Welkom terug</h1>
          <p className="mt-1 text-[13.5px] text-ink-mute">Log in om het dashboard te openen.</p>

          <label htmlFor="password" className="mt-8 block text-[12.5px] font-medium text-ink-soft">
            Wachtwoord
          </label>
          <input
            id="password"
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[14px] outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
          />

          {error && <p className="mt-3 text-sm text-crit">{error}</p>}

          <button
            type="submit"
            disabled={loading || !password}
            className="mt-6 w-full rounded-xl bg-ink px-4 py-2.5 text-[14px] font-semibold text-white transition hover:bg-ink/90 disabled:opacity-40"
          >
            {loading ? 'Bezig…' : 'Inloggen'}
          </button>
          <p className="mt-8 text-[11.5px] text-ink-faint">Vloeruniq.nl B.V. · Rijssen</p>
        </form>
      </div>
    </main>
  );
}
