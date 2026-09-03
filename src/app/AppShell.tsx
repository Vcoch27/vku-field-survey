import type { ReactNode } from 'react';
import { BottomNav } from './BottomNav.tsx';
import { Header } from './Header.tsx';
import { SyncProgressBar } from './SyncProgressBar.tsx';

export interface AppShellProps {
  readonly isConnected: boolean;
  readonly pendingCount?: number;
  readonly failedCount?: number;
  readonly children: ReactNode;
}

export function AppShell({
  isConnected,
  pendingCount = 0,
  failedCount = 0,
  children,
}: AppShellProps) {
  return (
    <div className="app-layout">
      <Header isConnected={isConnected} pendingCount={pendingCount} failedCount={failedCount} />
      <main className="app-main" id="main-content">
        <SyncProgressBar />
        {children}
      </main>
      <BottomNav pendingCount={pendingCount} />
    </div>
  );
}
