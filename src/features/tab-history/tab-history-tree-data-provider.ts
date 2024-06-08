import * as vscode from 'vscode'
import { formatDistance } from 'date-fns'
import type { TabHistoryStorage } from './tab-history-storage'
import { formatPaths } from '../../utils/format-paths'
import type { TabHistoryConfig } from './tab-history-config'

export class TabHistoryTreeDataProvider implements vscode.TreeDataProvider<TabTreeItem> {
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

  async getChildren(element?: TabTreeItem | undefined): Promise<TabTreeItem[] | undefined> {
    if (element) return undefined

    const now = new Date()
    const children: TabTreeItem[] = []

    const tabs = this.tabHistoryStorage.list()
      .sort((a, b) => {
        const aPinned = this.config.getCachedPinnedPathsSet().has(a.path)
        const bPinned = this.config.getCachedPinnedPathsSet().has(b.path)

        if (aPinned && !bPinned) return -1
        if (!aPinned && bPinned) return 1

        return 0
      })

    const formattedPaths = formatPaths(tabs.map(tab => tab.path))
    for (const tab of tabs) {
      const formattedPath = formattedPaths.get(tab.path)!
      children.push(
        new TabTreeItem(
          formattedPath,
          formatDistance(tab.openedAt, now, { addSuffix: true }),
          vscode.Uri.file(tab.path),
          this.config.getCachedPinnedPathsSet().has(tab.path),
        )
      )
    }

    return children
  }
}

export class TabTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly date: string,
    public readonly uri: vscode.Uri,
    public readonly isPinned: boolean = false
  ) {
    super(label, vscode.TreeItemCollapsibleState.None)
    this.resourceUri = uri
    this.contextValue = isPinned ? 'pinnedTab' : 'tab'
    this.description = isPinned ? `pinned – ${date}` : date
    this.command = {
      command: 'vscode.open',
      arguments: [uri],
      title: 'Open file'
    }
  }
}
