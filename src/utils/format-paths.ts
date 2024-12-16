import { basename } from 'path'
import { getSharedPath } from './get-shared-path'

export function formatPaths(paths: string[]): Map<string, string> {
  const basenamePaths = new Map<string, string[]>()
  for (const path of paths) {
    const pathBasename = basename(path)
    basenamePaths.set(pathBasename, basenamePaths.has(pathBasename) ? basenamePaths.get(pathBasename)!.concat(path) : [path])
  }

  const basenameSharedPaths = new Map<string, string>()
  for (const [basename, paths] of basenamePaths.entries()) {
    basenameSharedPaths.set(basename, getSharedPath(paths))
  }

  const results = new Map<string, string>()
  for (const path of paths) {
    if (results.has(path)) continue

    const sharedPath = basenameSharedPaths.get(basename(path))!
    results.set(path, sharedPath !== '' ? path.slice(sharedPath.length + 1) : path)
  }

  return results
}