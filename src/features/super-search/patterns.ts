import { escapeRegex } from '../../utils/escape-regex'

export type PatternOptions = {
  matchWholeWord: boolean
  escapeRegex: boolean
}

export const patterns = {
  findLinesWithAllWordsInProvidedOrder: (words: string[], options?: PatternOptions): string => {
    return words
      .map(word => options?.escapeRegex ? escapeRegex(word) : word)
      .map(word => options?.matchWholeWord ? bounded(word) : word)
      .join('.*?')
  },
  findLinesWithAllWordsInAnyOrder: (words: string[], options?: PatternOptions): string => {
    return '^' + words
      .map(word => options?.escapeRegex ? escapeRegex(word) : word)
      .map(word => options?.matchWholeWord ? bounded(word) : word)
      .map(escapedWord => `(?=.*?${escapedWord})`).join('') + '.*$'
  },
  findFilesWithAllWordsInProvidedOrder: (words: string[], options?: PatternOptions): string => {
    return words
      .map(word => options?.escapeRegex ? escapeRegex(word) : word)
      .map(word => options?.matchWholeWord ? bounded(word) : word)
      .join('(?:.|\\n)*?')
  },
  findFilesWithAllWordsInAnyOrder: (words: string[], options?: PatternOptions): string => {
    return '^' + words
      .map(word => options?.escapeRegex ? escapeRegex(word) : word)
      .map(word => options?.matchWholeWord ? bounded(word) : word)
      .map(escapedWord => `(?=(?:.|\\n)*?${escapedWord})`).join('') + '(?:.|\\n)*$'
  },
}

function bounded(input: string): string {
  return `\\b${input}\\b`
}
