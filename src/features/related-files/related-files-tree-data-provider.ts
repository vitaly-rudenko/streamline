import * as vscode from 'vscode'
import * as path from 'path'
import { LRUCache } from 'lru-cache'
import { isMultiRootWorkspace } from '../../utils/is-multi-root-workspace'
import { getBasename } from '../../utils/get-basename'
import { getRelatedFilesQueries } from './get-related-files-queries'
import type { RelatedFilesConfig } from './related-files-config'
import { formatPaths } from '../../utils/format-paths'

export class RelatedFilesTreeDataProvider implements vscode.TreeDataProvider<RelatedFileTreeItem | WorkspaceFolderTreeItem> {
	private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>()
  onDidChangeTreeData = this._onDidChangeTreeData.event

  private readonly _cache = new LRUCache<string, (RelatedFileTreeItem | WorkspaceFolderTreeItem)[]>({ max: 100 })

  constructor(private readonly config: RelatedFilesConfig) {}

  refresh(): void {
		this._onDidChangeTreeData.fire()
	}

  clearCacheAndRefresh(): void {
    this._cache.clear()
    this.refresh()
  }

  getTreeItem(element: RelatedFileTreeItem | WorkspaceFolderTreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element
  }

  async getChildren(element?: WorkspaceFolderTreeItem | RelatedFileTreeItem): Promise<(RelatedFileTreeItem | WorkspaceFolderTreeItem)[] | undefined> {
    const currentUri = vscode.window.activeTextEditor?.document.uri
    if (!currentUri) return

    if (element instanceof WorkspaceFolderTreeItem) {
      return element.children
    }

    if (element) return

    const cache = this._cache.get(currentUri.path)
    if (cache) return cache

    let children: (WorkspaceFolderTreeItem | RelatedFileTreeItem)[] = []

    const currentUriWorkspaceFolder = vscode.workspace.getWorkspaceFolder(currentUri)
    if (isMultiRootWorkspace() && this.config.getUseGlobalSearch()) {
      const sortedWorkspaceFolders = [
        currentUriWorkspaceFolder,
        ...(vscode.workspace.workspaceFolders ?? [])
          .filter(workspaceFolder => workspaceFolder.name !== currentUriWorkspaceFolder?.name)
          .sort((a, b) => a.index - b.index),
      ]
        .filter(isDefined)
        .filter((workspaceFolder) => (
          workspaceFolder.name === currentUriWorkspaceFolder?.name ||
          !this.config.getHiddenWorkspaceFoldersInGlobalSearch().includes(workspaceFolder.name)
        ))

      const workspaceFolderChildrenList = await Promise.all(
        sortedWorkspaceFolders.map(async (workspaceFolder) => [
          workspaceFolder,
          await this._getRelatedFilesChildren(currentUri, workspaceFolder)
        ] as const)
      )

      children = workspaceFolderChildrenList
        .filter(([_workspaceFolder, children]) => children.length > 0)
        .map(([workspaceFolder, children]) => new WorkspaceFolderTreeItem(workspaceFolder, children))
    } else {
      children = await this._getRelatedFilesChildren(currentUri, currentUriWorkspaceFolder)
    }

    this._cache.set(currentUri.path, children)
    return children
  }

