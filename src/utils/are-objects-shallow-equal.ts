export function areObjectsShallowEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const entriesA = Object.entries(a)
  const entriesB = Object.entries(b)
  return entriesA.length === entriesB.length && entriesA.every(([key, value]) => b[key] === value)
}
