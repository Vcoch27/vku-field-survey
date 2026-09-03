export type AppRoute =
  | { readonly path: '/' }
  | { readonly path: '/survey' }
  | { readonly path: '/forms' }
  | { readonly path: '/statistics' }
  | { readonly path: '/records' }
  | { readonly path: '/records/:id'; readonly id: string };

export function parseRoute(rawPath: string): AppRoute {
  const clean = rawPath.replace(/\/+$/, '') || '/';

  if (clean === '/' || clean === '') {
    return { path: '/' };
  }
  if (clean === '/survey') {
    return { path: '/survey' };
  }
  if (clean === '/forms') {
    return { path: '/forms' };
  }
  if (clean === '/statistics') {
    return { path: '/statistics' };
  }
  if (clean === '/records') {
    return { path: '/records' };
  }
  if (clean.startsWith('/records/')) {
    const id = clean.slice('/records/'.length).trim();
    if (id) {
      return { path: '/records/:id', id };
    }
    return { path: '/records' };
  }

  return { path: '/' };
}

export function getCurrentPath(loc?: Location): string {
  const l = loc ?? (typeof window !== 'undefined' ? window.location : undefined);
  if (!l) return '/';

  if (l.hash && l.hash.startsWith('#/')) {
    return l.hash.slice(1);
  }

  return l.pathname || '/';
}
