import * as vscode from 'vscode'
import type { Bookmark } from './bookmarks-feature'

// TODO: group by file, group by folder
// TODO: what to do with outdated bookmarks?
// TODO: bookmark labels
export class BookmarksTreeDataProvider implements vscode.TreeDataProvider<BookmarkTreeItem> {
	private _onDidChangeTreeData = new vscode.EventEmitter<void>()
  onDidChangeTreeData = this._onDidChangeTreeData.event

  private _bookmarks: Bookmark[] = []
  setBookmarks(bookmarks: Bookmark[]) {
    this._bookmarks = bookmarks
  }

  refresh(): void {
		this._onDidChangeTreeData.fire()
  }

  getTreeItem(element: BookmarkTreeItem) {
    return element
  }

  async getChildren(element?: unknown): Promise<BookmarkTreeItem[] | undefined> {
    if (element) return

    return this._bookmarks.map(bookmark => new BookmarkTreeItem(bookmark))
  }
}

export class BookmarkTreeItem extends vscode.TreeItem {
  constructor(
    public readonly bookmark: Bookmark
  ) {
    super(bookmark.preview, vscode.TreeItemCollapsibleState.None)

    if (bookmark.type === 'File') {
      this.resourceUri = vscode.Uri.file(bookmark.path)
      this.command = {
        command: 'vscode.open',
        arguments: [
          this.resourceUri,
          bookmark.range ? {
            selection: new vscode.Selection(
              new vscode.Position(bookmark.range.start.line, bookmark.range.start.character),
              new vscode.Position(bookmark.range.end.line, bookmark.range.end.character),
            )
          } : undefined
        ],
        title: 'Open file'
      }
    }
  }
}