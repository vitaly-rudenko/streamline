import * as vscode from 'vscode'
import { formatPaths } from '../../utils/format-paths'
import { getFilename } from '../../utils/get-filename'
import type { BookmarksConfig } from './bookmarks-config'
import type { Bookmark } from './types'
import { stripIndent, stripIndents } from 'common-tags'

type TreeItem = ArchivedListsTreeItem | ListTreeItem | FolderTreeItem | FileTreeItem | SelectionTreeItem

export class ArchivedListsTreeItem extends vscode.TreeItem {
  constructor(expanded: boolean) {
    super('Archive', expanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed)

    this.iconPath = new vscode.ThemeIcon('archive')
    this.contextValue = 'archivedLists'
  }
}

const expandedArchivedListsTreeItem = new ArchivedListsTreeItem(true)
const collapsedArchivedListsTreeItem = new ArchivedListsTreeItem(false)

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
      const children: TreeItem[] = this.config.getCachedSortedUnarchivedLists()
        .map(list => new ListTreeItem(list, this.config.getCurrentList() === list, false))

      if (this.config.getArchivedLists().length > 0) {
        children.push(
          this.config.getArchivedLists().includes(this.config.getCurrentList())
            ? expandedArchivedListsTreeItem
            : collapsedArchivedListsTreeItem
        )
      }

      return children
    }

    if (element instanceof ArchivedListsTreeItem) {
      return this.config.getCachedSortedArchivedLists()
        .map(list => new ListTreeItem(list, this.config.getCurrentList() === list, true))
    }

    const listBookmarks = this.config.getBookmarks().filter(bookmark => bookmark.list === element.list)

    if (element instanceof FileTreeItem) {
      const bookmarks = listBookmarks.filter(
        (bookmark): bookmark is Extract<Bookmark, { type: 'selection' }> => bookmark.type === 'selection' && bookmark.uri.path === element.uri.path
      )

      return bookmarks
        .sort((a, b) => a.selection.start.line - b.selection.start.line)
        .map(bookmark => new SelectionTreeItem(
          bookmark,
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

const activeListThemeIcon = new vscode.ThemeIcon('folder-active')
const inactiveListThemeIcon = new vscode.ThemeIcon('folder')

export class ListTreeItem extends vscode.TreeItem {
  constructor(public readonly list: string, isCurrentList: boolean, isArchived: boolean) {
    super(list, isCurrentList ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed)

    this.iconPath = isCurrentList ? activeListThemeIcon : inactiveListThemeIcon
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

const MAX_LABEL_LENGTH = 64
const MAX_DESCRIPTION_LENGTH = 64
const MAX_TOOLTIP_SELECTION_VALUE_LINES = 15

const noteThemeIcon = new vscode.ThemeIcon('note')
const selectionThemeIcon = new vscode.ThemeIcon('selection')

export class SelectionTreeItem extends vscode.TreeItem {
  constructor(
    public readonly bookmark: Bookmark,
    public readonly list: string,
    public readonly uri: vscode.Uri,
    public readonly selection: vscode.Selection,
    value: string,
    public readonly note?: string,
    formattedSelectionValue = formatSelectionValue(selection, value)
  ) {
    super(trimTextLength(note ?? formattedSelectionValue, MAX_LABEL_LENGTH), vscode.TreeItemCollapsibleState.None)

    this.description = note ? trimTextLength(formattedSelectionValue, MAX_DESCRIPTION_LENGTH) : undefined
    this.contextValue = 'selection'
    this.tooltip = `${note ? `${note}\n\n` : ''}${trimTextLines(stripIndent(value), MAX_TOOLTIP_SELECTION_VALUE_LINES)}\n\n${uri.path}`
    this.iconPath = note ? noteThemeIcon : selectionThemeIcon
    this.command = {
      command: 'vscode.open',
      arguments: [uri, { selection }],
      title: selection.isEmpty ? 'Go to line' : 'Go to selection'
    }
  }
}

function trimTextLines(text: string, maxLines: number) {
  const lines = text.split('\n')
  if (lines.length > maxLines) {
    return lines.slice(0, maxLines).join('\n') + '…'
  }

  return text
}

function trimTextLength(text: string, maxLength: number) {
  if (text.length > maxLength) {
    return text.substring(0, maxLength) + '…'
  }

  return text
}

function formatSelectionValue(selection: vscode.Selection, value: string) {
  return selection.isSingleLine
    ? `${selection.start.line + 1}: ${stripIndents(value)}`
    : `${selection.start.line + 1}-${selection.end.line + 1}: ${stripIndents(value)}`
}
