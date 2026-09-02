import { Camera, CameraResultType, CameraSource, type Photo } from '@capacitor/camera';
import type { PhotoAttachment } from '../../domain/models.ts';
import type { CameraPort, Clock, UuidGenerator } from '../../domain/ports.ts';

export interface CameraPluginLike {
  getPhoto(options: {
    resultType: CameraResultType;
    source: CameraSource;
    quality?: number;
  }): Promise<Photo>;
}

export interface CapacitorCameraAdapterDependencies {
  readonly uuidGenerator?: UuidGenerator;
  readonly clock?: Clock;
  readonly cameraPlugin?: CameraPluginLike;
  readonly fetchFn?: typeof fetch;
}

/**
 * Concrete native adapter implementing CameraPort using @capacitor/camera.
 *
 * Enforces memory safety:
 * 1. Requests CameraResultType.Uri (never Base64 or DataUrl).
 * 2. Fetches binary data directly from webPath into a Blob.
 * 3. PhotoAttachment.binaryData holds the Blob for IndexedDB persistence.
 * 4. User cancellation or permission errors degrade safely to null without crashing.
 */
export class CapacitorCameraAdapter implements CameraPort {
  private readonly uuidGenerator: UuidGenerator;
  private readonly clock: Clock;
  private readonly cameraPlugin: CameraPluginLike;
  private readonly fetchFn: typeof fetch;

  constructor(deps?: CapacitorCameraAdapterDependencies) {
    this.uuidGenerator = deps?.uuidGenerator ?? {
      generateUuid: () => crypto.randomUUID(),
    };
    this.clock = deps?.clock ?? {
      now: () => new Date().toISOString(),
    };
    this.cameraPlugin = deps?.cameraPlugin ?? Camera;
    this.fetchFn = deps?.fetchFn ?? (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : fetch);
  }

  async capturePhoto(): Promise<PhotoAttachment | null> {
    try {
      const photo = await this.cameraPlugin.getPhoto({
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
        quality: 85,
      });

      if (!photo.webPath) {
        return null;
      }

      // Convert image URI to binary Blob for durable IndexedDB storage
      const response = await this.fetchFn(photo.webPath);
      if (!response.ok) {
        console.warn('Failed to fetch photo binary from webPath:', response.statusText);
        return null;
      }

      const binaryData = await response.blob();

      const attachment: PhotoAttachment = {
        id: this.uuidGenerator.generateUuid(),
        displayUri: photo.webPath,
        binaryData,
        capturedAt: this.clock.now(),
      };

      return attachment;
    } catch (error) {
      // User cancellation, permission rejection, or device unavailability
      // Must degrade safely to null without throwing or clearing the form
      const message = error instanceof Error ? error.message : String(error);
      if (
        message.includes('cancelled') ||
        message.includes('canceled') ||
        message.includes('User cancelled')
      ) {
        // Normal user cancellation - do not treat as error
        return null;
      }

      console.warn('Capacitor camera capture was not completed:', message);
      return null;
    }
  }
}
