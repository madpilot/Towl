import { io, Socket } from 'socket.io-client';
import { TokenStore } from '@/auth/tokenStore';
import { matchItem } from '@/data/foodMatcher';
import { upsertItemFromServer, removeItemByServerId } from '@/db/items';
import { useListDetailStore } from '@/store/listDetailStore';

// ─── Payload types ────────────────────────────────────────────────────────────

type SocketItem = {
  id: number;
  name: string;
  description: string;
  icon?: string | null;
  category?: { id: number; name: string; ordering: number } | null;
};

type ShoppinglistEventPayload = {
  item: SocketItem;
  shoppinglist: { id: number };
};

// ─── SocketManager ────────────────────────────────────────────────────────────

class SocketManager {
  private socket: Socket | null = null;

  async connect(): Promise<void> {
    if (this.socket?.connected) return;

    const [serverUrl, tokens] = await Promise.all([
      TokenStore.instance.getServerUrl(),
      TokenStore.instance.getTokens(),
    ]);
    if (!serverUrl || !tokens) return;

    this.socket = io(serverUrl, {
      path: '/socket.io/',
      transports: ['polling', 'websocket'],
      extraHeaders: {
        Authorization: `Bearer ${tokens.accessToken}`,
      },
    });

    this.socket.on('shoppinglist_item:add', (payload: ShoppinglistEventPayload) => {
      void this.onItemAdd(payload);
    });

    this.socket.on('shoppinglist_item:remove', (payload: ShoppinglistEventPayload) => {
      void this.onItemRemove(payload);
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  private async onItemAdd(payload: ShoppinglistEventPayload): Promise<void> {
    const { activeLocalId, activeServerId } = useListDetailStore.getState();
    if (!activeLocalId || activeServerId !== payload.shoppinglist.id) return;

    const { item } = payload;
    const match = matchItem(item.icon ?? item.name);
    await upsertItemFromServer(
      item.id,
      activeLocalId,
      item.name,
      item.description ?? '',
      match.iconKey,
      match.category,
      item.category?.id ?? null,
      item.category?.name ?? null,
      item.category?.ordering ?? null
    );
    await useListDetailStore.getState().reloadAfterSync();
  }

  private async onItemRemove(payload: ShoppinglistEventPayload): Promise<void> {
    const { activeLocalId, activeServerId } = useListDetailStore.getState();
    if (!activeLocalId || activeServerId !== payload.shoppinglist.id) return;

    await removeItemByServerId(activeLocalId, payload.item.id);
    await useListDetailStore.getState().reloadAfterSync();
  }
}

export const socketManager = new SocketManager();
