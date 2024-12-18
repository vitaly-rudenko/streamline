import { basename } from 'path'

// 'my.service.test.ts' => 'my.service' (if excludedSuffixes: ['test'])
export function getSmartBasename(path: string, excludedSuffixes: string[]) {
    const parts = basename(path).split('.')

    if (parts.filter(Boolean).length > 1) parts.pop() // Remove extension

    // Remove excluded suffixes
    while (parts.length > 1 && excludedSuffixes.includes(parts.at(-1)!)) {
        parts.pop()
    }

    return parts.join('.')
}