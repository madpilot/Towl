# CLAUDE.md

## Project Overview

**Towl** is a React Native mobile app for managing KitchenOwl grocery lists. It supports full offline use with a local SQLite database and a sync queue that drains automatically on reconnect. Users authenticate against a self-hosted KitchenOwl instance using JWT + refresh token + long-lived token (LLT) strategy, and item suggestions are powered by Fuse.js fuzzy matching against KitchenOwl's `Items.ttf` icon font.

## Tech Stack

- **Expo** (managed workflow) + **React Native**, TypeScript
- **React Navigation** v6 — native stack + bottom tabs
- **Zustand** — client state management
- **expo-sqlite** — local relational storage (offline-first)
- **expo-secure-store** — encrypted token/user persistence
- **expo-font** — loads `Items.ttf` custom icon font
- **Axios** — HTTP client with JWT refresh interceptor
- **Zod** — runtime shape validation for all persisted/parsed data
- **Fuse.js** — fuzzy icon/item matching
- **uuid** — local record IDs for the sync queue
- **jest-expo** + **@testing-library/react-native** — testing

## Commands

```bash
npm start          # Start Expo dev server
npm run android    # Start on Android
npm run ios        # Start on iOS
npm run lint       # Run ESLint (src/**/*.{ts,tsx})
npm run typecheck  # Run tsc --noEmit
npm test           # Run Jest (passWithNoTests)
npm run test:ci    # Run Jest with coverage (CI mode)
```

## Project Structure

```
assets/
└── fonts/Items.ttf           # KitchenOwl icon font (403 glyphs, U+0100–U+0292)
src/
├── api/
│   ├── auth.ts               # Login, refresh, LLT endpoints
│   ├── client.ts             # Axios instance + JWT refresh interceptor
│   ├── households.ts         # Household type/schema + getHouseholds()
│   └── shoppinglists.ts      # List/item API calls
├── auth/
│   ├── authManager.ts        # initializeAuth() — restores session on launch
│   └── tokenStore.ts         # SecureStore helpers; StoredUserSchema (Zod)
├── components/
│   ├── AddItemSheet.tsx       # Bottom sheet for adding items; uses useItemSuggestions
│   ├── KitchenOwlIcon.tsx     # Renders Items.ttf glyph; emoji fallback
│   └── SyncIndicator.tsx      # Animated sync status badge
├── data/
│   ├── foodMatcher.ts         # suggestIcons() via Fuse.js
│   └── iconMetadata.ts        # Emoji + category lookup per icon key
├── db/
│   ├── schema.ts              # SQLite schema init + migrations
│   ├── history.ts             # Item history table (frequency/recency ranking)
│   ├── items.ts               # Local items table
│   ├── lists.ts               # Local lists table
│   └── syncQueue.ts           # Sync queue; SyncPayloadSchema (Zod discriminated union)
├── hooks/
│   └── useItemSuggestions.ts  # Debounced hook: history + icon fuzzy suggestions
├── icons/
│   └── kitchenowlIcons.ts     # Codepoint map + getIconChar(); FONT_FAMILY constant
├── navigation/
│   ├── RootNavigator.tsx      # Auth-gated root; splash → auth / app stacks
│   └── types.ts               # Navigation param types
├── screens/
│   ├── auth/
│   │   ├── LoginScreen.tsx
│   │   └── ServerSetupScreen.tsx
│   └── lists/
│       ├── ListsScreen.tsx
│       └── ListDetailScreen.tsx
├── store/
│   ├── authStore.ts           # Zustand auth state (status, user, tokens)
│   ├── householdStore.ts      # Zustand household state; HouseholdSchema (Zod)
│   └── syncStore.ts           # Zustand sync status
├── sync/
│   ├── connectivityMonitor.ts # NetInfo wrapper; fires onOnline/onOffline callbacks
│   └── syncManager.ts         # Drains sync queue; exponential backoff retry
└── utils/
    └── constants.ts           # SecureStore keys, API path constants
```

## Architecture

**Auth flow:**
```
SecureStore → initializeAuth() → authStore (status: unknown → authenticated/unauthenticated)
    → RootNavigator renders AuthStack or AppStack
```

