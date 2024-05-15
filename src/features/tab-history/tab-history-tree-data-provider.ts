import * as vscode from 'vscode'
import type { LRUCache } from 'lru-cache'
import { formatDistance } from 'date-fns'
import type { Tab } from './types'

export class TabHistoryTreeDataProvider implements vscode.TreeDataProvider<TabTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>()
  onDidChangeTreeData = this._onDidChangeTreeData.event

  constructor(private readonly cache: LRUCache<string, Tab>) {}

  refresh(): void {
    this._onDidChangeTreeData.fire()
  }

  getTreeItem(element: TabTreeItem) {
    return element
  }

  async getChildren(element?: TabTreeItem | undefined): Promise<TabTreeItem[] | undefined> {
    if (element) return undefined

    const now = new Date()

    const tabs = [...this.cache.values()].sort((a, b) => b.openedAt - a.openedAt)
    const children: TabTreeItem[] = []

    for (const tab of tabs) {
      const uri = vscode.Uri.file(tab.path)
      children.push(
        new TabTreeItem(
          `${vscode.workspace.asRelativePath(uri)} – ${formatDistance(tab.openedAt, now, { addSuffix: true })}`,
          uri
        )
      )
    }

    return children
  }
}

export class TabTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly uri: vscode.Uri,
  ) {
    super(label, vscode.TreeItemCollapsibleState.None)
    this.resourceUri = uri
    this.contextValue = 'tab'
    this.command = {
      command: 'vscode.open',
      arguments: [uri],
      title: 'Open file'
    }
  }
}
