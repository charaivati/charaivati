export function generateSlug(name: string): string {
  return name.toLowerCase().trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}
