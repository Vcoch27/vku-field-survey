import { IdbSurveyStorage } from '../data/IdbSurveyStorage.ts';
import type {
  CameraPort,
  Clock,
  GeolocationPort,
  NetworkStatusPort,
  NotificationPort,
  SubmissionGateway,
  SurveyStoragePort,
  UuidGenerator,
} from '../domain/ports.ts';
import { SyncOrchestrator, synchronizeSubmissions } from '../domain/syncOrchestrator.ts';
import { isNativePlatform } from '../platform/isNative.ts';
import { CapacitorCameraAdapter } from '../platform/camera/CapacitorCameraAdapter.ts';
import { WebCameraAdapter } from '../platform/camera/WebCameraAdapter.ts';
import { CapacitorNetworkAdapter } from '../platform/network/CapacitorNetworkAdapter.ts';
import { WebNetworkStatusAdapter } from '../platform/network/WebNetworkStatusAdapter.ts';
import { CapacitorNotificationAdapter } from '../platform/notification/CapacitorNotificationAdapter.ts';
import { WebNotificationAdapter } from '../platform/notification/WebNotificationAdapter.ts';
import { CapacitorGeolocationAdapter } from '../platform/geolocation/CapacitorGeolocationAdapter.ts';
import { WebGeolocationAdapter } from '../platform/geolocation/WebGeolocationAdapter.ts';
import {
  type NativeSyncTriggerSource,
  NativeSyncTriggerAdapter,
} from '../platform/native/NativeSyncTriggerAdapter.ts';
import {
  type SyncTriggerSource,
  WebSyncTriggerAdapter,
} from '../platform/pwa/WebSyncTriggerAdapter.ts';
import { GoogleSheetsSubmissionGateway } from '../platform/gateway/GoogleSheetsSubmissionGateway.ts';

export type CombinedSyncTriggerSource = SyncTriggerSource | NativeSyncTriggerSource;

export interface SyncTriggerPort {
  dispatchTrigger(source: CombinedSyncTriggerSource): Promise<void>;
  destroy(): void;
  requestBackgroundSync?(): Promise<boolean>;
}

export interface CreateRuntimeOptions {
  readonly isNative?: boolean;
  readonly storage?: SurveyStoragePort;
  readonly uuidGenerator?: UuidGenerator;
  readonly clock?: Clock;
  readonly camera?: CameraPort;
  readonly networkStatus?: NetworkStatusPort;
  readonly notification?: NotificationPort;
  readonly geolocation?: GeolocationPort;
  readonly gateway?: SubmissionGateway;
  readonly targetWindow?: Window;
  readonly targetDocument?: Document;
  readonly serviceWorkerContainer?: ServiceWorkerContainer;
  readonly onSyncAttempt?: (source: CombinedSyncTriggerSource) => void;
}

export interface AppRuntime {
  readonly storage: SurveyStoragePort;
  readonly uuidGenerator: UuidGenerator;
  readonly clock: Clock;
  readonly camera: CameraPort;
  readonly networkStatus: NetworkStatusPort;
  readonly notification: NotificationPort;
  readonly geolocation: GeolocationPort;
  readonly syncTriggerAdapter: SyncTriggerPort;
  readonly isNative: boolean;
  readonly syncOrchestrator: SyncOrchestrator;
  readonly gateway?: SubmissionGateway;
}

