import * as vscode from 'vscode'
import { formatRecord, Record } from './navigator-feature'
import { basename } from 'path'
import { formatPaths } from '../../utils/format-paths'

export class RecordItem extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly record: Record,
    public readonly index: number,
    public readonly isCurrent: boolean,
    icon: vscode.ThemeIcon
  ) {
    super(label)
    this.description = record.value
    this.contextValue = 'record'
    this.iconPath = icon
    this.command = {
      command: 'streamline.navigator.goToIndex',
      arguments: [index],
      title: 'Go to...',
    }
  }
}

export class NavigatorTreeDataProvider implements vscode.TreeDataProvider<RecordItem> {
	private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>()
  onDidChangeTreeData = this._onDidChangeTreeData.event

  public records: Record[] = []
  public index: number = -1

  refresh() {
		this._onDidChangeTreeData.fire()
  }

  getTreeItem(element: RecordItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element
  }

  async getChildren(element?: RecordItem): Promise<RecordItem[] | undefined> {
    if (element) return undefined

    const formattedPaths = formatPaths(this.records.map(record => record.uri.path))

    return this.records
      .map((record, i, records) => {
        return new RecordItem(
          `${record.selection.start.line + 1}: ${formattedPaths.get(record.uri.path)!}`,
          record,
          i,
          i === this.index,
          i === 0 || records[i - 1].uri.path !== record.uri.path
            ? i <= this.index ? new vscode.ThemeIcon('circle-large-filled') : new vscode.ThemeIcon('circle-large-outline')
            : i <= this.index ? new vscode.ThemeIcon('circle-filled') : new vscode.ThemeIcon('circle-outline')
        )
      })
      .reverse()
  }
}
