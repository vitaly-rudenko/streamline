export function areArraysShallowEqual<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((_, i) => a[i] === b[i])
}
