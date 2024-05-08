import * as vscode from 'vscode'
import { isMultiRootWorkspace } from '../../utils/is-multi-root-workspace'
import { getPathQuery } from './get-path-query'

export class RelatedFilesTreeDataProvider implements vscode.TreeDataProvider<RelatedFileTreeItem> {
	private _onDidChangeTreeData = new vscode.EventEmitter<void>()
  onDidChangeTreeData = this._onDidChangeTreeData.event

  refresh(): void {
		this._onDidChangeTreeData.fire()
	}

  getTreeItem(element: RelatedFileTreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element
  }

  async getChildren(element?: unknown): Promise<(RelatedFileTreeItem)[] | undefined> {
    if (element) return

    const uri = vscode.window.activeTextEditor?.document.uri
    if (!uri) return

    const workspaceFolder = isMultiRootWorkspace() ? vscode.workspace.getWorkspaceFolder(uri) : undefined

    const bestPathQuery = getPathQuery(uri.path, { includeSingleFolder: true })
    const bestInclude = workspaceFolder ? new vscode.RelativePattern(workspaceFolder.uri, `**/${bestPathQuery}*`) : `**/${bestPathQuery}*`

    const worstPathQuery = getPathQuery(uri.path, { includeSingleFolder: false })
    const worstInclude = workspaceFolder ? new vscode.RelativePattern(workspaceFolder.uri, `**/${worstPathQuery}*`) : `**/${worstPathQuery}*`

    // TODO: Use findFiles2() when API is stable
    //       See https://github.com/microsoft/vscode/pull/203844
    const [
      bestFilesWithoutExcludes,
      worstFilesWithoutExcludes,
    ] = (await Promise.all([
      vscode.workspace.findFiles(bestInclude, undefined, 10),
      vscode.workspace.findFiles(worstInclude, undefined, 10),
    ])).map(uris => uris.sort((a, b) => a.path.length - b.path.length))

    const ignoredPaths = new Set()
    ignoredPaths.add(uri.path) // Ignore current file

    const children: RelatedFileTreeItem[] = []

    for (const uri of bestFilesWithoutExcludes) {
      if (ignoredPaths.has(uri.path)) continue
      ignoredPaths.add(uri.path)
      children.push(new RelatedFileTreeItem(uri, 'best'))
    }
    for (const uri of worstFilesWithoutExcludes) {
      if (ignoredPaths.has(uri.path)) continue
      ignoredPaths.add(uri.path)
      children.push(new RelatedFileTreeItem(uri, 'worst'))
    }

    return children
  }
}

const iconPaths = {
  best: new vscode.ThemeIcon('star-full'),
  good: new vscode.ThemeIcon('star-half'),
  bad: new vscode.ThemeIcon('star-empty'),
  worst: undefined
}

class RelatedFileTreeItem extends vscode.TreeItem {
  constructor(
    public readonly uri: vscode.Uri,
    public readonly match: 'best' | 'good' | 'bad' | 'worst',
  ) {
    super(vscode.workspace.asRelativePath(uri.path), vscode.TreeItemCollapsibleState.None)
    this.iconPath = iconPaths[match]
  }
}
