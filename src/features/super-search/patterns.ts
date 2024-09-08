export const patterns = {
  findInAllNamingConventions: (words: string[]): string => {
    return words.join('[-_]?')
  },
  findLinesWithAllWordsInProvidedOrder: (words: string[]): string => {
    return words.join('.*')
  },
  findLinesWithAllWordsInAnyOrder: (words: string[]): string => {
    return `^${words.map(word => `(?=[\\s\\S]*(${word}))`).join('')}[\\s\\S]*$`
  },
  findFilesWithAllWordsInProvidedOrder: (words: string[]): string => {
    return words.join('.*')
  },
  findFilesWithAllWordsInAnyOrder: (words: string[]): string => {
    return `^${words.map(word => `(?=[\\s\\S\\n]*(${word}))`).join('')}[\\s\\S\\n]*$`
  },
}

