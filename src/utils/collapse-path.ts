const MAX_ATTEMPTS = 100

export function collapsePath(path: string, maxLength: number) {
  if (path.length <= maxLength) return path
  if (maxLength === 0) throw new Error('Invalid maxLength: 0')

  let parts = path.split('/')
  const collapsedCounts: number[] = new Array(parts.length).fill(0)

  function getResultingLength() {
    return parts.join('/').length
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (getResultingLength() <= maxLength) break

    const maxPartLength = Math.max(...parts.map(p => p.length))
    if (maxPartLength === 0) break

    const maxPartIndexLastPartPrioritized = parts[parts.length - 1].length > 0 ? parts.length - 1 : -1
    const maxPartIndexAlreadyCollapsed = parts.findIndex((p, i) => p.length === maxPartLength && collapsedCounts[i] > 0)
    const maxPartIndex = maxPartIndexLastPartPrioritized !== -1
      ? maxPartIndexLastPartPrioritized
      : maxPartIndexAlreadyCollapsed !== -1
        ? maxPartIndexAlreadyCollapsed
        : parts.findIndex(p => p.length === maxPartLength)
    if (maxPartIndex === -1) throw new Error('Unexpected error when trying to find longest part of the path')

    const sliceAmount = collapsedCounts[maxPartIndex] === 0 ? 3 : 1
    if (maxPartIndex === parts.length - 1) {
      parts[maxPartIndex] = parts[maxPartIndex].slice(sliceAmount)
    } else {
      parts[maxPartIndex] = parts[maxPartIndex].slice(0, -sliceAmount)
    }

    collapsedCounts[maxPartIndex]++
  }

  return parts.map((part, index) => {
    if (collapsedCounts[index] > 0) {
      if (index === parts.length - 1) {
        return '…' + part
      } else {
        return part + '…'
      }
    }

    return part
  }).join('/')
}