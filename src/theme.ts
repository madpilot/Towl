/**
 * Design tokens for Towl.
 * All colours, spacing, radii and typography live here so components stay DRY.
 */

export const Colors = {
  mint: '#3d8c7a',
  mintLight: '#7de8c8',
  mintPale: '#b8f0e0',
  mintBg: '#f0faf6',
  yellow: '#f9c74f',
  starBorder: '#e8a800',
  textDark: '#2a5c50',
  textFaded: '#8ab5aa',
  white: '#ffffff',
  deleteRed: '#ffd6d6',
  deleteRedStrong: '#c0392b',
} as const;

/**
 * Rotating palette for category dot colours.
 * Index into this with `serverCategoryId % CATEGORY_PALETTE.length`.
 * The last entry is reserved for the "Uncategorized" group (null serverCategoryId).
 */
export const CATEGORY_PALETTE = [
  '#d6f5e0',
  '#ddf0ff',
  '#ffd6d6',
  '#fff3d0',
  '#ead6ff',
  '#cce8ff',
  '#ffe8cc',
  '#e8e8ff',
  '#d4f0ff',
  '#ffd6cc',
  '#ffd6f5',
  '#ffe0f0',
  '#e4f5e0',
  '#f0e8ff',
  '#e0e8ff',
  '#e8e4d4',
  '#d4e8ff',
  '#d4f4e0',
  '#fff4e0',
  '#f4e0ff',
  '#f0f0f0', // last slot: uncategorized / fallback
] as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const Radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

export const FontSize = {
  tiny: 10,
  label: 11,
  small: 13,
  body: 15,
  heading: 17,
  title: 26,
} as const;
