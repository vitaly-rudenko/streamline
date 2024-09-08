export const patterns = {
  findInAllNamingConventions: (words: string[]): string => {
    return words
      .map(word => escapeRegExp(word))
      .join('[-_]?')
  },
  findLinesWithAllWordsInProvidedOrder: (words: string[]): string => {
    return words
      .map(word => escapeRegExp(word))
      .join('.*')
  },
  findLinesWithAllWordsInAnyOrder: (words: string[]): string => {
    return words
      .map(word => escapeRegExp(word))
      .map(word => `(?=(?:.|\n)*${word})`).join('')
  },
  findFilesWithAllWordsInProvidedOrder: (words: string[]): string => {
    return words
      .map(word => escapeRegExp(word))
      .join('(?:.|\n)*')
  },
  findFilesWithAllWordsInAnyOrder: (words: string[]): string => {
    return words
      .map(word => escapeRegExp(word))
      .map(word => `(?=(?:.|\n)*${word})`).join('')
  },
}

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
