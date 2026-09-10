import { Geolocation, type GeolocationPlugin } from '@capacitor/geolocation';
import type { GeolocationPort, GeolocationPosition } from '../../domain/ports.ts';

export interface CapacitorGeolocationAdapterOptions {
  readonly plugin?: GeolocationPlugin;
}

export class CapacitorGeolocationAdapter implements GeolocationPort {
  private readonly plugin: GeolocationPlugin;

  constructor(options?: CapacitorGeolocationAdapterOptions) {
    this.plugin = options?.plugin ?? Geolocation;
  }

  public async getCurrentPosition(): Promise<GeolocationPosition | null> {
    try {
      if (typeof this.plugin.checkPermissions === 'function') {
        const permission = await this.plugin.checkPermissions();
        if (permission.location !== 'granted') {
          const requested = await this.plugin.requestPermissions();
          if (requested.location !== 'granted') {
            console.warn('Geolocation permission not granted.');
            return null;
          }
        }
      }

      const pos = await this.plugin.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 5_000,
      });

      return {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        altitude: pos.coords.altitude ?? null,
        capturedAt: new Date(pos.timestamp).toISOString(),
      };
    } catch (err) {
      console.warn('Failed to retrieve native GPS position:', err);
      return null;
    }
  }
}
