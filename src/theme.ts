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

/** Background tint for each KitchenOwl category dot/pill. */
export const CategoryColors: Record<string, string> = {
  'Produce': '#d6f5e0',
  'Dairy & Eggs': '#ddf0ff',
  'Meat & Seafood': '#ffd6d6',
  'Bakery': '#fff3d0',
  'Pantry': '#ead6ff',
  'Beverages': '#cce8ff',
  'Snacks': '#ffe8cc',
  'Condiments': '#e8e8ff',
  'Frozen': '#d4f0ff',
  'Prepared': '#ffd6cc',
  'Household': '#efefef',
  'Personal Care': '#ffd6f5',
  'Baby': '#ffe0f0',
  'Pet': '#e4f5e0',
  'Clothing': '#f0e8ff',
  'Office': '#e0e8ff',
  'Hardware': '#e8e4d4',
  'Electronics': '#d4e8ff',
  'Sports': '#d4f4e0',
  'Kitchenware': '#fff4e0',
  'Craft': '#f4e0ff',
  'Other': '#f0f0f0',
};

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
