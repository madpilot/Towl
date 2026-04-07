# Agent Instructions

## Coding standards

* Always use curly braces around blocks - even for single line clauses.
* Prefer using classes, particularly if you need to maintain some sort of long lived variable.. Avoid mutating the state though.
* If you do use classes, try to instantiate them high up, and pass them in when required.
* Use fishery to create factories in tests. If way more flexible than building your own.
* Avoid using let. Use const. Call a function and return values if a variable needs to change based on a predicate.
* Don't pull in the whole module when importing. Just import the bits you need. ie don't do this: `import * as blah from 'foo'` do this instead: `import { blah } from 'foo'`
* Use the ApiClientManager - don't use axios directly.

## Icons

- Use SVG components (via `react-native-svg`) for all UI icons (navigation, actions, illustrations).
  The mockup SVGs are the canonical source of truth for icon shapes.
- For item icons, use `KitchenOwlIcon` which renders glyphs from `Items.ttf`.
  **Do not use emoji as fallbacks.** If an item's icon key has no codepoint in the font, omit the icon entirely — render nothing.
