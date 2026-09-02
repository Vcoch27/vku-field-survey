import { Capacitor } from '@capacitor/core';

/**
 * Returns true if running within a native platform wrapper (Android/iOS) via Capacitor.
 * Returns false when running in a standard web browser or installed PWA.
 */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}
