/** Creates a function that is re-ran continuously, faster in the beginning and slower after few retries */
export function createContinuousFunction<T extends () => void | Promise<void>>(fn: T, options: {
  coefficient?: number
  minMs: number
  maxMs: number
}) {
  let timeoutId: ReturnType<typeof setTimeout>
  let isDisposed = false

  const schedule = (current = 0) => {
    if (isDisposed) return
    clearTimeout(timeoutId)

    const delayMs = options.minMs * Math.pow(options.coefficient ?? 2, current)
    timeoutId = setTimeout(() => {
      if (isDisposed) return

      fn()
      schedule(delayMs > options.maxMs ? current : current + 1)
    }, Math.floor(Math.min(options.maxMs, delayMs)))
  }

  const dispose = () => {
    clearTimeout(timeoutId)
    isDisposed = true
  }

  return { schedule, dispose }
}
