import { createContext, useContext } from 'react';
import type { AppRoute } from './routerCore.ts';

export interface RouterContextValue {
  readonly route: AppRoute;
  readonly navigate: (to: string) => void;
}

export const RouterContext = createContext<RouterContextValue | null>(null);

export function useRouter(): RouterContextValue {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error('useRouter must be used within a RouterProvider');
  }
  return context;
}