**Offline-first data flow:**
```
User action → optimistic local SQLite write → enqueue(SyncPayload)
    → SyncManager drains on connectivity → KitchenOwl API
    → on success: remove from queue; on failure: incrementAttempts + scheduleRetry
```

**Icon rendering:**
```
iconKey → getIconChar() → Items.ttf glyph (KitchenOwlIcon component)
    → fallback: ICON_METADATA[iconKey].emoji
```

**Suggestion pipeline:**
```
useItemSuggestions(input) → searchHistory() (SQLite, ranked) + suggestIcons() (Fuse.js)
    → deduplicated ItemSuggestion[] → AddItemSheet chips
```

## Code Conventions

### Types and Zod

All data that crosses a persistence or network boundary must be validated with a Zod schema. Derive TypeScript types from schemas — do not write types by hand for validated data:

```typescript
// Correct
export const StoredUserSchema = z.object({ id: z.number(), name: z.string(), email: z.string() });
export type StoredUser = z.infer<typeof StoredUserSchema>;

// Avoid
export interface StoredUser { id: number; name: string; email: string; }
```

Use `z.discriminatedUnion` for payloads with a type tag (`opType`, `kind`, etc.).

### No `as` typecasts in production code

Never use `as SomeType` in `src/` outside of `__tests__/` or `__mocks__/`. `JSON.parse` returns `any` — pass it directly to `Schema.parse()`:

```typescript
// Correct
return StoredUserSchema.parse(JSON.parse(raw));

// Avoid
const user: StoredUser = JSON.parse(raw);   // silent cast
const user = JSON.parse(raw) as StoredUser; // explicit cast
```

In tests, `as unknown as jest.Mock` is acceptable for mocking functions that have non-callable types (e.g. type predicates).

### Functions vs Arrow Functions

Use `function` declarations for exported functions and React components. Arrow functions are fine for inline callbacks and non-exported helpers:

```typescript
// Correct
export function getIconChar(key: string): string | null { ... }
export default function AddItemSheet({ visible, onClose }: Props) { ... }

// Avoid for exports
export const getIconChar = (key: string): string | null => { ... }
```

### React Components

Named functions for all components (required for `react/display-name`). This applies to mock components in tests too — use named function expressions, not anonymous arrows:

```typescript
// Correct (even in jest.mock factories)
function LoginScreen() { return React.createElement(Text, null, 'Login'); }
return LoginScreen;

// Avoid — triggers react/display-name lint error
return () => React.createElement(Text, null, 'Login');
```

### Async & Error Handling

Throw plain `Error` with a descriptive message. No custom error classes. Let Zod validation errors propagate — only catch at boundaries where you can meaningfully recover:

```typescript
// Correct — let Zod throw in rowToOp; caller handles corrupt queue rows
const payload = SyncPayloadSchema.parse(JSON.parse(row.payload));

// Correct — catch at SecureStore boundary; return null on bad data
try {
  return StoredUserSchema.parse(JSON.parse(raw));
} catch {
  return null;
}
```

### State Management

- **Zustand** for cross-component state (auth status, household selection, sync status)
- **useState / useReducer** for local component state
- Never call `useHouseholdStore.getState()` from inside a component — use the hook

### SQLite

All schema setup and migrations live in `src/db/schema.ts`. Each table module (`lists.ts`, `items.ts`, `history.ts`, `syncQueue.ts`) calls `getDb()` and works with typed row interfaces. Never write raw schema SQL outside of `schema.ts`.

## Testing

All code must have tests. Tests live in `src/__tests__/` mirroring the source structure. Every test file must contain at least one test (empty files cause Jest to fail).

Use `jest-expo` preset. Mock expo modules and SQLite at the top of each test file before any imports:

```typescript
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
```

Use `jest.Mock` cast only with `as unknown as jest.Mock` when the original type is not callable (e.g. type predicate functions). For normal functions, `jest.Mock` cast is fine directly.

### Test structure

Follow `describe` / `beforeEach` / `it` structure. Group by public function or component behaviour:

