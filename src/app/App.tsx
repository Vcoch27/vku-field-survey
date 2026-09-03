import { useCallback, useEffect, useState } from 'react';
import { createRuntime, type AppRuntime } from './createRuntime';
import { AppShell } from './AppShell.tsx';
import { RouterProvider } from './router.tsx';
import { useRouter } from './routerContext.ts';
import { HomePage } from '../features/Home/HomePage.tsx';
import { FormsPage } from '../features/Forms/FormsPage.tsx';
import { RecordsPage } from '../features/Records/RecordsPage.tsx';
import { RecordDetailsPage } from '../features/Records/RecordDetailsPage.tsx';
import { StatisticsPage } from '../features/Statistics/StatisticsPage.tsx';
import { SurveyPage } from '../features/SurveyPage/SurveyPage.tsx';

const defaultRuntime = createRuntime();

export interface AppProps {
  readonly runtime?: AppRuntime;
  readonly initialPath?: string;
}

function AppContent({ runtime }: { readonly runtime: AppRuntime }) {
  const { route } = useRouter();
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [pendingCount, setPendingCount] = useState<number>(0);

  const refreshPendingCount = useCallback(() => {
    void runtime.storage
      .getAllSubmissions()
      .then((submissions) => {
        const pending = submissions.filter(
          (s) => s.syncStatus === 'PENDING_SYNC' || s.syncStatus === 'SYNCING'
        ).length;
        setPendingCount(pending);
      })
      .catch(() => {});
  }, [runtime.storage]);

  useEffect(() => {
    refreshPendingCount();
    void runtime.networkStatus.getNetworkStatus().then((status) => {
      setIsConnected(status.isConnected);
    });
    const unsubscribe = runtime.networkStatus.subscribe((status) => {
      setIsConnected(status.isConnected);
    });
    return unsubscribe;
  }, [runtime, refreshPendingCount]);

  const handleSubmitted = () => {
    refreshPendingCount();
    if (typeof runtime.syncTriggerAdapter.requestBackgroundSync === 'function') {
      void runtime.syncTriggerAdapter.requestBackgroundSync();
    }
  };

  return (
    <AppShell isConnected={isConnected} pendingCount={pendingCount}>
      {route.path === '/' && (
        <HomePage storage={runtime.storage} isConnected={isConnected} />
      )}
      {route.path === '/survey' && (
        <SurveyPage
          storage={runtime.storage}
          uuidGenerator={runtime.uuidGenerator}
          clock={runtime.clock}
          camera={runtime.camera}
          onSubmitted={handleSubmitted}
        />
      )}
      {route.path === '/forms' && <FormsPage />}
      {route.path === '/statistics' && (
        <StatisticsPage storage={runtime.storage} />
      )}
      {route.path === '/records' && (
        <RecordsPage storage={runtime.storage} />
      )}
      {route.path === '/records/:id' && (
        <RecordDetailsPage recordId={route.id} storage={runtime.storage} />
      )}
    </AppShell>
  );
}

function App({ runtime = defaultRuntime, initialPath }: AppProps) {
  return (
    <RouterProvider initialPath={initialPath}>
      <AppContent runtime={runtime} />
    </RouterProvider>
  );
}

export default App;
