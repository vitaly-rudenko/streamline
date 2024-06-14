import * as vscode from 'vscode'
import { formatPaths } from '../../utils/format-paths'
import { unique } from '../../utils/unique'
import { getFilename } from '../../utils/get-filename'
import type { BookmarksConfig } from './bookmarks-config'
import type { Bookmark } from './types'
import { stripIndent, stripIndents } from 'common-tags'

type TreeItem = ArchivedListsTreeItem | ListTreeItem | FolderTreeItem | FileTreeItem | SelectionTreeItem

export class BookmarksTreeDataProvider implements vscode.TreeDataProvider<TreeItem> {
	private _onDidChangeTreeData = new vscode.EventEmitter<void>()
  onDidChangeTreeData = this._onDidChangeTreeData.event

  constructor(private readonly config: BookmarksConfig) {}

  refresh(): void {
		this._onDidChangeTreeData.fire()
  }

  getTreeItem(element: FolderTreeItem | FileTreeItem | SelectionTreeItem) {
    return element
  }

  async getChildren(element?: TreeItem): Promise<TreeItem[] | undefined> {
    if (element === undefined) {
      const lists = unique([...this.config.getBookmarks().map(bookmark => bookmark.list), this.config.getCurrentList()])

      const children: TreeItem[] = lists.filter(list => !this.config.getArchivedLists().includes(list))
        .sort()
        .map(list => new ListTreeItem(list, this.config.getCurrentList() === list, false))

      if (this.config.getArchivedLists().length > 0) {
        children.push(new ArchivedListsTreeItem(this.config.getArchivedLists().includes(this.config.getCurrentList())))
      }

      return children
    }

    if (element instanceof ArchivedListsTreeItem) {
      return this.config.getArchivedLists().map(list => new ListTreeItem(list, this.config.getCurrentList() === list, true))
    }

    const listBookmarks = this.config.getBookmarks().filter(bookmark => bookmark.list === element.list)

    if (element instanceof FileTreeItem) {
      const bookmarks = listBookmarks.filter(
        (bookmark): bookmark is Extract<Bookmark, { type: 'selection' }> => bookmark.type === 'selection' && bookmark.uri.path === element.uri.path
      )

      return bookmarks
        .sort((a, b) => a.selection.start.line - b.selection.start.line)
        .map(bookmark => new SelectionTreeItem(
          bookmark.list,
          bookmark.uri,
          bookmark.selection,
          bookmark.value,
          bookmark.note,
        ))
    }

    const nestedBookmarks = element instanceof FolderTreeItem || element instanceof FileTreeItem
      ? listBookmarks.filter(bookmark => bookmark.uri.path.startsWith(element.uri.path + '/'))
      : [...listBookmarks]

    const bookmarks = nestedBookmarks.filter(bookmark => nestedBookmarks.every(b => !bookmark.uri.path.startsWith(b.uri.path + '/')))

    const folderUris = bookmarks
      .filter(bookmark => bookmark.type === 'folder')
      .map(bookmark => bookmark.uri)
      // Sort by filename
      .sort((a, b) => getFilename(a.path).localeCompare(getFilename(b.path)))

    const fileUris = bookmarks
      .filter(bookmark => bookmark.type === 'file' || bookmark.type === 'selection')
      .map(bookmark => bookmark.uri)
      // Sort by filename
      .sort((a, b) => getFilename(a.path).localeCompare(getFilename(b.path)))

    // Show folders at the top
    const uris = [...folderUris, ...fileUris]
    const formattedPaths = formatPaths(uris.map(uri => uri.path))

    const ignoredPaths = new Set<string>()
    const children: (FolderTreeItem | FileTreeItem)[] = []

    for (const uri of uris) {
      if (ignoredPaths.has(uri.path)) continue
      ignoredPaths.add(uri.path)

      const isFolder = folderUris.includes(uri)
      const isRealFile = listBookmarks.some(bookmark => bookmark.type === 'file' && bookmark.uri.path === uri.path)
      const hasChildren = isFolder
        ? listBookmarks.some(bookmark => bookmark.uri.path.startsWith(uri.path + '/'))
        : listBookmarks.some(bookmark => bookmark.type === 'selection' && bookmark.uri.path === uri.path)

      const label = formattedPaths.get(uri.path)!
      children.push(
        isFolder
          ? new FolderTreeItem(label, element.list, uri, hasChildren)
          : new FileTreeItem(label, element.list, uri, hasChildren, isRealFile)
      )
    }

    return children
  }
}

export class ArchivedListsTreeItem extends vscode.TreeItem {
  constructor(includesCurrentList: boolean) {
    super('Archive', includesCurrentList ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed)

    this.iconPath = new vscode.ThemeIcon('archive')
    this.contextValue = 'archivedLists'
  }
}

export class ListTreeItem extends vscode.TreeItem {
  constructor(public readonly list: string, isCurrentList: boolean, isArchived: boolean) {
    super(list, isCurrentList ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed)

    this.iconPath = isCurrentList ? new vscode.ThemeIcon('folder-active') : new vscode.ThemeIcon('folder')
    this.contextValue = isArchived
      ? isCurrentList ? 'archivedActiveList' : 'archivedList'
      : isCurrentList ? 'activeList' : 'list'
  }
}

export class FolderTreeItem extends vscode.TreeItem {
  constructor(label: string, public readonly list: string, public readonly uri: vscode.Uri, hasChildren: boolean) {
    super(label, hasChildren ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None)

    this.iconPath = vscode.ThemeIcon.Folder
    this.resourceUri = uri
    this.contextValue = 'folder'
    this.tooltip = uri.path
  }
}

export class FileTreeItem extends vscode.TreeItem {
  constructor(label: string, public readonly list: string, public readonly uri: vscode.Uri, hasChildren: boolean, isRealFile: boolean) {
    super(
      isRealFile ? label : `[${label}]`,
      hasChildren
        ? isRealFile
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.None
    )

    this.iconPath = vscode.ThemeIcon.File
    this.resourceUri = uri
    this.contextValue = isRealFile ? 'file' : 'virtualFile'
    this.tooltip = uri.path
    this.command = {
      command: 'vscode.open',
      arguments: [uri],
      title: 'Open file'
    }
  }
}

export class SelectionTreeItem extends vscode.TreeItem {
  constructor(public readonly list: string, public readonly uri: vscode.Uri, public readonly selection: vscode.Selection, value: string, note?: string) {
    super(note ?? formatSelectionValue(selection, value), vscode.TreeItemCollapsibleState.None)

    this.description = note ? formatSelectionValue(selection, value) : undefined
    this.contextValue = 'selection'
    this.tooltip = `${note ? `${note}\n\n` : ''}${stripIndent(value)}\n\n${uri.path}`
    this.iconPath = note ? new vscode.ThemeIcon('note') : new vscode.ThemeIcon('selection')
    this.command = {
      command: 'vscode.open',
      arguments: [uri, { selection }],
      title: selection.isEmpty ? 'Go to line' : 'Go to selection'
    }
  }
}

function formatSelectionValue(selection: vscode.Selection, value: string) {
  return selection.isSingleLine
    ? `${selection.start.line + 1}: ${stripIndents(value)}`
    : `${selection.start.line + 1}-${selection.end.line + 1}: ${stripIndents(value)}`
}
