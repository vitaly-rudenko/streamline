export function extractWords(input: string): string[] {
  return input
    .replaceAll(/[^a-zA-Z0-9]+/g, ' ')
    .replaceAll(/([a-z])([A-Z])/g, '$1 $2')
    .replaceAll(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .replaceAll(/(\d+)/g, ' $1 ')
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 0)
}