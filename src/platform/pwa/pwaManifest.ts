export interface PwaIcon {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
}

export interface PwaManifestConfig {
  name: string;
  short_name: string;
  description: string;
  theme_color: string;
  background_color: string;
  display: 'standalone';
  start_url: string;
  scope: string;
  icons: PwaIcon[];
}

export const pwaManifest: PwaManifestConfig = {
  name: 'VKU Field Survey',
  short_name: 'VKU Survey',
  description: 'Campus Equipment & Facility Inspection',
  theme_color: '#0284C7',
  background_color: '#F8FAFC',
  display: 'standalone',
  start_url: '/',
  scope: '/',
  icons: [
    {
      src: 'pwa-192x192.png',
      sizes: '192x192',
      type: 'image/png',
    },
    {
      src: 'pwa-512x512.png',
      sizes: '512x512',
      type: 'image/png',
    },
    {
      src: 'pwa-512x512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any maskable',
    },
  ],
};
