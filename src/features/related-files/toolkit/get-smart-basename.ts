import { basename } from 'path'

// 'my.service.test.ts' => 'my.service' (if excludedSuffixes: ['test', 'ts'])
export function getSmartBasename(path: string, excludedSuffixes: string[]) {
    const parts = basename(path).split('.')

    while (parts.length > 1 && excludedSuffixes.includes(parts.at(-1)!)) {
        parts.pop()
    }

    return parts.join('.')
}