export function areObjectsShallowEqual(a: Readonly<Record<string, unknown>>, b: Readonly<Record<string, unknown>>): boolean {
  const entriesA = Object.entries(a)
  const entriesB = Object.entries(b)
  return entriesA.length === entriesB.length && entriesA.every(([key, value]) => b[key] === value)
}
