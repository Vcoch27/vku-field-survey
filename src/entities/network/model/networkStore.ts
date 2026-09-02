import { create } from 'zustand';

export type SyncStatus = 'IDLE' | 'SYNCING' | 'SUCCESS' | 'ERROR';

interface NetworkState {
  isOnline: boolean;
  syncStatus: SyncStatus;
  setOnlineStatus: (status: boolean) => void;
  setSyncStatus: (status: SyncStatus) => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  syncStatus: 'IDLE',
  setOnlineStatus: (status) => set({ isOnline: status }),
  setSyncStatus: (status) => set({ syncStatus: status }),
}));
