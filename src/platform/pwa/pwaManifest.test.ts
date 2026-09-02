import { describe, expect, it } from 'vitest';
import { pwaManifest } from './pwaManifest.ts';

describe('PWA Manifest Configuration (PWA-03)', () => {
  it('contains assignment-required display mode: standalone', () => {
    expect(pwaManifest.display).toBe('standalone');
  });

  it('contains approved theme color #0284C7 and background color', () => {
    expect(pwaManifest.theme_color).toBe('#0284C7');
    expect(pwaManifest.background_color).toBe('#F8FAFC');
  });

  it('contains application name and short name appropriate to VKU Field Survey', () => {
    expect(pwaManifest.name).toBe('VKU Field Survey');
    expect(pwaManifest.short_name).toBe('VKU Survey');
  });

  it('contains valid icon entries for 192x192 and 512x512', () => {
    const icon192 = pwaManifest.icons.find((icon) => icon.sizes === '192x192');
    const icon512 = pwaManifest.icons.find(
      (icon) => icon.sizes === '512x512' && (!icon.purpose || icon.purpose === 'any')
    );
    const maskable512 = pwaManifest.icons.find(
      (icon) => icon.sizes === '512x512' && icon.purpose?.includes('maskable')
    );

    expect(icon192).toBeDefined();
    expect(icon192?.type).toBe('image/png');
    expect(icon192?.src).toBe('pwa-192x192.png');

    expect(icon512).toBeDefined();
    expect(icon512?.type).toBe('image/png');
    expect(icon512?.src).toBe('pwa-512x512.png');

    expect(maskable512).toBeDefined();
  });

  it('does not invent any remote backend URLs in manifest', () => {
    const manifestString = JSON.stringify(pwaManifest);
    expect(manifestString).not.toMatch(/https?:\/\//i);
    expect(manifestString).not.toMatch(/localhost:\d+/i);
    expect(manifestString).not.toMatch(/supabase/i);
    expect(manifestString).not.toMatch(/firebase/i);
  });
});
