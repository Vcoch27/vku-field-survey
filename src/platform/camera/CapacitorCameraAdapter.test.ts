import { describe, expect, it, vi } from 'vitest';
import { CameraResultType, CameraSource, type Photo } from '@capacitor/camera';
import { CapacitorCameraAdapter } from './CapacitorCameraAdapter.ts';

describe('CapacitorCameraAdapter (NATIVE-03, NATIVE-04)', () => {
  function createMockPlugin(photoResult: Partial<Photo> | Error) {
    return {
      getPhoto: vi.fn().mockImplementation(() => {
        if (photoResult instanceof Error) {
          return Promise.reject(photoResult);
        }
        return Promise.resolve(photoResult as Photo);
      }),
    };
  }

  function createMockFetch(blobContent = 'fake-image-bytes') {
    return vi.fn().mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(new Blob([blobContent], { type: 'image/jpeg' })),
    } as unknown as Response);
  }

  it('1. Camera adapter requests native camera correctly with Uri resultType and CameraSource', async () => {
    const mockPlugin = createMockPlugin({
      webPath: 'capacitor://localhost/_capacitor_file_/photo.jpg',
    });
    const mockFetch = createMockFetch();

    const adapter = new CapacitorCameraAdapter({
      cameraPlugin: mockPlugin,
      fetchFn: mockFetch,
    });

    const attachment = await adapter.capturePhoto();

    expect(mockPlugin.getPhoto).toHaveBeenCalledWith({
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      quality: 85,
    });
    expect(attachment).not.toBeNull();
  });

  it('2. camera cancellation leaves form intact and returns null safely', async () => {
    const mockPlugin = createMockPlugin(new Error('User cancelled photos app'));
    const adapter = new CapacitorCameraAdapter({
      cameraPlugin: mockPlugin,
    });

    const result = await adapter.capturePhoto();
    expect(result).toBeNull();
  });

  it('3. permission/error path surfaces safely without throwing', async () => {
    const mockPlugin = createMockPlugin(new Error('Permission denied: camera not authorized'));
    const adapter = new CapacitorCameraAdapter({
      cameraPlugin: mockPlugin,
    });

    const result = await adapter.capturePhoto();
    expect(result).toBeNull();
  });

  it('4. photo binary becomes Blob, not Base64 persistence', async () => {
    const mockPlugin = createMockPlugin({ webPath: 'blob:http://localhost:5173/test-image-123' });
    const mockFetch = createMockFetch('binary-jpeg-data');

    const adapter = new CapacitorCameraAdapter({
      cameraPlugin: mockPlugin,
      fetchFn: mockFetch,
    });

    const attachment = await adapter.capturePhoto();
    expect(attachment).not.toBeNull();
    expect(attachment?.binaryData).toBeInstanceOf(Blob);
    expect(typeof attachment?.binaryData).toBe('object');

    // Audit: PhotoAttachment should not contain base64 string property
    const rawAttachment = attachment as unknown as Record<string, unknown>;
    expect(rawAttachment['base64']).toBeUndefined();
    expect(rawAttachment['dataUrl']).toBeUndefined();
  });

  it('5. captured photo enters PhotoAttachment correctly with id and timestamp', async () => {
    const mockPlugin = createMockPlugin({ webPath: 'file:///android_asset/photo.jpg' });
    const mockFetch = createMockFetch();
    const mockUuid = 'photo-uuid-1234';
    const mockTimestamp = '2026-09-02T15:00:00.000Z';

    const adapter = new CapacitorCameraAdapter({
      cameraPlugin: mockPlugin,
      fetchFn: mockFetch,
      uuidGenerator: { generateUuid: () => mockUuid },
      clock: { now: () => mockTimestamp },
    });

    const attachment = await adapter.capturePhoto();
    expect(attachment).toEqual({
      id: mockUuid,
      displayUri: 'file:///android_asset/photo.jpg',
      binaryData: expect.any(Blob),
      capturedAt: mockTimestamp,
    });
  });
});
