'use client';

import { useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import Sidebar, { MobileSidebar } from './Sidebar';
import TopBar from './TopBar';
import { useDashboard } from './DashboardProvider';

/**
 * De schil om élke pagina: zachte grijze ondergrond, daarbinnen één afgeronde
 * witte kaart met de hele app erin. Dat frame maakt er een applicatie van in
 * plaats van een webpagina — sidebar links, kop boven, inhoud daaronder.
 */
export default function AppShell({
  badges,
  children,
}: {
  badges?: Record<string, number>;
  children: ReactNode;
}) {
  const { message, dismissMessage } = useDashboard();
  const [menu, setMenu] = useState(false);

  return (
    // Op de telefoon geen marge en geen ronde hoeken: die kosten daar alleen maar
    // ruimte. Het kaartframe blijft vanaf sm.
    <div className="h-screen bg-shell sm:p-2.5">
      <div className="flex h-full overflow-hidden border-black/[0.06] bg-surface sm:rounded-[22px] sm:border sm:shadow-sm">
        <Sidebar badges={badges} />
        <MobileSidebar open={menu} onClose={() => setMenu(false)} badges={badges} />

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar onMenu={() => setMenu(true)} />

          {message && (
            <div className="animate-fade-in border-b border-accent-line bg-accent-soft px-6 py-2.5">
              <div className="flex items-start justify-between gap-4">
                <p className="text-[13px] text-accent">{message}</p>
                <button
                  onClick={dismissMessage}
                  aria-label="Melding sluiten"
                  className="shrink-0 rounded-md p-0.5 text-accent/70 transition hover:bg-white/60 hover:text-accent"
                >
                  <X size={14} strokeWidth={2.2} />
                </button>
              </div>
            </div>
          )}

          <main className="min-w-0 flex-1 overflow-y-auto bg-canvas">
            <div className="mx-auto w-full max-w-[1400px] px-3 py-4 sm:px-6 sm:py-6">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
