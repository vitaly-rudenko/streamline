import * as vscode from 'vscode'
import { formatPaths } from '../../utils/format-paths'
import { NavigatorWorkspaceState } from './navigator-workspace-state'
import { NavigatorRecord } from './common'

const activeThemeIcon = new vscode.ThemeIcon('circle-filled')
const inactiveThemeIcon = new vscode.ThemeIcon('circle-outline')

export class NavigatorTreeDataProvider implements vscode.TreeDataProvider<NavigatorRecordItem> {
	private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>()
  onDidChangeTreeData = this._onDidChangeTreeData.event

  constructor(
    private readonly workspaceState: NavigatorWorkspaceState,
  ) {}

  refresh() {
		this._onDidChangeTreeData.fire()
  }

  getTreeItem(element: NavigatorRecordItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element
  }

  async getChildren(element?: NavigatorRecordItem): Promise<NavigatorRecordItem[] | undefined> {
    if (element) return undefined

    const index = this.workspaceState.getIndex()
    const navigatorRecords = this.workspaceState.getNavigatorRecords()
    const formattedPaths = formatPaths(navigatorRecords.map(record => record.uri.path))

    return navigatorRecords
      .map((record, i) => new NavigatorRecordItem(formattedPaths.get(record.uri.path)!, i <= index, record, i))
      .reverse()
  }
}

export class NavigatorRecordItem extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly isActive: boolean,
    public readonly navigatorRecord: NavigatorRecord,
    public readonly index: number,
  ) {
    super(label)
    this.description = `${navigatorRecord.selection.start.line + 1}: ${navigatorRecord.value}`
    this.tooltip = vscode.workspace.asRelativePath(navigatorRecord.uri.path)
    this.iconPath = isActive ? activeThemeIcon : inactiveThemeIcon
    this.contextValue = 'record'
    this.command = {
      command: 'streamline.navigator.jumpToRecord',
      arguments: [{ index }],
      title: 'Jump to Record',
    }
  }
}
