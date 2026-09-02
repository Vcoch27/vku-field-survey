import { IdbSurveyStorage } from '../data/IdbSurveyStorage.ts';
import type {
  CameraPort,
  Clock,
  NetworkStatusPort,
  SubmissionGateway,
  SurveyStoragePort,
  UuidGenerator,
} from '../domain/ports.ts';
import { synchronizeSubmissions } from '../domain/syncOrchestrator.ts';
import { isNativePlatform } from '../platform/isNative.ts';
import { CapacitorCameraAdapter } from '../platform/camera/CapacitorCameraAdapter.ts';
import { WebCameraAdapter } from '../platform/camera/WebCameraAdapter.ts';
import { CapacitorNetworkAdapter } from '../platform/network/CapacitorNetworkAdapter.ts';
import { WebNetworkStatusAdapter } from '../platform/network/WebNetworkStatusAdapter.ts';
import {
  type NativeSyncTriggerSource,
  NativeSyncTriggerAdapter,
} from '../platform/native/NativeSyncTriggerAdapter.ts';
import {
  type SyncTriggerSource,
  WebSyncTriggerAdapter,
} from '../platform/pwa/WebSyncTriggerAdapter.ts';

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
  readonly syncTriggerAdapter: SyncTriggerPort;
  readonly isNative: boolean;
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

  const gateway = options?.gateway;

  const handleTrigger = async (source: CombinedSyncTriggerSource) => {
    options?.onSyncAttempt?.(source);
    // M6 single logical synchronization workflow:
    // If a real SubmissionGateway is provided, run the synchronization engine.
    // If no gateway is configured (OQ-003 destination / OQ-006 protocol-specific positive acknowledgement unresolved), queued items remain PENDING_SYNC.
    if (gateway) {
      await synchronizeSubmissions({ storage, gateway });
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

  return {
    storage,
    uuidGenerator,
    clock,
    camera,
    networkStatus,
    syncTriggerAdapter,
    isNative,
    gateway,
  };
}
