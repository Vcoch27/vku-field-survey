import vkuLogo from '../assets/branding/vku-field-survey-logo.png';
import { Link } from './router.tsx';
import { useRouter } from './routerContext.ts';

export interface HeaderProps {
  readonly isConnected: boolean;
  readonly pendingCount?: number;
  readonly failedCount?: number;
}

export function Header({ isConnected, pendingCount = 0, failedCount = 0 }: HeaderProps) {
  const { route } = useRouter();

  const navItems = [
    { label: 'Home', path: '/' },
    { label: 'Survey', path: '/survey' },
    { label: 'Forms', path: '/forms' },
    { label: 'Stats', path: '/statistics' },
    { label: 'Records', path: '/records' },
  ] as const;

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <Link href="/" className="app-brand" aria-label="VKU Field Survey Home">
          <img
            src={vkuLogo}
            alt="VKU Field Survey Logo"
            className="app-brand-logo"
            width="36"
            height="31"
          />
          <div className="app-brand-text">
            <span className="app-title">VKU Field Survey</span>
            <span className="app-subtitle">Field Inspection Workspace</span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="desktop-nav" aria-label="Desktop Navigation">
          {navItems.map((item) => {
            const isActive =
              item.path === '/' ? route.path === '/' : route.path.startsWith(item.path);
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`desktop-nav-link ${isActive ? 'active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Status Indicators */}
        <div className="app-header-status">
          {pendingCount > 0 && (
            <Link
              href="/records"
              className="header-badge badge-pending"
              title={`${pendingCount} survey(s) waiting for sync`}
              aria-label={`${pendingCount} pending synchronization`}
            >
              <span className="badge-dot pending-dot" aria-hidden="true" />
              <span>{pendingCount} pending</span>
            </Link>
          )}

          {failedCount > 0 && (
            <Link
              href="/records"
              className="header-badge badge-failed"
              title={`${failedCount} survey(s) failed sync and need review`}
              aria-label={`${failedCount} sync failed`}
            >
              <span className="badge-dot failed-dot" aria-hidden="true" />
              <span>{failedCount} failed</span>
            </Link>
          )}

          <div
            className={`network-status-badge ${isConnected ? 'online' : 'offline'}`}
            role="status"
            aria-label={isConnected ? 'Online' : 'Offline'}
          >
            <span className="network-dot" aria-hidden="true" />
            <span className="network-label">{isConnected ? 'Online' : 'Offline'}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