export function createRuntime(options?: CreateRuntimeOptions): AppRuntime {
  const isNative = options?.isNative ?? isNativePlatform();

  const storage =
    options?.storage ??
    new IdbSurveyStorage({
      createClaimMetadata: () => ({
        claimToken: crypto.randomUUID(),
        claimedAt: new Date().toISOString(),
      }),
    });

  const uuidGenerator: UuidGenerator = options?.uuidGenerator ?? {
    generateUuid: () => crypto.randomUUID(),
  };

  const clock: Clock = options?.clock ?? {
    now: () => new Date().toISOString(),
  };

  // Platform Camera Adapter
  const camera: CameraPort =
    options?.camera ??
    (isNative
      ? new CapacitorCameraAdapter({ uuidGenerator, clock })
      : new WebCameraAdapter({
          uuidGenerator,
          clock,
          targetDocument: options?.targetDocument,
        }));

  // Platform Network Status Adapter
  const networkStatus: NetworkStatusPort =
    options?.networkStatus ??
    (isNative ? new CapacitorNetworkAdapter() : new WebNetworkStatusAdapter(options?.targetWindow));

  const endpointUrl =
    typeof import.meta !== 'undefined' && import.meta.env
      ? (import.meta.env.VITE_SUBMISSION_ENDPOINT as string | undefined)
      : undefined;
  const clientToken =
    typeof import.meta !== 'undefined' && import.meta.env
      ? (import.meta.env.VITE_SUBMISSION_CLIENT_TOKEN as string | undefined)
      : undefined;

  const gateway: SubmissionGateway | undefined =
    options?.gateway ??
    (endpointUrl && endpointUrl.trim() !== ''
      ? new GoogleSheetsSubmissionGateway({
          endpointUrl,
          clientToken,
        })
      : undefined);

  const notification: NotificationPort =
    options?.notification ??
    (isNative
      ? new CapacitorNotificationAdapter()
      : new WebNotificationAdapter({ targetWindow: options?.targetWindow }));

  const geolocation: GeolocationPort =
    options?.geolocation ??
    (isNative
      ? new CapacitorGeolocationAdapter()
      : new WebGeolocationAdapter({ targetNavigator: options?.targetWindow?.navigator }));

  let wasOffline = false;
  void networkStatus.getNetworkStatus().then((status) => {
    wasOffline = !status.isConnected;
  });
  networkStatus.subscribe((status) => {
    if (!status.isConnected) {
      wasOffline = true;
    } else if (wasOffline) {
      // Reconnected after being offline: trigger synchronization automatically
      void handleTrigger('ONLINE_EVENT');
    }
  });

  const handleTrigger = async (source: CombinedSyncTriggerSource) => {
    options?.onSyncAttempt?.(source);
    // M6 single logical synchronization workflow:
    // If a real SubmissionGateway is provided, run the synchronization engine.
    // If no gateway is configured (OQ-003 destination unresolved), queued items remain PENDING_SYNC.
    if (gateway) {
      const net = await networkStatus.getNetworkStatus();
      if (!net.isConnected) {
        // Offline: do not attempt remote dispatch
        return;
      }

      const syncResult = await synchronizeSubmissions({ storage, gateway, networkStatus });
      const isReconnected =
        source === 'NATIVE_NETWORK_RECONNECT' || source === 'ONLINE_EVENT' || wasOffline;

      if (syncResult.syncedCount > 0 && isReconnected) {
        wasOffline = false;
        await notification.notify({
          title: 'Đồng bộ thành công',
          body: `Đã đồng bộ ${syncResult.syncedCount} bản ghi khảo sát lên Google Sheets khi có kết nối mạng.`,
        });
      }
    }
  };

  // Platform Synchronization Trigger Adapter
  const syncTriggerAdapter: SyncTriggerPort = isNative
    ? new NativeSyncTriggerAdapter({
        onTrigger: handleTrigger,
        targetWindow: options?.targetWindow,
        targetDocument: options?.targetDocument,
      })
    : new WebSyncTriggerAdapter({
        targetWindow: options?.targetWindow,
        targetDocument: options?.targetDocument,
        serviceWorkerContainer: options?.serviceWorkerContainer,
        onTrigger: handleTrigger,
      });

  const syncOrchestrator = new SyncOrchestrator({
    storage,
    gateway: gateway ?? {
      sendSubmission: async () => ({
        outcome: 'RETRYABLE_FAILURE',
        reason: 'No remote submission gateway configured',
      }),
    },
    networkStatus,
  });

  return {
    storage,
    uuidGenerator,
    clock,
    camera,
    networkStatus,
    notification,
    geolocation,
    syncTriggerAdapter,
    isNative,
    syncOrchestrator,
    gateway,
  };
}
