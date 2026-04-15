# Towl

A React Native grocery list app for [KitchenOwl](https://kitchenowl.org) — offline-first, with smart item parsing and 403 custom food icons.

---

## What it does

Towl connects to a self-hosted KitchenOwl instance and gives you a fast, offline-capable shopping list on your phone.

- **Multiple lists & households** — switch households and lists in one tap
- **Smart item input** — type "500g beef mince" and the app splits the quantity into a description and matches the catalog item automatically
- **Instant suggestions** — fuzzy-matched item and icon suggestions appear as you type, ranked by catalog match
- **Offline-first** — all actions write to local SQLite immediately; a sync queue drains in the background when you're back online
- **Item categories** — items are grouped by category, with drag-to-reorder support
- **Trolley** — checked items stay visible in a separate section for 4 hours, then expire automatically
- **Important items** — star an item to flag it as a priority (synced to KitchenOwl via `!` prefix convention)
- **Custom icons** — 403 food/grocery glyphs from KitchenOwl's `Items.ttf` icon font, one per item

---

## Tech stack

| Concern | Library |
|---|---|
| Framework | [Expo](https://expo.dev) 54 (managed) + React Native 0.81 |
| Language | TypeScript 5.9 |
| Navigation | React Navigation v7 (native stack + bottom tabs) |
| State | [Zustand](https://github.com/pmndrs/zustand) 5 |
| Local DB | [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/) 16 (WAL mode) |
| Secure storage | [expo-secure-store](https://docs.expo.dev/versions/latest/sdk/securestore/) 15 |
| HTTP | [Axios](https://axios-http.com) 1.14 with JWT refresh interceptor |
| Validation | [Zod](https://zod.dev) 4 |
| Fuzzy search | [Fuse.js](https://fusejs.io) 7 |
| Animations | [react-native-reanimated](https://docs.swmansion.com/react-native-reanimated/) 4 |
| Gestures | [react-native-gesture-handler](https://docs.swmansion.com/react-native-gesture-handler/) 2 |
| Lists | [@shopify/flash-list](https://shopify.github.io/flash-list/) 2 |
| Testing | jest-expo + @testing-library/react-native |

---

## Project structure

```
assets/
└── fonts/Items.ttf        # KitchenOwl icon font (403 glyphs, U+0100–U+0292)
src/
├── api/                   # HTTP clients and Zod schemas
│   ├── auth.ts            # Login, token refresh, long-lived token
│   ├── client.ts          # Axios instance + JWT refresh interceptor
│   ├── households.ts      # Household & category endpoints
│   └── shoppinglists.ts   # List and item CRUD
├── auth/
│   ├── authManager.ts     # initializeAuth() — session restore on launch
│   └── tokenStore.ts      # SecureStore helpers; Zod-validated user/token shapes
├── components/            # Shared UI components
│   ├── AddItemBar.tsx      # Smart input bar with live suggestions
│   ├── CategorySection.tsx # Category group header + items
│   ├── KitchenOwlIcon.tsx  # Renders Items.ttf glyph
│   ├── SwipeableItem.tsx   # Swipeable list row (check / star / delete)
│   └── SyncIndicator.tsx   # Animated sync status badge
├── data/
│   ├── foodMatcher.ts      # Fuse.js icon/item fuzzy search
│   └── iconMetadata.ts     # Emoji fallback + category per icon key
├── db/
│   ├── schema.ts           # SQLite schema and migrations
│   ├── items.ts            # Item queries
│   ├── lists.ts            # List queries
│   ├── history.ts          # Item usage history
│   └── syncQueue.ts        # Outbound operation queue
├── hooks/
│   └── useItemSuggestions.ts  # Debounced suggestion hook
├── icons/
│   └── kitchenowlIcons.ts  # Codepoint map + getIconChar()
├── navigation/
│   ├── RootNavigator.tsx   # Auth-gated root navigator
│   └── types.ts            # Navigation param types
├── screens/
│   ├── auth/               # Welcome, ServerSetup, Login
│   ├── lists/              # ListDetail (main screen)
│   ├── households/         # HouseholdPicker
│   └── settings/           # Settings, HouseholdDetail, Items, Categories
├── store/
│   ├── authStore.ts        # Auth status, API client refs
│   ├── householdStore.ts   # Selected household + persistence
│   ├── listDetailStore.ts  # Active list state and all item actions
│   └── syncStore.ts        # Sync status (idle / syncing / error)
├── sync/
│   ├── syncManager.ts      # Queue draining with exponential backoff
│   └── connectivityMonitor.ts  # NetInfo wrapper
└── utils/
    └── constants.ts        # SecureStore keys, backoff schedule
```

---

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org) 20+
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (`npm install -g expo-cli`)
- A running [KitchenOwl](https://kitchenowl.org) instance (self-hosted)
- iOS Simulator (Mac only) or Android Emulator, or the [Expo Go](https://expo.dev/go) app on a physical device

### Install

```bash
git clone https://github.com/madpilot/Towl.git
cd Towl
npm install
```

### Run

```bash
npm start          # Start the Expo dev server; choose iOS / Android / web
npm run ios        # Open directly in iOS Simulator
npm run android    # Open directly in Android Emulator
```

### First launch

1. Enter the URL of your KitchenOwl instance (e.g. `https://kitchen.example.com`)
2. Sign in with your KitchenOwl username and password
3. Select a household
4. Your shopping lists load automatically — any edits made offline will sync when you reconnect

---

## Commands

```bash
npm run lint       # ESLint (TypeScript + React rules)
npm run format     # Prettier (formats src/**/*.{ts,tsx})
npm run typecheck  # tsc --noEmit
npm test           # Jest (interactive)
npm run test:ci    # Jest with coverage (CI mode)
```

---

## Architecture

### Auth

```
SecureStore ──► initializeAuth() ──► authStore (unknown → authenticated / unauthenticated)
                                          │
                                          ▼
                               RootNavigator renders
                               AuthStack or AppStack
```

Session restore on launch requires only a stored server URL and a valid token — no network call. The Axios interceptor handles token refresh transparently on the first 401 after expiry. The fallback chain is: access token → refresh token → long-lived token (LLT). If all three fail the session is expired and the user is returned to the login screen.

### Offline-first data flow

```
User action
    │
    ▼
Optimistic SQLite write          ◄── UI reads from SQLite (always fast)
    │
    ▼
enqueue(SyncPayload)             ◄── discriminated union: ADD_ITEM | REMOVE_ITEM |
    │                                CHECK_ITEM | UPDATE_ITEM | UPDATE_ITEM_DESC |
    ▼                                CREATE_LIST | DELETE_LIST
syncManager.drain()
    │
    ├── online?  ──No──► scheduleRetry (exponential backoff)
    │
    └── Yes ──► executeOp() ──► KitchenOwl API
                    │
                    ├── success  ──► remove from queue; markItemSynced()
                    ├── 4xx      ──► discard (non-retryable)
                    └── 5xx/net  ──► incrementAttempts(); retry after backoff
```

### Item suggestions

```
User types in AddItemBar
    │
    ▼
useItemSuggestions (180 ms debounce)
    │
    ├── shoppingListsApi.searchItems() ──► KitchenOwl catalog search
    │
    └── results ──► suggestion chips (name + KitchenOwlIcon + category)

Tap a chip or press return
    │
    ▼
parseItemInput() — progressive token-stripping
    │   "500g Beef Mince" ──► { name: "Beef Mince", description: "500g", iconKey: "beef" }
    │
    ▼
addItem() ──► SQLite write ──► sync queue
```

### Icon rendering

```
iconKey ("apple")
    │
    ▼
getIconChar()  ──► codepoint map ──► String.fromCodePoint(0x103)
    │
    ▼
<Text fontFamily="Items">{char}</Text>   ← expo-font loaded Items.ttf
```

---

## Code conventions

- **Zod-first** — all data crossing a network or persistence boundary is parsed through a Zod schema; TypeScript types are derived with `z.infer<>`, never written by hand
- **No `as` casts** in production code — `JSON.parse()` goes directly to `Schema.parse()`
- **Named function declarations** for all exported functions and React components
- **Curly braces everywhere** — even single-line `if` bodies
- **`const` over `let`** — `let` only where reassignment is needed
- **Named imports only** — no `import * as X`

See [AGENTS.md](./AGENTS.md) for the full conventions reference.

---

## Testing

Tests live in `src/__tests__/` mirroring the source tree. Every module with meaningful logic has a corresponding test file.

```bash
npm run test:ci    # Run all tests with coverage
```

The test suite mocks `expo-sqlite`, `expo-secure-store`, and networking at the top of each file. See AGENTS.md for patterns on priming the SQLite cache in `beforeAll` and using `jest.Mock` casts safely.

---

## License

MIT
