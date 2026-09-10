import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { registerSW } from 'virtual:pwa-register';
import App from './app/App.tsx';
import './styles/app.css';

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  registerSW({
    immediate: true,
  });
}

// Capgo live updates: notify native plugin that current bundle is loaded successfully
if (Capacitor.isNativePlatform()) {
  void CapacitorUpdater.notifyAppReady();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
