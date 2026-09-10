import { describe, expect, it, vi } from 'vitest';
import { WebGeolocationAdapter } from './WebGeolocationAdapter.ts';

describe('WebGeolocationAdapter', () => {
  it('returns null when geolocation is not supported', async () => {
    const adapter = new WebGeolocationAdapter({ targetNavigator: {} as unknown as Navigator });
    const pos = await adapter.getCurrentPosition();
    expect(pos).toBeNull();
  });

  it('resolves coordinates when navigator.geolocation succeeds', async () => {
    const mockNavigator = {
      geolocation: {
        getCurrentPosition: vi.fn((success) => {
          success({
            coords: {
              latitude: 15.9753,
              longitude: 108.2532,
              accuracy: 10,
              altitude: null,
            },
            timestamp: 1725950000000,
          });
        }),
      },
    } as unknown as Navigator;

    const adapter = new WebGeolocationAdapter({ targetNavigator: mockNavigator });
    const pos = await adapter.getCurrentPosition();

    expect(pos).toEqual({
      latitude: 15.9753,
      longitude: 108.2532,
      accuracy: 10,
      altitude: null,
      capturedAt: new Date(1725950000000).toISOString(),
    });
  });
});
