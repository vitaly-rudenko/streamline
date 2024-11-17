import { getFilename } from '../../utils/get-filename'

export function getSmartBasename(path: string, excludedSuffixes: string[]) {
    const filename = getFilename(path)
    const parts = filename.split('.')

    while (parts.length > 1 && excludedSuffixes.includes(parts.at(-1)!)) {
        parts.pop()
    }

    return parts.join('.')
}