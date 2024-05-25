import * as vscode from 'vscode'
import type { Bookmark } from './bookmarks-feature'
import { formatPaths } from './format-paths'
import { unique } from '../../utils/unique'

// TODO: group by file, group by folder
// TODO: what to do with outdated bookmarks?
// TODO: bookmark labels
export class BookmarksTreeDataProvider implements vscode.TreeDataProvider<ListTreeItem | FolderTreeItem | FileTreeItem | SelectionTreeItem> {
	private _onDidChangeTreeData = new vscode.EventEmitter<void>()
  onDidChangeTreeData = this._onDidChangeTreeData.event

  private _bookmarks: Bookmark[] = []
  setBookmarks(bookmarks: Bookmark[]) {
    this._bookmarks = bookmarks
  }

  refresh(): void {
		this._onDidChangeTreeData.fire()
  }

  getTreeItem(element: FolderTreeItem | FileTreeItem | SelectionTreeItem) {
    return element
  }

  async getChildren(element?: ListTreeItem | FolderTreeItem | FileTreeItem | SelectionTreeItem): Promise<(ListTreeItem | FolderTreeItem | FileTreeItem | SelectionTreeItem)[] | undefined> {
    if (element === undefined) {
      return unique(this._bookmarks.map(bookmark => bookmark.list))
        .sort()
        .map(list => new ListTreeItem(list))
    }

    if (element instanceof FileTreeItem) {
      const bookmarks = this._bookmarks.filter(
        (bookmark): bookmark is Extract<Bookmark, { type: 'Selection' }> => bookmark.type === 'Selection' && bookmark.uri.path === element.uri.path
      )

      return bookmarks
        .sort((a, b) => a.selection.start.line - b.selection.start.line)
        .map(bookmark => new SelectionTreeItem(
          bookmark.selection.isSingleLine
            ? `${bookmark.selection.start.line + 1}: ${bookmark.preview}`
            : `${bookmark.selection.start.line + 1}-${bookmark.selection.end.line + 1}: ${bookmark.preview}`,
          bookmark.uri,
          bookmark.selection,
        ))
    }

    const nestedBookmarks = element
      ? element instanceof ListTreeItem
        ? this._bookmarks.filter(bookmark => bookmark.list === element.list)
        : this._bookmarks.filter(bookmark => bookmark.uri.path.startsWith(element.uri.path + '/'))
      : [...this._bookmarks]

    const bookmarks = nestedBookmarks.filter(bookmark => nestedBookmarks.every(b => !bookmark.uri.path.startsWith(b.uri.path + '/')))

    const folderUris = bookmarks
      .filter(bookmark => bookmark.type === 'Folder')
      .map(bookmark => bookmark.uri)
      // Sort by filename
      .sort((a, b) => a.path.split('/').at(-1)!.localeCompare(b.path.split('/').at(-1)!))

    const fileUris = bookmarks
      .filter(bookmark => bookmark.type === 'File' || bookmark.type === 'Selection')
      .map(bookmark => bookmark.uri)
      // Sort by filename
      .sort((a, b) => a.path.split('/').at(-1)!.localeCompare(b.path.split('/').at(-1)!))

    // Show folders at the top
    const uris = [...folderUris, ...fileUris]
    const formattedPaths = formatPaths(uris.map(uri => uri.path))

    const ignoredPaths = new Set<string>()
    const children: (FolderTreeItem | FileTreeItem)[] = []

    for (const uri of uris) {
      if (ignoredPaths.has(uri.path)) continue
      ignoredPaths.add(uri.path)

      const isFolder = folderUris.includes(uri)
      const hasChildren = isFolder
        ? this._bookmarks.some(bookmark => bookmark.uri.path.startsWith(uri.path + '/'))
        : this._bookmarks.some(bookmark => bookmark.type === 'Selection' && bookmark.uri.path === uri.path)

      children.push(
        isFolder
          ? new FolderTreeItem(formattedPaths.get(uri.path)!, uri, hasChildren)
          : new FileTreeItem(formattedPaths.get(uri.path)!, uri, hasChildren)
      )
    }

    return children
  }
}

export class ListTreeItem extends vscode.TreeItem {
  constructor(public readonly list: string) {
    super(list, vscode.TreeItemCollapsibleState.Expanded)

    this.iconPath = vscode.ThemeIcon.Folder
    this.contextValue = 'list'
  }
}

export class FolderTreeItem extends vscode.TreeItem {
  constructor(public readonly label: string, public readonly uri: vscode.Uri, hasChildren: boolean) {
    super(label, hasChildren ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None)

    this.iconPath = vscode.ThemeIcon.Folder
    this.resourceUri = uri
    this.contextValue = 'folder'
  }
}

export class FileTreeItem extends vscode.TreeItem {
  constructor(public readonly label: string, public readonly uri: vscode.Uri, hasChildren: boolean) {
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
  constructor(public readonly label: string, public readonly uri: vscode.Uri, selection: vscode.Selection) {
    super(label, vscode.TreeItemCollapsibleState.None)

    this.contextValue = 'selection'
    this.command = {
      command: 'vscode.open',
      arguments: [uri, { selection }],
      title: selection.isEmpty ? 'Go to line' : 'Go to selection'
    }
  }
}