  private async _getRelatedFilesChildren(currentUri: vscode.Uri, workspaceFolder?: vscode.WorkspaceFolder): Promise<RelatedFileTreeItem[]> {
    const currentBasename = getBasename(currentUri.path)

    const relatedFilesQueries = getRelatedFilesQueries(currentUri.path)
    const bestInclude = workspaceFolder ? new vscode.RelativePattern(workspaceFolder.uri, relatedFilesQueries.best) : relatedFilesQueries.best
    const worstInclude = workspaceFolder ? new vscode.RelativePattern(workspaceFolder.uri, relatedFilesQueries.worst) : relatedFilesQueries.worst

    // TODO: Use findFiles2() when API is stable
    //       See https://github.com/microsoft/vscode/pull/203844
    // TODO: Exclude files from search.exclude and files.exclude configurations
    const excludePattern = this._generateExcludePattern()
    const [bestMatchedUris, worstMatchedUris] = (
      await Promise.all([
        vscode.workspace.findFiles(bestInclude, excludePattern, 10),
        vscode.workspace.findFiles(worstInclude, excludePattern, 10),
      ])
    ).map(uris => {
      // Sort files by name to stabilize list order
      uris.sort((a, b) => a.path.localeCompare(b.path))

      // Sort files by distance
      if (this.config.getViewRenderMode() === 'relative') {
        uris.sort((a, b) => a.path.split('/').length - b.path.split('/').length)
      }

      // Sort files by basename equality
      uris.sort((a, b) => {
        const basenameA = getBasename(a.path)
        const basenameB = getBasename(b.path)
        if (basenameA === currentBasename && basenameB !== currentBasename) return -1
        if (basenameA !== currentBasename && basenameB === currentBasename) return 1
        return 0
      })

      return uris
    })

    const children: RelatedFileTreeItem[] = []
    const ignoredPaths = new Set([currentUri.path])

    const uris = [...bestMatchedUris, ...worstMatchedUris]
    let pathLabels: Map<string, string>

    if (this.config.getViewRenderMode() === 'relative') {
      pathLabels = new Map(
        uris.map((uri) => {
          const label = path.relative(currentUri.path, uri.path).replace('../', '')
          return [uri.path, label.startsWith('../') ? label : ('./' + label)]
        })
      )
    } else {
      pathLabels = new Map(
        uris.map((uri) => [uri.path, vscode.workspace.asRelativePath(uri, false)])
      )

      if (this.config.getViewRenderMode() === 'compact') {
        const formattedPaths = formatPaths([...pathLabels.values()])
        for (const [path, label] of pathLabels) {
          pathLabels.set(path, formattedPaths.get(label)!)
        }
      }
    }

    for (const uri of bestMatchedUris) {
      if (ignoredPaths.has(uri.path)) continue
      ignoredPaths.add(uri.path)
      children.push(new RelatedFileTreeItem(pathLabels.get(uri.path)!, uri, getBasename(uri.path) === currentBasename))
    }

    for (const uri of worstMatchedUris) {
      if (ignoredPaths.has(uri.path)) continue
      ignoredPaths.add(uri.path)
      children.push(new RelatedFileTreeItem(pathLabels.get(uri.path)!, uri, false))
    }

    return children
  }

  // TODO: Does not belong here? Also we do not need to regenerate it every time.
  private _generateExcludePattern() {
    const searchExcludes = vscode.workspace.getConfiguration('search').get<Record<string, unknown>>('exclude')
    const excludeEntries = Object.entries({ ...searchExcludes, ...this.config.getCustomExcludes() })

    return excludeEntries.length > 0
      ? `{${excludeEntries.filter(([_, value]) => value === true).map(([key]) => key).join(',')}}`
      : undefined
  }
}

export class WorkspaceFolderTreeItem extends vscode.TreeItem {
  constructor(public readonly workspaceFolder: vscode.WorkspaceFolder, public readonly children: RelatedFileTreeItem[]) {
    super(workspaceFolder.name, vscode.TreeItemCollapsibleState.Expanded)
    this.contextValue = 'workspaceFolder'
  }
}

export class RelatedFileTreeItem extends vscode.TreeItem {
  constructor(label: string, uri: vscode.Uri, isBestMatch?: boolean) {
    super(label, vscode.TreeItemCollapsibleState.None)
    this.iconPath = isBestMatch ? new vscode.ThemeIcon('star-full') : undefined
    this.resourceUri = uri
    this.contextValue = 'relatedFile'
    this.command = {
      command: 'vscode.open',
      arguments: [uri],
      title: 'Open file'
    }
  }
}

function isDefined<T>(i: T | undefined): i is T {
  return i !== undefined
}
