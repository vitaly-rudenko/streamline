export type PatternType = keyof typeof patterns

export type PatternOptions = {
  wholeWord: boolean
}

export const patterns = {
  findInAllNamingConventions: (words: string[]): string => {
    return words
      .map(word => escape(word))
      .join('[-_]?')
  },
  findLinesWithAllWordsInProvidedOrder: (words: string[], options?: PatternOptions): string => {
    return words
      .map(word => escape(word))
      .map(word => options?.wholeWord ? bounded(word) : word)
      .join('.*?')
  },
  findLinesWithAllWordsInAnyOrder: (words: string[], options?: PatternOptions): string => {
    return '^' + words
      .map(word => escape(word))
      .map(word => options?.wholeWord ? bounded(word) : word)
      .map(escapedWord => `(?=.*?${escapedWord})`).join('') + '.*$'
  },
  findFilesWithAllWordsInProvidedOrder: (words: string[], options?: PatternOptions): string => {
    return words
      .map(word => escape(word))
      .map(word => options?.wholeWord ? bounded(word) : word)
      .join('(?:.|\\n)*?')
  },
  findFilesWithAllWordsInAnyOrder: (words: string[], options?: PatternOptions): string => {
    return '^' + words
      .map(word => escape(word))
      .map(word => options?.wholeWord ? bounded(word) : word)
      .map(escapedWord => `(?=(?:.|\\n)*?${escapedWord})`).join('') + '(?:.|\\n)*$'
  },
}

function escape(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function bounded(input: string): string {
  return `\\b${input}\\b`
}
