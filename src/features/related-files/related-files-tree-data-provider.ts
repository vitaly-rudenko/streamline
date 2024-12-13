import * as vscode from 'vscode'
import { LRUCache } from 'lru-cache'
import { isMultiRootWorkspace } from '../../utils/is-multi-root-workspace'
import { getRelatedFilesQueries } from './get-related-files-queries'
import type { RelatedFilesConfig } from './related-files-config'
import { formatPaths } from '../../utils/format-paths'
import { collapseString } from '../../utils/collapse-string'
import { getSmartBasename } from './get-smart-basename'

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
    const relativePath = vscode.workspace.asRelativePath(currentUri, false)
    const currentBasename = getSmartBasename(relativePath, this.config.getExcludedSuffixes())

    const relatedFilesQueries = getRelatedFilesQueries(relativePath, this.config.getExcludedSuffixes())
    const includes = workspaceFolder
      ? relatedFilesQueries.map(query => new vscode.RelativePattern(workspaceFolder.uri, query))
      : [...relatedFilesQueries]

    // TODO: Use findFiles2() when API is stable
    //       See https://github.com/microsoft/vscode/pull/203844
    // TODO: Exclude files from search.exclude and files.exclude configurations
    const excludePattern = this._generateExcludePattern()
    const matchedUrisPerQuery = (
      await Promise.all(
        includes.map(include => vscode.workspace.findFiles(include, excludePattern, 10))
      )
    ).map(uris => {
      // Sort files by name to stabilize list order
      uris.sort((a, b) => a.path.localeCompare(b.path))

      // Sort files by basename equality
      uris.sort((a, b) => {
        const basenameA = getSmartBasename(a.path, this.config.getExcludedSuffixes())
        const basenameB = getSmartBasename(b.path, this.config.getExcludedSuffixes())
        if (basenameA === currentBasename && basenameB !== currentBasename) return -1
        if (basenameA !== currentBasename && basenameB === currentBasename) return 1
        return 0
      })

      return uris
    })

    const children: RelatedFileTreeItem[] = []
    const ignoredPaths = new Set([currentUri.path])

    const uris = matchedUrisPerQuery.flat()
    const pathLabels: Map<string, string> = new Map(
      uris.map((uri) => [uri.path, vscode.workspace.asRelativePath(uri, false)])
    )

    const formattedPaths = formatPaths([...pathLabels.values()])
    for (const [path, label] of pathLabels) {
      pathLabels.set(path, formattedPaths.get(label)!)
    }

    // Treat first query in special way, primarily "star" the related file if basename is the same
    for (const uri of matchedUrisPerQuery[0]) {
      if (ignoredPaths.has(uri.path)) continue
      ignoredPaths.add(uri.path)
      const label = collapseString(pathLabels.get(uri.path)!, currentBasename, this.config.getMaxLabelLength(), this.config.getCollapsedIndicator())
      children.push(new RelatedFileTreeItem(label, uri, getSmartBasename(uri.path, this.config.getExcludedSuffixes()) === currentBasename))
    }

    for (const uri of matchedUrisPerQuery.slice(1).flat()) {
      if (ignoredPaths.has(uri.path)) continue
      ignoredPaths.add(uri.path)
      const label = collapseString(pathLabels.get(uri.path)!, currentBasename, this.config.getMaxLabelLength(), this.config.getCollapsedIndicator())
      children.push(new RelatedFileTreeItem(label, uri, false))
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

const bestMatchThemeIcon = new vscode.ThemeIcon('star-full')
export class RelatedFileTreeItem extends vscode.TreeItem {
  constructor(label: string, uri: vscode.Uri, isBestMatch?: boolean) {
    super(label, vscode.TreeItemCollapsibleState.None)
    this.iconPath = isBestMatch ? bestMatchThemeIcon : undefined
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
