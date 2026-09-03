import { Link } from './router.tsx';
import { useRouter } from './routerContext.ts';

export interface BottomNavProps {
  readonly pendingCount?: number;
}

export function BottomNav({ pendingCount = 0 }: BottomNavProps) {
  const { route } = useRouter();

  const isHome = route.path === '/';
  const isSurvey = route.path === '/survey';
  const isStats = route.path === '/statistics';
  const isRecords = route.path === '/records' || route.path === '/records/:id';

  return (
    <nav className="bottom-nav" aria-label="Mobile Navigation">
      <div className="bottom-nav-inner">
        {/* Home */}
        <Link
          href="/"
          className={`bottom-nav-item ${isHome ? 'active' : ''}`}
          aria-current={isHome ? 'page' : undefined}
          aria-label="Home"
        >
          <svg
            className="bottom-nav-icon"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span className="bottom-nav-label">Home</span>
        </Link>

        {/* Survey (Action CTA) */}
        <Link
          href="/survey"
          className={`bottom-nav-item bottom-nav-action ${isSurvey ? 'active' : ''}`}
          aria-current={isSurvey ? 'page' : undefined}
          aria-label="Start Survey"
        >
          <div className="action-icon-wrapper">
            <svg
              className="bottom-nav-icon"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
          </div>
          <span className="bottom-nav-label">Survey</span>
        </Link>

        {/* Stats */}
        <Link
          href="/statistics"
          className={`bottom-nav-item ${isStats ? 'active' : ''}`}
          aria-current={isStats ? 'page' : undefined}
          aria-label="Statistics"
        >
          <svg
            className="bottom-nav-icon"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 20V10" />
            <path d="M12 20V4" />
            <path d="M6 20v-6" />
          </svg>
          <span className="bottom-nav-label">Stats</span>
        </Link>

        {/* Records */}
        <Link
          href="/records"
          className={`bottom-nav-item ${isRecords ? 'active' : ''}`}
          aria-current={isRecords ? 'page' : undefined}
          aria-label="Records"
        >
          <div className="nav-icon-container">
            <svg
              className="bottom-nav-icon"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            {pendingCount > 0 && (
              <span className="bottom-nav-badge" aria-label={`${pendingCount} pending items`}>
                {pendingCount > 9 ? '9+' : pendingCount}
              </span>
            )}
          </div>
          <span className="bottom-nav-label">Records</span>
        </Link>
      </div>
    </nav>
  );
}
