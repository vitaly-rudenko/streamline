export const filter = <T>(array: T[], callback: (currentValue: T) => boolean) => {
  const filtered: T[] = []
  const removed: T[] = []

  for (const item of array) {
    if (callback(item)) {
      filtered.push(item)
    } else {
      removed.push(item)
    }
  }

  return [filtered, removed]
}
