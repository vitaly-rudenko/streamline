import * as vscode from 'vscode'
import { isMultiRootWorkspace } from '../../utils/is-multi-root-workspace'
import { RelatedFilesTreeDataProvider, type RelatedFileTreeItem, type WorkspaceFolderTreeItem } from './related-files-tree-data-provider'
import { RelatedFilesConfig } from './related-files-config'
import { createDebouncedFunction } from '../../utils/create-debounced-function'
import { unique } from '../../utils/unique'
import { getSmartBasename } from './toolkit/get-smart-basename'

export function createRelatedFilesFeature(input: { context: vscode.ExtensionContext }) {
  const { context } = input

  const config = new RelatedFilesConfig()
  const relatedFilesTreeDataProvider = new RelatedFilesTreeDataProvider(config)

  const scheduleRefresh = createDebouncedFunction(() => relatedFilesTreeDataProvider.refresh(), 50)
  const scheduleClearCacheAndRefresh = createDebouncedFunction(() => relatedFilesTreeDataProvider.clearCacheAndRefresh(), 500)

  const scheduleConfigLoad = createDebouncedFunction(() => {
    if (!config.load()) return
    relatedFilesTreeDataProvider.clearCacheAndRefresh()
    updateContextInBackground()
  }, 500)

  async function updateContextInBackground() {
    try {
      await vscode.commands.executeCommand('setContext', 'streamline.relatedFiles.useExcludes', config.getUseExcludes())
      await vscode.commands.executeCommand('setContext', 'streamline.relatedFiles.useGlobalSearch', config.getUseGlobalSearch())
    } catch (error) {
      console.warn('[ScopedPaths] Could not update context', error)
    }
  }

	context.subscriptions.push(vscode.window.registerTreeDataProvider('relatedFiles', relatedFilesTreeDataProvider))

  // Open "Quick Open" modal with pre-filled search query for the related files of currently opened file
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.relatedFiles.quickOpen', async (uri: vscode.Uri | undefined) => {
      uri ||= vscode.window.activeTextEditor?.document.uri
      if (!uri) return

      const workspaceFolder = isMultiRootWorkspace() && !config.getUseGlobalSearch()
        ? vscode.workspace.getWorkspaceFolder(uri)
        : undefined

      const basename = getSmartBasename(uri.path, config.getExcludedSuffixes()).replaceAll(/[-_]/g, ' ')

      const query = workspaceFolder ? `${workspaceFolder.name}/${basename}` : basename

      await vscode.commands.executeCommand('workbench.action.quickOpen', query)
    })
  )

  // Reload "Related files" panel
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.relatedFiles.refresh', () => {
      relatedFilesTreeDataProvider.clearCacheAndRefresh()
      updateContextInBackground()
    })
  )

  // Open related file side-by-side (button in "Related files" panel)
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.relatedFiles.openToSide', async (item?: RelatedFileTreeItem) => {
      if (!item?.resourceUri) return
      await vscode.commands.executeCommand('explorer.openToSide', item.resourceUri)
    })
  )

  // Hide files from the selected workspace folder from the related files list (context menu item in "Related files" panel)
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.relatedFiles.hideWorkspaceFolderInGlobalSearch', async (item?: WorkspaceFolderTreeItem) => {
      if (!item) return

      config.setHiddenWorkspaceFoldersInGlobalSearch(
        unique([
          ...config.getHiddenWorkspaceFoldersInGlobalSearch(),
          item.workspaceFolder.name,
        ])
      )

      relatedFilesTreeDataProvider.clearCacheAndRefresh()
      config.saveInBackground()
    })
  )

  // Toggle "Use Excludes" option
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.relatedFiles.enableUseExcludes', () => {
      config.setUseExcludes(true)
      relatedFilesTreeDataProvider.clearCacheAndRefresh()

      updateContextInBackground()
      config.saveInBackground()
    }),
    vscode.commands.registerCommand('streamline.relatedFiles.disableUseExcludes', () => {
      config.setUseExcludes(false)
      relatedFilesTreeDataProvider.clearCacheAndRefresh()

      updateContextInBackground()
      config.saveInBackground()
    })
  )

  // Toggle "Use Global Search" option
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.relatedFiles.enableUseGlobalSearch', () => {
      config.setUseGlobalSearch(true)
      relatedFilesTreeDataProvider.clearCacheAndRefresh()

      updateContextInBackground()
      config.saveInBackground()
    }),
    vscode.commands.registerCommand('streamline.relatedFiles.disableUseGlobalSearch', () => {
      config.setUseGlobalSearch(false)
      relatedFilesTreeDataProvider.clearCacheAndRefresh()

      updateContextInBackground()
      config.saveInBackground()
    })
  )

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('search.exclude') || event.affectsConfiguration('files.exclude')) {
        scheduleClearCacheAndRefresh()
      }

      if (event.affectsConfiguration('streamline.relatedFiles')) {
        if (!config.isSavingInBackground) {
          scheduleConfigLoad()
        }
      }
    }),
    // Reload "Related files" panel when currently opened file changes
    vscode.window.onDidChangeActiveTextEditor(() => scheduleRefresh()),
    // Refresh when window state changes (e.g. focused, minimized)
    vscode.window.onDidChangeWindowState(() => scheduleRefresh()),
    // Clear files cache when files are created/deleted/renamed
    vscode.workspace.onDidCreateFiles(() => scheduleClearCacheAndRefresh()),
    vscode.workspace.onDidDeleteFiles(() => scheduleClearCacheAndRefresh()),
    vscode.workspace.onDidRenameFiles(() => scheduleClearCacheAndRefresh()),
    // Clear files cache when workspace folders are added, renamed or deleted
    vscode.workspace.onDidChangeWorkspaceFolders(() => scheduleClearCacheAndRefresh()),
  )

  updateContextInBackground()
}
