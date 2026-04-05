# Agent Instructions

## Icons

- Use SVG components (via `react-native-svg`) for all UI icons (navigation, actions, illustrations).
  The mockup SVGs are the canonical source of truth for icon shapes.
- For item icons, use `KitchenOwlIcon` which renders glyphs from `Items.ttf`.
  **Do not use emoji as fallbacks.** If an item's icon key has no codepoint in the font, omit the icon entirely — render nothing.
