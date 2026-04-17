export function generateServerDescription(description: string, isImportant: boolean): string {
  return isImportant ? `!${description}` : description;
}
