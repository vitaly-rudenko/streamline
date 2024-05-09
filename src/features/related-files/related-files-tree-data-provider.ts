import * as vscode from 'vscode'
import * as path from 'path'
import { LRUCache } from 'lru-cache'
import { isMultiRootWorkspace } from '../../utils/is-multi-root-workspace'
import { getPathQuery } from './get-path-query'

export class RelatedFilesTreeDataProvider implements vscode.TreeDataProvider<RelatedFileTreeItem> {
	private _onDidChangeTreeData = new vscode.EventEmitter<void>()
  onDidChangeTreeData = this._onDidChangeTreeData.event

  private _useRelativePaths = false
  private _cache = new LRUCache<string, RelatedFileTreeItem[]>({
    max: 100,
    ttl: 15 * 60_000, // 15 minutes
  })

  setUseRelativePaths(value: boolean) {
    this._useRelativePaths = value
  }

  refresh(): void {
		this._onDidChangeTreeData.fire()
	}

  clearCacheAndRefresh(): void {
    this._cache.clear()
    this.refresh()
  }

  getTreeItem(element: RelatedFileTreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element
  }

  async getChildren(element?: unknown): Promise<(RelatedFileTreeItem)[] | undefined> {
    if (element) return

    const originalUri = vscode.window.activeTextEditor?.document.uri
    if (!originalUri) return

    const cache = this._cache.get(originalUri.path)
    if (cache) return cache

    const workspaceFolder = isMultiRootWorkspace() ? vscode.workspace.getWorkspaceFolder(originalUri) : undefined

    const bestPathQuery = getPathQuery(originalUri.path, { includeSingleFolder: true })
    const bestInclude = workspaceFolder ? new vscode.RelativePattern(workspaceFolder.uri, `**/${bestPathQuery}*`) : `**/${bestPathQuery}*`

    const worstPathQuery = getPathQuery(originalUri.path, { includeSingleFolder: false })
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
    ignoredPaths.add(originalUri.path) // Ignore current file

    const children: RelatedFileTreeItem[] = []

    for (const relatedUri of bestFilesWithoutExcludes) {
      if (ignoredPaths.has(relatedUri.path)) continue
      ignoredPaths.add(relatedUri.path)
      children.push(this.createRelatedFileTreeItem(originalUri, relatedUri, true))
    }
    for (const relatedUri of worstFilesWithoutExcludes) {
      if (ignoredPaths.has(relatedUri.path)) continue
      ignoredPaths.add(relatedUri.path)
      children.push(this.createRelatedFileTreeItem(originalUri, relatedUri))
    }

    this._cache.set(originalUri.path, children)
    return children
  }

  createRelatedFileTreeItem(originalUri: vscode.Uri, relatedUri: vscode.Uri, isBestMatch?: boolean) {
    return new RelatedFileTreeItem(
      this._useRelativePaths
        ? path.relative(originalUri.path, relatedUri.path)
        : vscode.workspace.asRelativePath(relatedUri),
      relatedUri,
      isBestMatch,
    )
  }
}

class RelatedFileTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly uri: vscode.Uri,
    public readonly isBestMatch?: boolean,
  ) {
    super(label, vscode.TreeItemCollapsibleState.None)
    this.iconPath = isBestMatch ? new vscode.ThemeIcon('star-full') : undefined
    this.resourceUri = uri
    this.command = {
      command: 'vscode.open',
      arguments: [uri],
      title: 'Open file'
    }
  }
}
