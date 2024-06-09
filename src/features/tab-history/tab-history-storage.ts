import type { Tab } from './types'

// TODO: refactor & simplify this class
export class TabHistoryStorage {
  private tabs: Tab[] = []

  constructor(private readonly memorySize: number) {}

  import(backup: Record<string, number>) {
    const tabsToImport = Object.entries(backup)
      .map(([path, openedAt]) => ({ path, openedAt }))
      .sort((a, b) => b.openedAt - a.openedAt)

    const existingPaths = new Set<string>(this.tabs.map(tab => tab.path))
    for (const tab of tabsToImport) {
      if (existingPaths.has(tab.path)) continue
      this.tabs.push(tab)
    }

    this.sort()
    this.tabs = this.tabs.slice(0, this.memorySize)
  }

  export(backupSize: number): Record<string, number> {
    return [...this.tabs]
      .sort((a, b) => b.openedAt - a.openedAt)
      .slice(0, backupSize)
      .reduce<Record<string, number>>((acc, tab) => {
        acc[tab.path] = tab.openedAt
        return acc
      }, {})
  }

  put(tab: Tab): boolean {
    const index = this.tabs.findIndex(t => t.path === tab.path)

    if (index !== -1) {
      this.tabs[index] = tab
      return false
    }

    this.tabs.unshift(tab)
    if (this.tabs.length > this.memorySize) {
      const oldestTabIndex = this.tabs.reduce((oldestIndex, tab, tabIndex) => tab.openedAt < this.tabs[oldestIndex].openedAt ? tabIndex : oldestIndex, 0)
      this.tabs.splice(oldestTabIndex, 1)
    }

    return true
  }

  sort() {
    this.tabs.sort((a, b) => b.openedAt - a.openedAt)
  }

  clear() {
    this.tabs = []
  }

  list() {
    return [...this.tabs]
  }
}