```typescript
describe('syncQueue', () => {
  describe('enqueue', () => {
    it('inserts an ADD_ITEM op and returns the typed record', async () => { ... });
  });
  describe('getAll', () => {
    it('throws when stored payload has an unknown opType', async () => { ... });
  });
});
```

## Development Workflow

- All work is done on feature branches; changes are submitted as PRs targeting stacked branches
- Branch stack: `claude/...Anlix` → `feat/towl-auth` → `feat/towl-screens` → `feat/towl-offline-sync` → `feat/towl-history`
- ESLint and TypeScript must be clean (`npm run lint` and `npm run typecheck` exit 0) before pushing
- All tests must pass (`npm run test:ci` exit 0) before pushing
- Fixes to shared files must be backported down the stack via `git checkout <branch> -- <file>`

## KitchenOwl API Reference

### Data model
KitchenOwl items are **catalog-level entities** shared across a household. Name and icon are catalog properties; `description` is the only per-list-instance field. Shopping lists hold references to catalog items — not independent copies.

### Relevant endpoints

| Action | Method | Path | Body |
|--------|--------|------|------|
| Fetch lists + items | GET | `/household/{id}/shoppinglist` | — |
| Add item to list | POST | `/shoppinglist/{listId}/add-item-by-name` | `{name, description}` |
| Remove item from list | DELETE | `/shoppinglist/{listId}/item` | `{item_id}` |
| Update item description | POST | `/shoppinglist/{listId}/item/{itemId}` | `{description}` |
| **Update item name/icon** | POST | `/item/{itemId}` | see below |
| Create list | POST | `/household/{id}/shoppinglist` | `{name}` |
| Delete list | DELETE | `/shoppinglist/{id}` | — |

### Updating an item (`POST /item/{itemId}`)

The endpoint expects the full item object. At minimum include `name`, `icon` (omit if null), and `category`:

```json
{
  "name": "celery",
  "icon": "celery",
  "category": { "id": 4, "name": "🥬 Fruits and vegetables", "ordering": 0 }
}
```

`category` is a nested object — not a flat `category_id`. Send `null` / omit for items with no server category yet.

The category `id` + `name` + `ordering` come from `GET /household/{id}/category` (or from the `category` field on items returned by the shopping list endpoint). We store `server_category_id`, `server_category_name`, and `server_category_ordering` on `local_items` for this purpose, populated when syncing from server (`upsertItemFromServer`) and after an ADD_ITEM drain (`markItemSynced`).

## Known Patterns and Pitfalls

### Stale React state vs. DB state
`syncManager.drain()` runs asynchronously after `enqueue()`. By the time the user triggers a follow-up action (edit, delete), `markItemSynced` may have already updated `server_id` in the DB while React state still shows `serverId: null`.

**Rule**: Any sync op that depends on `serverId` (UPDATE_ITEM, REMOVE_ITEM) must read fresh from the DB via `itemsDb.getItem(localId)`, not from React state:

```typescript
const freshItem = await itemsDb.getItem(localId);
if (freshItem?.serverId !== null && freshItem?.serverId !== undefined) {
  await syncManager.enqueue({ opType: 'UPDATE_ITEM', itemServerId: freshItem.serverId, ... });
}
```

### Dirty indicator after sync
`item.isDirty` is shown as a yellow dot in `SwipeableItem`. It is set to `true` on local writes and cleared by `markItemSynced` in the DB — but React state is not automatically updated. The screen watches `useSyncStore` status and reloads items from DB whenever it transitions to `'idle'`:

```typescript
const syncStatus = useSyncStore((s) => s.status);
useEffect(() => {
  if (syncStatus === 'idle' && activeLocalId) void loadItems(activeLocalId);
}, [syncStatus, activeLocalId, loadItems]);
```

### `beforeAll` for DB cache priming in tests
When a test file exercises DB functions, `getDb()` calls `getFirstAsync` internally for the schema version check. If tests mock `mockResolvedValueOnce`, the schema check consumes the first mock value. Prime the DB cache once with `beforeAll` so individual tests only mock their own queries:

```typescript
beforeAll(async () => {
  (SQLite.openDatabaseAsync as jest.Mock).mockResolvedValue(mockDb);
  const { getDb } = require('@/db/schema');
  await getDb();
});
```
