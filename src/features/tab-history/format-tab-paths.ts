import { getSharedPath } from './get-shared-path'
import type { Tab } from './types'

export function formatTabPaths(tabs: Tab[]): [Tab, string][] {
  const filenamePaths = new Map<string, string[]>()
  for (const tab of tabs) {
    const filename = tab.path.split('/').at(-1)!
    filenamePaths.set(filename, filenamePaths.has(filename) ? filenamePaths.get(filename)!.concat(tab.path) : [tab.path])
  }

  const filenameSharedPaths = new Map<string, string>()
  for (const [filename, paths] of filenamePaths.entries()) {
    filenameSharedPaths.set(filename, getSharedPath(paths))
  }

  const tabsWithFormattedPaths: [Tab, string][] = []
  for (const tab of tabs) {
    const filename = tab.path.split('/').at(-1)!
    const sharedPath = filenameSharedPaths.get(filename)!
    tabsWithFormattedPaths.push([tab, tab.path.replace(sharedPath + '/', '')])
  }

  return tabsWithFormattedPaths
}