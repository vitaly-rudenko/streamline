import * as vscode from 'vscode'
import { BookmarksTreeDataProvider, FileTreeItem, FolderTreeItem, formatSelectionValue, ListTreeItem, SelectionTreeItem, TreeItem } from './bookmarks-tree-data-provider'
import { BookmarksConfig } from './bookmarks-config'
import { createDebouncedFunction } from '../../utils/create-debounced-function'
import { filter } from '../../utils/filter'
import { BookmarksCache } from './bookmarks-cache'
import { BookmarksWorkspaceState } from './bookmarks-workspace-state'
import { Bookmark, defaultCurrentList } from './common'
import { getTargetItemsForCommand } from './toolkit/get-target-items-for-command'
import { formatPaths } from '../../utils/format-paths'
import { RegisterCommand } from '../../register-command'

const UNDO_HISTORY_SIZE = 50

export function createBookmarksFeature(input: {
  context: vscode.ExtensionContext
  registerCommand: RegisterCommand
  onChange: () => unknown
}) {
  const { context, registerCommand, onChange } = input

  const config = new BookmarksConfig()
  const workspaceState = new BookmarksWorkspaceState(context.workspaceState)
  const cache = new BookmarksCache(config, workspaceState)

  config.onChange = () => {
    cache.update()
    onChange()
  }

  workspaceState.onChange = () => {
    cache.update()
    onChange()
  }

  const bookmarksTreeDataProvider = new BookmarksTreeDataProvider(cache, config, workspaceState)
  const bookmarksTreeView = vscode.window.createTreeView('bookmarks', {
    treeDataProvider: bookmarksTreeDataProvider,
    showCollapseAll: true,
    canSelectMany: true,
  })

  const scheduleConfigLoad = createDebouncedFunction(() => {
    if (!config.load()) return
    bookmarksTreeDataProvider.refresh()
  }, 500)

  async function updateContextInBackground() {
    try {
      const activeTextEditorUri = vscode.window.activeTextEditor?.document.uri
      const isActiveTextEditorBookmarked = activeTextEditorUri
        ? cache.getCachedBookmarkedFilePathsInCurrentBookmarksListSet().has(activeTextEditorUri.path)
        : false

      const bookmarkedPaths = config.getBookmarks()
        .filter(bookmark => bookmark.list === workspaceState.getCurrentList())
        .map(bookmark => bookmark.uri.path)

      await vscode.commands.executeCommand('setContext', 'streamline.bookmarks.activeTextEditorBookmarked', isActiveTextEditorBookmarked)
      await vscode.commands.executeCommand('setContext', 'streamline.bookmarks.isUndoHistoryEmpty', workspaceState.getUndoHistory().length === 0)
      await vscode.commands.executeCommand('setContext', 'streamline.bookmarks.bookmarkedPaths', bookmarkedPaths satisfies string[])
    } catch (error) {
      console.warn('[Bookmarks] Could not update context', error)
    }
  }

  async function promptListSelection() {
    let selected = await vscode.window.showQuickPick<vscode.QuickPickItem & { list?: string }>(
      [
        ...cache.getCachedSortedUnarchivedLists().map(list => ({
          label: list,
          iconPath: new vscode.ThemeIcon('bookmark'),
          description: workspaceState.getCurrentList() === list ? 'Current List' : undefined,
          list,
        })),
        { label: 'Add new list', iconPath: new vscode.ThemeIcon('add') }
      ],
      { title: 'Select Bookmarks List' }
    )
    if (!selected) return undefined

    let selectedList = selected.list
    if (!selectedList) {
      selectedList = await vscode.window.showInputBox({ prompt: 'Enter the name of new list' })
      if (!selectedList) return
    }

    return selectedList
  }

  context.subscriptions.push(bookmarksTreeView)

  // Primary "Bookmark this..." command implementation
  registerCommand('streamline.bookmarks.add', async (_: never, selectedUris: vscode.Uri[] | undefined, list?: string | undefined, note?: string | undefined) => {
    list ||= workspaceState.getCurrentList()

    // Add all selected files & folders in file tree
    if (selectedUris && selectedUris.length > 0) {
      const urisWithFileTypes = await Promise.all(
        selectedUris.map(async (uri) => ({ uri, fileType: (await vscode.workspace.fs.stat(uri)).type }))
      )

      config.setBookmarks([
        ...config.getBookmarks(),
        ...urisWithFileTypes
          .filter(({ fileType }) => fileType === vscode.FileType.File || fileType === vscode.FileType.SymbolicLink)
          .map(({ uri }) => ({ type: 'file', uri, list, note } as const)),
        ...urisWithFileTypes
          .filter(({ fileType }) => fileType === vscode.FileType.Directory)
          .map(({ uri }) => ({ type: 'folder', uri, list, note } as const)),
      ])
    } else { // Or add currently opened file
      const activeTextEditor = vscode.window.activeTextEditor
      if (!activeTextEditor) return

      config.setBookmarks([
        ...config.getBookmarks(),
        ...activeTextEditor.selections.map((selection) => {
          return {
            type: 'selection',
            uri: activeTextEditor.document.uri,
            note,
            list,
            selection,
            value: (
              selection.isEmpty
                ? activeTextEditor.document.getText(activeTextEditor.document.lineAt(selection.start.line).range)
                : activeTextEditor.document.getText(selection)
            ),
          } as const
        })
      ])
    }

    bookmarksTreeDataProvider.refresh()
    updateContextInBackground()
    config.saveInBackground()
  })

  // Bookmark a file
  registerCommand('streamline.bookmarks.addFile', async (uriOrFileTreeItem: vscode.Uri | FileTreeItem | undefined) => {
    if (uriOrFileTreeItem instanceof FileTreeItem) { // When "virtualFile" is bookmarked
      await vscode.commands.executeCommand('streamline.bookmarks.add', uriOrFileTreeItem.uri, [uriOrFileTreeItem.uri], uriOrFileTreeItem.list)
    } else if (uriOrFileTreeItem) { // When real file is bookmarked (e.g. in file tree)
      await vscode.commands.executeCommand('streamline.bookmarks.add', uriOrFileTreeItem, [uriOrFileTreeItem])
    } else { // When currently opened file is bookmarked
      const activeTextEditorUri = vscode.window.activeTextEditor?.document.uri
      if (activeTextEditorUri) {
        await vscode.commands.executeCommand('streamline.bookmarks.add', activeTextEditorUri, [activeTextEditorUri])
      }
    }
  })

  // Bookmark to a custom list
  registerCommand('streamline.bookmarks.addToList', async (uri: never, selectedUris: vscode.Uri[] | undefined) => {
    const selectedList = await promptListSelection()
    if (!selectedList) return

    await vscode.commands.executeCommand('streamline.bookmarks.add', uri, selectedUris, selectedList)
  })

  // Bookmark with a note
  registerCommand('streamline.bookmarks.addNote', async (uri: never, selectedUris: vscode.Uri[] | undefined) => {
    const note = await vscode.window.showInputBox({ prompt: 'Enter the note' })
    if (!note) return

    await vscode.commands.executeCommand('streamline.bookmarks.add', uri, selectedUris, undefined, note)
  })

  // Edit bookmark's note
  registerCommand('streamline.bookmarks.editNote', async (item?: SelectionTreeItem) => {
    if (!item) return

    const newNote = await vscode.window.showInputBox({ prompt: 'Enter the note', value: item?.note })
    if (newNote === undefined) return

    // Check if bookmark still exists
    const bookmarks = config.getBookmarks()
    const bookmarkToEdit = item.bookmark

    if (!bookmarks.includes(bookmarkToEdit)) {
      bookmarksTreeDataProvider.refresh()
      vscode.window.showWarningMessage('Something went wrong, please try again')
      return
    }

    if (bookmarkToEdit.note === newNote) return

    // Replace old bookmark with new bookmark (with updated note)
    config.setBookmarks([
      ...bookmarks.filter((bookmark) => bookmark !== bookmarkToEdit),
      { ...bookmarkToEdit, note: newNote === '' ? undefined : newNote },
    ])

    bookmarksTreeDataProvider.refresh()
    config.saveInBackground()
  })

  // Move bookmarks to another list
  registerCommand('streamline.bookmarks.move', async (
    item?: FolderTreeItem | FileTreeItem | SelectionTreeItem,
    selectedItems?: (FolderTreeItem | FileTreeItem | SelectionTreeItem)[],
  ) => {
    const items = getTargetItemsForCommand(item, selectedItems)
      // We allow selecting virtual files for better UX, but it's not possible to move them because they're not real bookmarks
      .filter(item => item.contextValue !== 'virtualFile')
    if (items.length === 0) return

    const newList = await promptListSelection()
    if (!newList) return

    // Check if bookmark still exists after list selection
    const bookmarks = config.getBookmarks()
    const bookmarksToMove = bookmarks
      .filter(bookmark => items.some(item => bookmark.list === item.list && bookmark.uri.path === item.uri.path && bookmark.type === item.type))
      .filter(bookmark => bookmark.list !== newList)

    if (bookmarksToMove.length === 0) {
      bookmarksTreeDataProvider.refresh()
      return
    }

    config.setBookmarks([
      ...config.getBookmarks().filter((bookmark) => !bookmarksToMove.includes(bookmark)),
      ...bookmarksToMove.map(bookmark => ({ ...bookmark, list: newList })),
    ])

    bookmarksTreeDataProvider.refresh()
    config.saveInBackground()
  })

  // Bookmark with a note to custom list
  registerCommand('streamline.bookmarks.addNoteToList', async (_: never, selectedUris: vscode.Uri[] | undefined) => {
    const selectedList = await promptListSelection()
    if (!selectedList) return

    const note = await vscode.window.showInputBox({ prompt: 'Enter the note' })
    if (!note) return

    await vscode.commands.executeCommand('streamline.bookmarks.add', _, selectedUris, selectedList, note)
  })

  // Select currently active bookmarks list
  registerCommand('streamline.bookmarks.changeCurrentList', async () => {
    const selectedList = await promptListSelection()
    if (!selectedList) return

    workspaceState.setCurrentList(selectedList)
    bookmarksTreeDataProvider.refresh()
    updateContextInBackground()
    await workspaceState.save()
  })

  // Set bookmarks list as currently active
  registerCommand('streamline.bookmarks.setListAsCurrent', async (item?: ListTreeItem) => {
    if (!item?.list) return

    workspaceState.setCurrentList(item?.list)
    bookmarksTreeDataProvider.refresh()
    updateContextInBackground()
    await workspaceState.save()
  })

  // 'Create' a new bookmarks list
  registerCommand('streamline.bookmarks.addList', async () => {
    const list = await vscode.window.showInputBox({ prompt: 'Enter the name of new list' })
    if (!list) return

    workspaceState.setCurrentList(list)
    bookmarksTreeDataProvider.refresh()
    updateContextInBackground()
    await workspaceState.save()
  })

  // Rename bookmarks list
  registerCommand('streamline.bookmarks.renameList', async (item?: ListTreeItem) => {
    if (!item) return

    const oldName = item.list
    const newName = await vscode.window.showInputBox({ prompt: 'Enter new name of the list', value: oldName })
    if (!newName || newName === item.list) return

    // Merge bookmarks lists if names match
    let isNewList = !cache.getCachedUnsortedLists().includes(newName)
    if (!isNewList) {
      const result = await vscode.window.showInformationMessage(`List ${newName} already exists. Do you want to merge bookmarks?`, 'Yes, merge', 'Cancel')
      if (result !== 'Yes, merge') return
    }

    // Make sure it stays active if it was active before renaming
    if (workspaceState.getCurrentList() === oldName) {
      workspaceState.setCurrentList(newName)
    }

    // Make sure it stays archived if it was archived before renaming
    if (config.getArchivedLists().includes(oldName)) {
      config.setArchivedLists(config.getArchivedLists().filter(list => list !== oldName))

      if (isNewList) {
        config.setArchivedLists([...config.getArchivedLists(), newName])
      }
    }

    // Update all bookmarks in the renamed list
    config.setBookmarks(
      config.getBookmarks().map((bookmark) => bookmark.list === oldName ? { ...bookmark, list: newName } : bookmark)
    )

    bookmarksTreeDataProvider.refresh()
    config.saveInBackground()
    await workspaceState.save()
  })

  // Archive bookmarks list
  registerCommand('streamline.bookmarks.archiveList', async (item?: ListTreeItem) => {
    if (!item) return
    if (config.getArchivedLists().includes(item.list)) return

    config.setArchivedLists([...config.getArchivedLists(), item.list])

    bookmarksTreeDataProvider.refresh()
    config.saveInBackground()
  })

  // Unarchive bookmarks list
  registerCommand('streamline.bookmarks.unarchiveList', async (item?: ListTreeItem) => {
    if (!item) return
    if (!config.getArchivedLists().includes(item.list)) return

    config.setArchivedLists(config.getArchivedLists().filter(list => list !== item.list))

    bookmarksTreeDataProvider.refresh()
    config.saveInBackground()
  })

  // Reveal bookmark (file) in the file tree
  registerCommand('streamline.bookmarks.revealInExplorer', async (item: FileTreeItem | FolderTreeItem | SelectionTreeItem) => {
    await vscode.commands.executeCommand('revealInExplorer', item.uri)
  })

  // Deletes file from bookmarks (bookmarked selections are not deleted)
  registerCommand('streamline.bookmarks.deleteFile', async (uri: vscode.Uri | undefined) => {
    uri ??= vscode.window.activeTextEditor?.document.uri
    await vscode.commands.executeCommand('streamline.bookmarks.delete', uri)
  })

  // Deletes all bookmarks in a list
  registerCommand('streamline.bookmarks.deleteList', async (item: unknown[], items: unknown[]) => {
    await vscode.commands.executeCommand('streamline.bookmarks.delete', item, items)
  })

  // Deletes an individual bookmark (file, folder or selection) or all bookmarks in a list
  registerCommand('streamline.bookmarks.delete', async (item?: TreeItem | vscode.Uri, selectedItems?: (TreeItem | vscode.Uri)[]) => {
    const targetItems = getTargetItemsForCommand(item, selectedItems)
    if (targetItems.length === 0) return

    let finalUpdatedBookmarks = config.getBookmarks()
    const allRemovedBookmarks: Bookmark[] = []

    // All target items must either be Uris (Explorer View) or TreeItems (Bookmarks View)
    if (targetItems.some(item => item instanceof vscode.Uri) && targetItems.some(item => !(item instanceof vscode.Uri))) {
      console.error('[Bookmarks] Unexpected target items mismatch', targetItems)
      throw new Error('Unexpected target items mismatch')
    }

    // Case 1: Deleting bookmarks from Explorer View
    if (targetItems.every(item => item instanceof vscode.Uri)) {
      const listToDeleteFrom = workspaceState.getCurrentList()

      const pathsToDelete = new Set(targetItems.map(item => item.path))
      const [updatedBookmarks, removedBookmarks] = filter(
        config.getBookmarks(),
        (bookmark) => !(bookmark.list === listToDeleteFrom && pathsToDelete.has(bookmark.uri.path))
      )

      allRemovedBookmarks.push(...removedBookmarks)
      finalUpdatedBookmarks = updatedBookmarks
    }
    // Case 2: Deleting bookmarks lists
    else if (targetItems.every(item => item instanceof ListTreeItem)) {
      const listsToDeleteFrom = targetItems.map(item => item.list)

      const [updatedBookmarks, removedBookmarks] = filter(
        config.getBookmarks(),
        (bookmark) => !(listsToDeleteFrom.includes(bookmark.list))
      )

      // Remove 'archived' tag from the deleted lists
      config.setArchivedLists(config.getArchivedLists().filter(list => !listsToDeleteFrom.includes(list)))

      // Set current list to default if it was deleted
      if (listsToDeleteFrom.includes(workspaceState.getCurrentList())) {
        workspaceState.setCurrentList(defaultCurrentList)
      }

      allRemovedBookmarks.push(...removedBookmarks)
      finalUpdatedBookmarks = updatedBookmarks
    }
    // Case 3: Deleting bookmarked files, folders and selections
    else if (targetItems.every(item => item instanceof vscode.TreeItem)) {
      const shouldDeleteAllSelectionsInVirtualFiles = targetItems.every(item => item.contextValue !== 'selection')

      for (const targetItem of targetItems) {
        const [updatedBookmarks, removedBookmarks] = filter(
          finalUpdatedBookmarks,
          (bookmark) => {
            if (targetItem instanceof FolderTreeItem) {
              return !(bookmark.type === 'folder' && bookmark.list === targetItem.list && bookmark.uri.path === targetItem.uri.path)
            }

            if (targetItem instanceof FileTreeItem) {
              return !(
                (bookmark.type === 'file' && bookmark.list === targetItem.list && bookmark.uri.path === targetItem.uri.path) ||
                (shouldDeleteAllSelectionsInVirtualFiles && targetItem.contextValue === 'virtualFile' && bookmark.type === 'selection' && bookmark.list === targetItem.list && bookmark.uri.path === targetItem.uri.path)
              )
            }

            if (targetItem instanceof SelectionTreeItem) {
              return !(bookmark.type === 'selection' && bookmark.list === targetItem.list && bookmark.uri.path === targetItem.uri.path && bookmark.selection.isEqual(targetItem.selection))
            }

            console.error('[Bookmarks] Unexpected target item type', targetItem)
            throw new Error('Unexpected target item type')
          }
        )

        allRemovedBookmarks.push(...removedBookmarks)
        finalUpdatedBookmarks = updatedBookmarks
      }
    }

    if (allRemovedBookmarks.length === 0) return // None were removed

    // Save deleted bookmarks in workspace state to be able to revert the deletion
    workspaceState.setUndoHistory([...workspaceState.getUndoHistory(), allRemovedBookmarks].slice(0, UNDO_HISTORY_SIZE))
    config.setBookmarks(finalUpdatedBookmarks)

    bookmarksTreeDataProvider.refresh()
    updateContextInBackground()
    config.saveInBackground()
    await workspaceState.save()
  })

  // Reverts bookmarks deletion (stored in workspace state)
  registerCommand('streamline.bookmarks.undo', async () => {
    const bookmarksToRestore = workspaceState.getUndoHistory().at(-1)
    if (!bookmarksToRestore) return

    config.setBookmarks([...config.getBookmarks(), ...bookmarksToRestore])
    workspaceState.setUndoHistory(workspaceState.getUndoHistory().slice(0, -1))

    bookmarksTreeDataProvider.refresh()
    updateContextInBackground()
    config.saveInBackground()
    await workspaceState.save()
  })

  // Export all bookmarks as serialized JSON (opens the data in a new tab)
  registerCommand('streamline.bookmarks.exportAsJson', async () => {
    const serializedJsonExport = JSON.stringify({
      bookmarks: config.getSerializedBookmarks(),
      archivedLists: config.getArchivedLists(),
    }, null, 2)

    const document = await vscode.workspace.openTextDocument({
      content: serializedJsonExport,
      language: 'json',
    })

    await vscode.window.showTextDocument(document)
  })

  // Quickly open bookmark from the current bookmarks list
  registerCommand('streamline.bookmarks.quickOpen', async () => {
    const currentList = workspaceState.getCurrentList()

    const bookmarks = config.getBookmarks()
      // Filter by current list
      .filter(bookmark => bookmark.list === currentList)
      // Only files & selections
      .filter(bookmark => bookmark.type === 'file' || bookmark.type === 'selection')
      // Sort selections in files by line number
      .sort((a, b) => a.type === 'selection' && b.type === 'selection' ? a.selection.start.line - b.selection.start.line : 0)
      // Sort files to appear before selections inside them
      .sort((a, b) => a.type === b.type ? 0 : a.type === 'file' ? -1 : 1)
      // Group files & selections by same path
      .sort((a, b) => a.uri.path.localeCompare(b.uri.path))

    if (bookmarks.length === 0) {
      vscode.window.showInformationMessage(`You don't have bookmarks in "${currentList}" list yet`)
      return
    }

    const uris = bookmarks.map(bookmark => bookmark.uri)
    const formattedPaths = formatPaths(uris.map(uri => uri.path))

    const quickPick = vscode.window.createQuickPick<vscode.QuickPickItem & { bookmark: Bookmark }>()

    quickPick.items = bookmarks.flatMap((bookmark, i) => {
      const label = formattedPaths.get(bookmark.uri.path)!
      const results: (vscode.QuickPickItem & { bookmark: Bookmark })[] = []

      if (
        (i === 0 || bookmarks[i - 1].uri.path !== bookmark.uri.path)
        && !bookmarks.some(b => b.type === 'file' && b.uri.path === bookmark.uri.path)
      ) {
        results.push({
          label,
          description: vscode.workspace.asRelativePath(bookmark.uri.path),
          iconPath: new vscode.ThemeIcon('file'),
          bookmark: {
            type: 'file',
            list: bookmark.list,
            uri: bookmark.uri,
          },
          buttons: [{ iconPath: new vscode.ThemeIcon('split-horizontal') , tooltip: 'Open to Side' }]
        })
      }

      if (bookmark.type === 'selection') {
        const preview = formatSelectionValue(bookmark.selection, bookmark.value)

        results.push({
          label: `$(${bookmark.note ? 'note' : 'selection'}) ${bookmark.note ? bookmark.note : preview}`,
          description: bookmark.note ? preview : undefined,
          bookmark,
          iconPath: new vscode.ThemeIcon('indent'),
          buttons: [{ iconPath: new vscode.ThemeIcon('split-horizontal') , tooltip: 'Open to Side' }]
        })
      } else {
        results.push({
          label,
          description: vscode.workspace.asRelativePath(bookmark.uri.path),
          iconPath: new vscode.ThemeIcon('file'),
          bookmark,
          buttons: [{ iconPath: new vscode.ThemeIcon('split-horizontal') , tooltip: 'Open to Side' }]
        })
      }

      return results
    })

    quickPick.onDidAccept(async () => {
      const [selected] = quickPick.selectedItems
      if (selected) {
        await vscode.window.showTextDocument(
          selected.bookmark.uri,
          {
            preview: false,
            ...selected.bookmark.type === 'selection' && {
              selection: selected.bookmark.selection,
            },
          }
        )
      }

      quickPick.dispose()
    })

    quickPick.onDidTriggerItemButton(async ({ item }) => {
      if (!item) return
      await vscode.window.showTextDocument(
        item.bookmark.uri,
        {
          preview: false,
          viewColumn: vscode.ViewColumn.Beside,
          ...item.bookmark.type === 'selection' && {
            selection: item.bookmark.selection,
          },
        }
      )
    })

    quickPick.onDidHide(() => quickPick.dispose())

    quickPick.show()
  })

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('streamline.bookmarks')) {
        if (!config.isSavingInBackground) {
          scheduleConfigLoad()
        }
      }
    }),
    vscode.window.onDidChangeActiveTextEditor(() => updateContextInBackground()),
    // Update bookmarks when corresponding files are renamed or moved
    vscode.workspace.onDidRenameFiles((event) => {
      const oldPathNewUriMap = new Map(event.files.map(file => [file.oldUri.path, file.newUri]))

      config.setBookmarks(
        config.getBookmarks().map((bookmark) =>
          oldPathNewUriMap.has(bookmark.uri.path)
            ? { ...bookmark, uri: oldPathNewUriMap.get(bookmark.uri.path)! }
            : bookmark
        )
      )

      bookmarksTreeDataProvider.refresh()
      config.saveInBackground()
    }),
  )

  updateContextInBackground()

  return {
    isPathBookmarkedInCurrentBookmarksList(path: string) {
      return cache.getCachedBookmarkedPathsInCurrentBookmarksListSet().has(path)
    },
    getCachedBookmarksInCurrentBookmarksList() {
      return cache.getCachedBookmarksInCurrentBookmarksList()
    }
  }
}
