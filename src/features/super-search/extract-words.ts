export function extractWords(input: string): string[] {
  return input
    .replaceAll(/[-_]+/g, ' ')
    .replaceAll(/([a-z])([A-Z])/g, '$1 $2')
    .replaceAll(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .replaceAll(/(\d+)/g, ' $1 ')
    .split(/\s+/)
    .filter(word => word.length > 0)
}