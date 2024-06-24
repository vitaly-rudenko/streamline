import * as vscode from 'vscode'
import type { TabHistoryStorage } from './tab-history-storage'
import { formatPaths } from '../../utils/format-paths'
import type { TabHistoryConfig } from './tab-history-config'

export class SectionTreeItem extends vscode.TreeItem {
  constructor(label: string, icon: vscode.ThemeIcon, contextValue?: string) {
    super(label, vscode.TreeItemCollapsibleState.None)
    this.iconPath = icon
    this.contextValue = contextValue
  }
}

const pinnedTreeItem = new SectionTreeItem('Pinned', new vscode.ThemeIcon('pinned'))
const recentlyOpenedTreeItem = new SectionTreeItem('Recently opened', new vscode.ThemeIcon('history'), 'recentlyOpened')

export class TabTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    date: string | undefined,
    public readonly uri: vscode.Uri,
    isPinned: boolean
  ) {
    super(label, vscode.TreeItemCollapsibleState.None)
    this.resourceUri = uri
    this.contextValue = isPinned ? 'pinnedTab' : 'tab'
    this.description = date

    this.command = {
      command: 'vscode.open',
      arguments: [uri],
      title: 'Open file'
    }
  }
}

export class TabHistoryTreeDataProvider implements vscode.TreeDataProvider<TabTreeItem | SectionTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>()
  onDidChangeTreeData = this._onDidChangeTreeData.event

  constructor(
    private readonly tabHistoryStorage: TabHistoryStorage,
    private readonly config: TabHistoryConfig,
  ) {}

  refresh(): void {
    this._onDidChangeTreeData.fire()
  }

  getTreeItem(element: TabTreeItem) {
    return element
  }

  async getChildren(element?: TabTreeItem | SectionTreeItem | undefined): Promise<(TabTreeItem | SectionTreeItem)[] | undefined> {
    if (element) return undefined

    const now = Date.now()
    const children: (TabTreeItem | SectionTreeItem)[] = []

    const tabs = this.tabHistoryStorage.list()
    const remainingTabsMap = new Map(tabs.map(tab => [tab.path, tab]))

    const formattedPaths = formatPaths([...this.config.getPinnedPaths(), ...tabs.map(tab => tab.path)])

    // Pinned tabs

    if (this.config.getPinnedPaths().length > 0) {
      children.push(pinnedTreeItem)
    }

    for (const path of this.config.getPinnedPaths().sort()) {
      const formattedPath = formattedPaths.get(path)!
      const tab = remainingTabsMap.get(path)

      children.push(
        new TabTreeItem(
          formattedPath,
          tab ? fastFormatRelativeDate(tab.openedAt, now) : undefined,
          vscode.Uri.file(path),
          true
        )
      )

      remainingTabsMap.delete(path)
    }

    // Other tabs

    if (remainingTabsMap.size > 0) {
      children.push(recentlyOpenedTreeItem)
    }

    for (const tab of tabs) {
      const formattedPath = formattedPaths.get(tab.path)!
      if (!remainingTabsMap.has(tab.path)) continue

      children.push(
        new TabTreeItem(
          formattedPath,
          fastFormatRelativeDate(tab.openedAt, now),
          vscode.Uri.file(tab.path),
          false,
        )
      )
    }

    return children
  }
}

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

const TWO_MINUTE_MS = 2 * MINUTE_MS
const TWO_HOUR_MS = 2 * HOUR_MS
const TWO_DAY_MS = 2 * DAY_MS

function fastFormatRelativeDate(from: number, to: number) {
  const ms = to - from
  if (ms < MINUTE_MS) return 'just now'
  if (ms < TWO_MINUTE_MS) return 'a minute ago'
  if (ms < HOUR_MS) return `${Math.floor(ms / MINUTE_MS)} minutes ago`
  if (ms < TWO_HOUR_MS) return 'an hour ago'
  if (ms < DAY_MS) return `${Math.floor(ms / HOUR_MS)} hours ago`
  if (ms < TWO_DAY_MS) return 'a day ago'
  return `${Math.floor(ms / TWO_DAY_MS)} days ago`
}
