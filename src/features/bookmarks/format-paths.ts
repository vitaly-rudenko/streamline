import { getSharedPath } from '../tab-history/get-shared-path'

export function formatPaths(paths: string[]): Map<string, string> {
  const filenamePaths = new Map<string, string[]>()
  for (const path of paths) {
    const filename = path.split('/').at(-1)!
    filenamePaths.set(filename, filenamePaths.has(filename) ? filenamePaths.get(filename)!.concat(path) : [path])
  }

  const filenameSharedPaths = new Map<string, string>()
  for (const [filename, paths] of filenamePaths.entries()) {
    filenameSharedPaths.set(filename, getSharedPath(paths))
  }

  const results = new Map<string, string>()
  for (const path of paths) {
    if (results.has(path)) continue

    const filename = path.split('/').at(-1)!
    const sharedPath = filenameSharedPaths.get(filename)!
    results.set(path, path.replace(sharedPath + '/', ''))
  }

  return results
}