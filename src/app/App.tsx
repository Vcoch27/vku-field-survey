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

import { ZERO_STATUS_COUNTS, type SubmissionStatusCounts } from '../domain/submissionAggregation.ts';
import { createSubmissionViewModel } from '../domain/submissionViewModel.ts';
import { globalSyncEventHub } from '../domain/syncEvents.ts';

const defaultRuntime = createRuntime();

export interface AppProps {
  readonly runtime?: AppRuntime;
  readonly initialPath?: string;
}

function AppContent({ runtime }: { readonly runtime: AppRuntime }) {
  const { route } = useRouter();
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [statusCounts, setStatusCounts] = useState<SubmissionStatusCounts>(ZERO_STATUS_COUNTS);

  const refreshCounts = useCallback(() => {
    void runtime.storage
      .getAllSubmissions()
      .then((submissions) => {
        setStatusCounts(createSubmissionViewModel(submissions).status);
      })
      .catch(() => {});
  }, [runtime.storage]);

  useEffect(() => {
    refreshCounts();

    void runtime.networkStatus.getNetworkStatus().then((status) => {
      setIsConnected(status.isConnected);
    });
    const unsubNetwork = runtime.networkStatus.subscribe((status) => {
      setIsConnected(status.isConnected);
    });

    // Reactive subscription to all queue and sync events
    const unsubStorage = globalSyncEventHub.subscribeStorage(() => {
      refreshCounts();
    });

    return () => {
      unsubNetwork();
      unsubStorage();
    };
  }, [runtime, refreshCounts]);

  const handleSubmitted = () => {
    refreshCounts();
    globalSyncEventHub.notifyStorageChanged();
    if (typeof runtime.syncTriggerAdapter.requestBackgroundSync === 'function') {
      void runtime.syncTriggerAdapter.requestBackgroundSync();
    }
  };

  return (
    <AppShell
      isConnected={isConnected}
      pendingCount={statusCounts.pending}
      failedCount={statusCounts.failed}
    >
      {route.path === '/' && <HomePage storage={runtime.storage} isConnected={isConnected} />}
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
      {route.path === '/statistics' && <StatisticsPage storage={runtime.storage} />}
      {route.path === '/records' && (
        <RecordsPage
          key={route.query}
          storage={runtime.storage}
          orchestrator={runtime.syncOrchestrator}
          initialQuery={route.query}
        />
      )}
      {route.path === '/records/:id' && (
        <RecordDetailsPage
          recordId={route.id}
          storage={runtime.storage}
          orchestrator={runtime.syncOrchestrator}
        />
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
