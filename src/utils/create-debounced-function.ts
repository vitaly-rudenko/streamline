export function createDebouncedFunction<T extends (...args: unknown[]) => unknown>(fn: T, delayMs: number) {
  let timeoutId: ReturnType<typeof setTimeout>

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delayMs)
  }
}