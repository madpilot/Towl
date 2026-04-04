import NetInfo from '@react-native-community/netinfo';
import { create } from 'zustand';

type NetworkState = {
  isOnline: boolean;
  setOnline: (online: boolean) => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  isOnline: true,
  setOnline: (online) => set({ isOnline: online }),
}));

let unsubscribe: (() => void) | null = null;

export function startNetworkMonitoring(onOnline: () => void): void {
  if (unsubscribe) return;
  unsubscribe = NetInfo.addEventListener((state) => {
    const online = state.isConnected === true && state.isInternetReachable !== false;
    const wasOffline = !useNetworkStore.getState().isOnline;
    useNetworkStore.getState().setOnline(online);
    if (online && wasOffline) {
      onOnline();
    }
  });
}

export function stopNetworkMonitoring(): void {
  unsubscribe?.();
  unsubscribe = null;
}
