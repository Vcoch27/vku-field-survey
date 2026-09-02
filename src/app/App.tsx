import { useEffect, useState } from 'react';
import { createRuntime, type AppRuntime } from './createRuntime';
import { SurveyForm } from '../features/SurveyForm/SurveyForm';

const defaultRuntime = createRuntime();

interface AppProps {
  readonly runtime?: AppRuntime;
}

function App({ runtime = defaultRuntime }: AppProps) {
  const [isConnected, setIsConnected] = useState<boolean>(true);

  useEffect(() => {
    void runtime.networkStatus.getNetworkStatus().then((status) => {
      setIsConnected(status.isConnected);
    });
    const unsubscribe = runtime.networkStatus.subscribe((status) => {
      setIsConnected(status.isConnected);
    });
    return unsubscribe;
  }, [runtime.networkStatus]);

  const handleSubmitted = () => {
    if (typeof runtime.syncTriggerAdapter.requestBackgroundSync === 'function') {
      void runtime.syncTriggerAdapter.requestBackgroundSync();
    }
  };

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="app-brand">
            <div className="app-brand-icon" aria-hidden="true">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                <path d="m9 14 2 2 4-4" />
              </svg>
            </div>
            <div className="app-brand-text">
              <h1 className="app-title">VKU Field Survey</h1>
              <p className="app-subtitle">Campus Equipment &amp; Facility Inspection</p>
            </div>
          </div>
          {!isConnected && (
            <div className="network-offline-badge" role="status" aria-label="Offline Mode">
              <span className="network-offline-dot" aria-hidden="true" />
              <span>Offline</span>
            </div>
          )}
        </div>
      </header>

      <main className="app-main">
        <SurveyForm
          storage={runtime.storage}
          uuidGenerator={runtime.uuidGenerator}
          clock={runtime.clock}
          camera={runtime.camera}
          onSubmitted={handleSubmitted}
        />
      </main>
    </div>
  );
}

export default App;
