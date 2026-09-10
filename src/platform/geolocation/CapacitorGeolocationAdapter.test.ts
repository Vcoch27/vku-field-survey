import { describe, expect, it, vi } from 'vitest';
import type { GeolocationPlugin } from '@capacitor/geolocation';
import { CapacitorGeolocationAdapter } from './CapacitorGeolocationAdapter.ts';

describe('CapacitorGeolocationAdapter', () => {
  it('requests permission and returns coordinates', async () => {
    const mockPlugin: Partial<GeolocationPlugin> = {
      checkPermissions: vi.fn().mockResolvedValue({ location: 'prompt' }),
      requestPermissions: vi.fn().mockResolvedValue({ location: 'granted' }),
      getCurrentPosition: vi.fn().mockResolvedValue({
        coords: {
          latitude: 15.9753,
          longitude: 108.2532,
          accuracy: 5,
          altitude: 12,
        },
        timestamp: 1725950000000,
      }),
    };

    const adapter = new CapacitorGeolocationAdapter({
      plugin: mockPlugin as GeolocationPlugin,
    });

    const pos = await adapter.getCurrentPosition();

    expect(mockPlugin.checkPermissions).toHaveBeenCalled();
    expect(mockPlugin.requestPermissions).toHaveBeenCalled();
    expect(pos).toEqual({
      latitude: 15.9753,
      longitude: 108.2532,
      accuracy: 5,
      altitude: 12,
      capturedAt: new Date(1725950000000).toISOString(),
    });
  });

  it('returns null when permission is denied', async () => {
    const mockPlugin: Partial<GeolocationPlugin> = {
      checkPermissions: vi.fn().mockResolvedValue({ location: 'denied' }),
      requestPermissions: vi.fn().mockResolvedValue({ location: 'denied' }),
      getCurrentPosition: vi.fn(),
    };

    const adapter = new CapacitorGeolocationAdapter({
      plugin: mockPlugin as GeolocationPlugin,
    });

    const pos = await adapter.getCurrentPosition();

    expect(pos).toBeNull();
    expect(mockPlugin.getCurrentPosition).not.toHaveBeenCalled();
  });
});
