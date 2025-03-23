export async function waitUntil(check: () => boolean, checkFrequencyMs = 250) {
  return new Promise<void>(resolve => {
    const intervalId = setInterval(() => {
      if (check()) {
        clearInterval(intervalId)
        resolve()
      }
    }, checkFrequencyMs)
  })
}
