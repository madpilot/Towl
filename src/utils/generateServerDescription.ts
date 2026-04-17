import type { LocalItem } from '@/db/items';

export function generateServerDescription(item: LocalItem): string {
  return item.isImportant ? `!${item.description}` : item.description;
}
