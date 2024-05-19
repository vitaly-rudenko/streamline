import { getSharedPath } from './get-shared-path'
import type { Tab } from './types'

export function formatTabPaths(tabs: Tab[]): [Tab, string][] {
  const filePaths = new Map<string, string[]>()
  for (const tab of tabs) {
    const file = tab.path.split('/').at(-1)!
    filePaths.set(file, filePaths.has(file) ? filePaths.get(file)!.concat(tab.path) : [tab.path])
  }

  const fileSharedPaths = new Map<string, string>()
  for (const [file, paths] of filePaths.entries()) {
    fileSharedPaths.set(file, getSharedPath(paths))
  }

  const tabsWithFormattedPaths: [Tab, string][] = []
  for (const tab of tabs) {
    const file = tab.path.split('/').at(-1)!
    const sharedPath = fileSharedPaths.get(file)!
    tabsWithFormattedPaths.push([tab, tab.path.replace(sharedPath + '/', '')])
  }

  return tabsWithFormattedPaths
}