import * as vscode from 'vscode'
import { BookmarksTreeDataProvider, FileTreeItem, FolderTreeItem, formatSelectionValue, ListTreeItem, SelectionTreeItem } from './bookmarks-tree-data-provider'
import { BookmarksConfig } from './bookmarks-config'
import { createDebouncedFunction } from '../../utils/create-debounced-function'
import { filter } from '../../utils/filter'
import { BookmarksCache } from './bookmarks-cache'
import { BookmarksWorkspaceState } from './bookmarks-workspace-state'
import { Bookmark, defaultCurrentList } from './common'
import { getTargetItemsForCommand } from './toolkit/get-target-items-for-command'
import { formatPaths } from '../../utils/format-paths'

const UNDO_HISTORY_SIZE = 50

// TODO: Deleting "virtual" file should suggest user to delete all selections inside of it (with confirmation)
// TODO: optimize & cache new functionality

export function createBookmarksFeature(input: {
  context: vscode.ExtensionContext
  onChange: () => unknown
}) {
  const { context, onChange } = input

  const config = new BookmarksConfig()
  const workspaceState = new BookmarksWorkspaceState(context.workspaceState)
  const cache = new BookmarksCache(config, workspaceState)
  config.onChange = workspaceState.onChange = () => {
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
        ? cache.getCachedBookmarkedFilePathsSet().has(activeTextEditorUri.path)
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
    const addNewListItem = '+ Add new list'

    let selectedList = await vscode.window.showQuickPick(
      [
        ...cache.getCachedSortedUnarchivedLists(),
        addNewListItem,
      ],
      { title: 'Select Bookmarks List' }
    )
    if (!selectedList) return undefined

    if (selectedList === addNewListItem) {
      selectedList = await vscode.window.showInputBox({ prompt: 'Enter the name of new list' })
      if (!selectedList) return
    }

    return selectedList
  }

	context.subscriptions.push(bookmarksTreeView)

  // Primary "Bookmark this..." command implementation
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.bookmarks.add', async (_: never, selectedUris: vscode.Uri[] | undefined, list?: string | undefined, note?: string | undefined) => {
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
  )

  // Bookmark a file
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.bookmarks.addFile', async (uriOrFileTreeItem: vscode.Uri | FileTreeItem | undefined) => {
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
  )

  // Bookmark to a custom list
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.bookmarks.addToList', async (uri: never, selectedUris: vscode.Uri[] | undefined) => {
      const selectedList = await promptListSelection()
      if (!selectedList) return

      await vscode.commands.executeCommand('streamline.bookmarks.add', uri, selectedUris, selectedList)
    })
  )

  // Bookmark with a note
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.bookmarks.addNote', async (uri: never, selectedUris: vscode.Uri[] | undefined) => {
      const note = await vscode.window.showInputBox({ prompt: 'Enter the note' })
      if (!note) return

      await vscode.commands.executeCommand('streamline.bookmarks.add', uri, selectedUris, undefined, note)
    })
  )

  // Edit bookmark's note
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.bookmarks.editNote', async (item?: SelectionTreeItem) => {
      if (!item) return

      const newNote = await vscode.window.showInputBox({ prompt: 'Enter the note', value: item?.note })
      if (newNote === undefined) return

      // Check if bookmark still exists
      const bookmarks = config.getBookmarks()
      const bookmarkToEdit = item.bookmark

      if (!bookmarks.includes(bookmarkToEdit)) {
        bookmarksTreeDataProvider.refresh()
        await vscode.window.showWarningMessage('Something went wrong, please try again')
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
  )

  // Move bookmarks to another list
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.bookmarks.move', async (
      item?: FolderTreeItem | FileTreeItem | SelectionTreeItem,
      selectedItems?: (FolderTreeItem | FileTreeItem | SelectionTreeItem)[],
    ) => {
      const items = getTargetItemsForCommand(item, selectedItems)
        // We allow selecting virtual files for better UX, but it's not possible to move them because they're not real bookmarks
        .filter(item => item.contextValue !== 'virtualFile')
      if (items.length === 0) return

      const newList = await promptListSelection()
      if (!newList) return

      // Check if bookmark still exists
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
  )

  // Bookmark with a note to custom list
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.bookmarks.addNoteToList', async (_: never, selectedUris: vscode.Uri[] | undefined) => {
      const selectedList = await promptListSelection()
      if (!selectedList) return

      const note = await vscode.window.showInputBox({ prompt: 'Enter the note' })
      if (!note) return

      await vscode.commands.executeCommand('streamline.bookmarks.add', _, selectedUris, selectedList, note)
    })
  )

  // Select currently active bookmarks list
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.bookmarks.changeCurrentList', async () => {
      const selectedList = await promptListSelection()
      if (!selectedList) return

      workspaceState.setCurrentList(selectedList)
      bookmarksTreeDataProvider.refresh()
      updateContextInBackground()
      await workspaceState.save()
    })
  )

  // Set bookmarks list as currently active
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.bookmarks.setListAsCurrent', async (item?: ListTreeItem) => {
      if (!item?.list) return

      workspaceState.setCurrentList(item?.list)
      bookmarksTreeDataProvider.refresh()
      updateContextInBackground()
      await workspaceState.save()
    })
  )

  // 'Create' a new bookmarks list
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.bookmarks.addList', async () => {
      const list = await vscode.window.showInputBox({ prompt: 'Enter the name of new list' })
      if (!list) return

      workspaceState.setCurrentList(list)
      bookmarksTreeDataProvider.refresh()
      await workspaceState.save()
    })
  )

  // Rename bookmarks list
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.bookmarks.renameList', async (item?: ListTreeItem) => {
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
        config.getBookmarks().map((bookmark) => bookmark.list === oldName ? {...bookmark, list: newName} : bookmark)
      )

      bookmarksTreeDataProvider.refresh()
      config.saveInBackground()
      await workspaceState.save()
    })
  )

  // Archive bookmarks list
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.bookmarks.archiveList', async (item?: ListTreeItem) => {
      if (!item) return
      if (config.getArchivedLists().includes(item.list)) return

      config.setArchivedLists([...config.getArchivedLists(), item.list])

      bookmarksTreeDataProvider.refresh()
      config.saveInBackground()
    })
  )

  // Unarchive bookmarks list
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.bookmarks.unarchiveList', async (item?: ListTreeItem) => {
      if (!item) return
      if (!config.getArchivedLists().includes(item.list)) return

      config.setArchivedLists(config.getArchivedLists().filter(list => list !== item.list))

      bookmarksTreeDataProvider.refresh()
      config.saveInBackground()
    })
  )

  // Reveal bookmark (file) in the file tree
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.bookmarks.revealInExplorer', async (item: FileTreeItem | FolderTreeItem | SelectionTreeItem) => {
      await vscode.commands.executeCommand('revealInExplorer', item.uri)
    })
  )

  // Deletes file from bookmarks (bookmarked selections are not deleted)
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.bookmarks.deleteFile', async (uri: vscode.Uri | undefined) => {
      uri ??= vscode.window.activeTextEditor?.document.uri
      await vscode.commands.executeCommand('streamline.bookmarks.delete', uri)
    })
  )

  // Deletes all bookmarks in a list
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.bookmarks.deleteList', async (item: ListTreeItem | undefined) => {
      if (!item) return
      await vscode.commands.executeCommand('streamline.bookmarks.delete', item)
    })
  )

  // Deletes an individual bookmark (file, folder or selection) or all bookmarks in a list
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.bookmarks.delete', async (
      item?: ListTreeItem | FileTreeItem | FolderTreeItem | SelectionTreeItem | vscode.Uri,
      selectedItems?: (ListTreeItem | FileTreeItem | FolderTreeItem | SelectionTreeItem | vscode.Uri)[]
    ) => {
      const itemsToDelete = getTargetItemsForCommand(item, selectedItems)
        // We allow selecting virtual files for better UX, but it's not possible to delete them because they're not real bookmarks
        .filter(item => !(item instanceof FileTreeItem) || item.contextValue !== 'virtualFile')
      if (itemsToDelete.length === 0) return

      const currentList = workspaceState.getCurrentList()

      let finalUpdatedBookmarks = config.getBookmarks()
      let finalRemovedBookmarks: Bookmark[] = []
      for (const itemToDelete of itemsToDelete) {
        if (itemToDelete instanceof ListTreeItem) {
          config.setArchivedLists(config.getArchivedLists().filter(list => list !== itemToDelete.list))
          if (workspaceState.getCurrentList() === itemToDelete.list) {
            workspaceState.setCurrentList(defaultCurrentList)
          }
        }

        const [updatedBookmarks, removedBookmarks] = filter(
          finalUpdatedBookmarks,
          (bookmark) => {
            if (itemToDelete instanceof ListTreeItem) {
              return !(bookmark.list === itemToDelete.list)
            } else if (itemToDelete instanceof FolderTreeItem) {
              return !(bookmark.type === 'folder' && bookmark.list === itemToDelete.list && bookmark.uri.path === itemToDelete.uri.path)
            } else if (itemToDelete instanceof FileTreeItem) {
              return !(bookmark.type === 'file' && bookmark.list === itemToDelete.list && bookmark.uri.path === itemToDelete.uri.path)
            } else if (itemToDelete instanceof SelectionTreeItem) {
              return !(bookmark.type === 'selection' && bookmark.list === itemToDelete.list && bookmark.uri.path === itemToDelete.uri.path && bookmark.selection.isEqual(itemToDelete.selection))
            } else { // Uri
              return !((bookmark.type === 'file' || bookmark.type === 'folder') && bookmark.list === currentList && bookmark.uri.path === itemToDelete.path)
            }
          }
        )

        finalRemovedBookmarks.push(...removedBookmarks)
        finalUpdatedBookmarks = updatedBookmarks
      }

      if (finalRemovedBookmarks.length === 0) return

      // Save deleted bookmarks in workspace state to be able to revert the deletion
      workspaceState.setUndoHistory([...workspaceState.getUndoHistory(), finalRemovedBookmarks].slice(0, UNDO_HISTORY_SIZE))
      config.setBookmarks(finalUpdatedBookmarks)

      bookmarksTreeDataProvider.refresh()
      updateContextInBackground()
      config.saveInBackground()
      await workspaceState.save()
    })
  )

  // Reverts bookmarks deletion (stored in workspace state)
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.bookmarks.undo', async () => {
      const bookmarksToRestore = workspaceState.getUndoHistory().at(-1)
      if (!bookmarksToRestore) return

      config.setBookmarks([...config.getBookmarks(), ...bookmarksToRestore])
      workspaceState.setUndoHistory(workspaceState.getUndoHistory().slice(0, -1))

      bookmarksTreeDataProvider.refresh()
      updateContextInBackground()
      config.saveInBackground()
      await workspaceState.save()
    })
  )

  // Export all bookmarks as serialized JSON (opens the data in a new tab)
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.bookmarks.exportAsJson', async () => {
      const serializedBookmarksAsJson = JSON.stringify(config.getSerializedBookmarks(), null, 2)

      const document = await vscode.workspace.openTextDocument({
        content: serializedBookmarksAsJson,
        language: 'json',
      })

      await vscode.window.showTextDocument(document)
    })
  )

  // Quickly open bookmark from the current bookmarks list
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.bookmarks.quickOpen', async () => {
      const currentList = workspaceState.getCurrentList()

      const bookmarks = config.getBookmarks()
        .filter(bookmark => bookmark.list === currentList)
        .filter(bookmark => bookmark.type === 'file' || bookmark.type === 'selection')
        .sort((a, b) => a.type === 'selection' && b.type === 'selection'
          ? a.selection.start.line - b.selection.start.line
          : 0)
        .sort((a, b) => a.type === b.type ? 0 : a.type === 'file' ? -1 : 1)
        .sort((a, b) => a.uri.path.localeCompare(b.uri.path))

      if (bookmarks.length === 0) {
        await vscode.window.showInformationMessage(`You don't have bookmarks in "${currentList}" list yet`)
        return
      }

      const uris = bookmarks.map(bookmark => bookmark.uri)
      const formattedPaths = formatPaths(uris.map(uri => uri.path))

      const selected = await vscode.window.showQuickPick(
        bookmarks.flatMap((bookmark, i) => {
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
            })
          }

          if (bookmark.type === 'selection') {
            const preview = formatSelectionValue(bookmark.selection, bookmark.value)

            results.push({
              label: `$(${bookmark.note ? 'note' : 'selection'}) ${bookmark.note ? bookmark.note : preview}`,
              description: bookmark.note ? preview : undefined,
              bookmark,
              iconPath: new vscode.ThemeIcon('indent'),
            })
          } else {
            results.push({
              label,
              description: vscode.workspace.asRelativePath(bookmark.uri.path),
              iconPath: new vscode.ThemeIcon('file'),
              bookmark,
            })
          }

          return results
        })
      )
      if (!selected) return

      await vscode.window.showTextDocument(
        selected.bookmark.uri,
        {
          ...selected.bookmark.type === 'selection' && {
            selection: selected.bookmark.selection,
          },
        }
      )
    })
  )

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
    }
  }
}
