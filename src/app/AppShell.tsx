import type { ReactNode } from 'react';
import { BottomNav } from './BottomNav.tsx';
import { Header } from './Header.tsx';

export interface AppShellProps {
  readonly isConnected: boolean;
  readonly pendingCount?: number;
  readonly children: ReactNode;
}

export function AppShell({ isConnected, pendingCount = 0, children }: AppShellProps) {
  return (
    <div className="app-layout">
      <Header isConnected={isConnected} pendingCount={pendingCount} />
      <main className="app-main" id="main-content">
        {children}
      </main>
      <BottomNav pendingCount={pendingCount} />
    </div>
  );
}
