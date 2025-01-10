export const patterns = {
  findLinesWithAllWordsInProvidedOrder: (words: string[]): string => {
    return words.join('.*?')
  },
  findLinesWithAllWordsInAnyOrder: (words: string[]): string => {
    return '^' + words.map(escapedWord => `(?=.*?${escapedWord})`).join('') + '.*$'
  },
  findFilesWithAllWordsInProvidedOrder: (words: string[]): string => {
    return words.join('(?:.|\\n)*?')
  },
  findFilesWithAllWordsInAnyOrder: (words: string[]): string => {
    return '^' + words.map(escapedWord => `(?=(?:.|\\n)*?${escapedWord})`).join('') + '(?:.|\\n)*$'
  },
}
