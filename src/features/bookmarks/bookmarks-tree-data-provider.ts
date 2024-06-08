import * as vscode from 'vscode'
import { formatPaths } from '../../utils/format-paths'
import { unique } from '../../utils/unique'
import { getFilename } from '../../utils/get-filename'
import type { BookmarksConfig } from './bookmarks-config'
import type { Bookmark } from './types'

type TreeItem = ListTreeItem | FolderTreeItem | FileTreeItem | SelectionTreeItem

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
      return unique(this.config.getBookmarks().map(bookmark => bookmark.list))
        .sort()
        .map(list => new ListTreeItem(list, this.config.getCurrentList() === list))
    }

    const listBookmarks = this.config.getBookmarks().filter(bookmark => bookmark.list === element.list)

    if (element instanceof FileTreeItem) {
      const bookmarks = listBookmarks.filter(
        (bookmark): bookmark is Extract<Bookmark, { type: 'selection' }> => bookmark.type === 'selection' && bookmark.uri.path === element.uri.path
      )

      return bookmarks
        .sort((a, b) => a.selection.start.line - b.selection.start.line)
        .map(bookmark => new SelectionTreeItem(
          bookmark.selection.isSingleLine
            ? `${bookmark.selection.start.line + 1}: ${bookmark.preview}`
            : `${bookmark.selection.start.line + 1}-${bookmark.selection.end.line + 1}: ${bookmark.preview}`,
          bookmark.list,
          bookmark.uri,
          bookmark.selection,
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
          : new FileTreeItem(isRealFile ? label : `[${label}]`, element.list, uri, hasChildren)
      )
    }

    return children
  }
}

export class ListTreeItem extends vscode.TreeItem {
  constructor(public readonly list: string, isCurrentList: boolean) {
    super(list, vscode.TreeItemCollapsibleState.Expanded)

    this.iconPath = isCurrentList ? new vscode.ThemeIcon('folder-active') : new vscode.ThemeIcon('folder')
    this.contextValue = 'list'
  }
}

export class FolderTreeItem extends vscode.TreeItem {
  constructor(public readonly label: string, public readonly list: string, public readonly uri: vscode.Uri, hasChildren: boolean) {
    super(label, hasChildren ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None)

    this.iconPath = vscode.ThemeIcon.Folder
    this.resourceUri = uri
    this.contextValue = 'folder'
  }
}

export class FileTreeItem extends vscode.TreeItem {
  constructor(public readonly label: string, public readonly list: string, public readonly uri: vscode.Uri, hasChildren: boolean) {
    super(label, hasChildren ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None)

    this.iconPath = vscode.ThemeIcon.File
    this.resourceUri = uri
    this.contextValue = 'file'
    this.command = {
      command: 'vscode.open',
      arguments: [uri],
      title: 'Open file'
    }
  }
}

export class SelectionTreeItem extends vscode.TreeItem {
  constructor(public readonly label: string, public readonly list: string, public readonly uri: vscode.Uri, public readonly selection: vscode.Selection) {
    super(label, vscode.TreeItemCollapsibleState.None)

    this.contextValue = 'selection'
    this.command = {
      command: 'vscode.open',
      arguments: [uri, { selection }],
      title: selection.isEmpty ? 'Go to line' : 'Go to selection'
    }
  }
}
