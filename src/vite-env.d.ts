/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare global {
  interface ServiceWorkerGlobalScope {
    readonly __WB_MANIFEST: Array<{ revision: string | null; url: string }>;
  }
}

export {};
