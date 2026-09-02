import type { PhotoAttachment } from '../../domain/models.ts';
import type { CameraPort, Clock, UuidGenerator } from '../../domain/ports.ts';

export interface WebCameraAdapterDependencies {
  readonly uuidGenerator?: UuidGenerator;
  readonly clock?: Clock;
  readonly targetDocument?: Document;
}

/**
 * Fallback Camera adapter for Web and PWA environments.
 * Uses an HTML5 file input with camera capture hint.
 */
export class WebCameraAdapter implements CameraPort {
  private readonly uuidGenerator: UuidGenerator;
  private readonly clock: Clock;
  private readonly targetDocument: Document | undefined;

  constructor(deps?: WebCameraAdapterDependencies) {
    this.uuidGenerator = deps?.uuidGenerator ?? {
      generateUuid: () => crypto.randomUUID(),
    };
    this.clock = deps?.clock ?? {
      now: () => new Date().toISOString(),
    };
    this.targetDocument =
      deps?.targetDocument ?? (typeof document !== 'undefined' ? document : undefined);
  }

  async capturePhoto(): Promise<PhotoAttachment | null> {
    if (!this.targetDocument) {
      return null;
    }

    return new Promise((resolve) => {
      const input = this.targetDocument!.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment';

      let resolved = false;

      const finish = (result: PhotoAttachment | null) => {
        if (!resolved) {
          resolved = true;
          input.removeEventListener('change', handleChange);
          input.removeEventListener('cancel', handleCancel);
          resolve(result);
        }
      };

      const handleChange = () => {
        const file = input.files?.[0];
        if (!file) {
          finish(null);
          return;
        }

        const displayUri = typeof URL !== 'undefined' ? URL.createObjectURL(file) : undefined;
        const attachment: PhotoAttachment = {
          id: this.uuidGenerator.generateUuid(),
          displayUri,
          binaryData: file,
          capturedAt: this.clock.now(),
        };

        finish(attachment);
      };

      const handleCancel = () => {
        finish(null);
      };

      input.addEventListener('change', handleChange, { once: true });
      input.addEventListener('cancel', handleCancel, { once: true });

      input.click();
    });
  }
}
