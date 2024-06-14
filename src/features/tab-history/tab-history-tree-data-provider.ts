import * as vscode from 'vscode'
import { formatDistance } from 'date-fns'
import type { TabHistoryStorage } from './tab-history-storage'
import { formatPaths } from '../../utils/format-paths'
import type { TabHistoryConfig } from './tab-history-config'

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

    const now = new Date()
    const children: (TabTreeItem | SectionTreeItem)[] = []

    const tabs = this.tabHistoryStorage.list()
    const remainingTabsMap = new Map(tabs.map(tab => [tab.path, tab]))

    const formattedPaths = formatPaths([...this.config.getPinnedPaths(), ...tabs.map(tab => tab.path)])

    // Pinned tabs

    if (this.config.getPinnedPaths().length > 0) {
      children.push(new SectionTreeItem('Pinned', new vscode.ThemeIcon('pinned')))
    }

    for (const path of this.config.getPinnedPaths().sort()) {
      const formattedPath = formattedPaths.get(path)!
      const tab = remainingTabsMap.get(path)

      children.push(
        new TabTreeItem(
          formattedPath,
          tab ? formatDistance(tab.openedAt, now, { addSuffix: true }) : undefined,
          vscode.Uri.file(path),
          true
        )
      )

      remainingTabsMap.delete(path)
    }

    // Other tabs

    if (tabs.length > 0) {
      children.push(new SectionTreeItem('Recently opened', new vscode.ThemeIcon('history'), 'recentlyOpened'))
    }

    for (const tab of tabs) {
      const formattedPath = formattedPaths.get(tab.path)!
      if (!remainingTabsMap.has(tab.path)) continue

      children.push(
        new TabTreeItem(
          formattedPath,
          formatDistance(tab.openedAt, now, { addSuffix: true }),
          vscode.Uri.file(tab.path),
          false,
        )
      )
    }

    return children
  }
}

export class SectionTreeItem extends vscode.TreeItem {
  constructor(label: string, icon: vscode.ThemeIcon, contextValue?: string) {
    super(label, vscode.TreeItemCollapsibleState.None)
    this.iconPath = icon
    this.contextValue = contextValue
  }
}

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
