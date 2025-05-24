export function createDebouncedFunction<T extends (...args: any) => any>(fn: T, delayMs: number) {
  let timeoutId: ReturnType<typeof setTimeout>
  let isDisposed = false

  const schedule = (...args: Parameters<T>) => {
    if (isDisposed) return
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => {
      if (isDisposed) return
      fn(...args)
    }, delayMs)
  }

  const dispose = () => {
    clearTimeout(timeoutId)
    isDisposed = true
  }

  return { schedule, dispose }
}