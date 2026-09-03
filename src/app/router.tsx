import {
  useEffect,
  useState,
  type AnchorHTMLAttributes,
  type ReactNode,
} from 'react';
import { getCurrentPath, parseRoute } from './routerCore.ts';
import { RouterContext, useRouter } from './routerContext.ts';

export interface RouterProviderProps {
  readonly children: ReactNode;
  readonly initialPath?: string;
}

export function RouterProvider({ children, initialPath }: RouterProviderProps) {
  const [currentPath, setCurrentPath] = useState<string>(() => initialPath ?? getCurrentPath());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = () => {
      setCurrentPath(getCurrentPath(window.location));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (to: string) => {
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', to);
      if (typeof window.scrollTo === 'function') {
        window.scrollTo(0, 0);
      }
    }
    setCurrentPath(to);
  };

  const route = parseRoute(currentPath);

  return (
    <RouterContext.Provider value={{ route, navigate }}>
      {children}
    </RouterContext.Provider>
  );
}

export interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  readonly href: string;
}

export function Link({ href, onClick, children, ...props }: LinkProps) {
  const { navigate } = useRouter();

  return (
    <a
      href={href}
      onClick={(e) => {
        if (!e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
          e.preventDefault();
          navigate(href);
        }
        onClick?.(e);
      }}
      {...props}
    >
      {children}
    </a>
  );
}
