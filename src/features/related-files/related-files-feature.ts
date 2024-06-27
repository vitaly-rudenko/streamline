import * as vscode from 'vscode'
import { isMultiRootWorkspace } from '../../utils/is-multi-root-workspace'
import { RelatedFilesTreeDataProvider, type RelatedFileTreeItem, type WorkspaceFolderTreeItem } from './related-files-tree-data-provider'
import { RelatedFilesConfig } from './related-files-config'
import { getBasename } from '../../utils/get-basename'
import { createDebouncedFunction } from '../../utils/create-debounced-function'
import { unique } from '../../utils/unique'

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
      await vscode.commands.executeCommand('setContext', 'streamline.relatedFiles.viewRenderMode', config.getViewRenderMode())
    } catch (error) {
      console.warn('[ScopedPaths] Could not update context', error)
    }
  }

	context.subscriptions.push(vscode.window.registerTreeDataProvider('relatedFiles', relatedFilesTreeDataProvider))

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.relatedFiles.quickOpen', async (uri: vscode.Uri | undefined) => {
      uri ||= vscode.window.activeTextEditor?.document.uri
      if (!uri) return

      const workspaceFolder = !config.getUseGlobalSearch() && isMultiRootWorkspace()
        ? vscode.workspace.getWorkspaceFolder(uri)
        : undefined

      const basename = config.getUseStricterQuickOpenQuery()
        ? getBasename(uri.path)
        : getBasename(uri.path).replaceAll(/[-_]/g, '')

      const query = workspaceFolder ? `${workspaceFolder.name}/${basename}` : basename

      await vscode.commands.executeCommand('workbench.action.quickOpen', query)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.relatedFiles.refresh', () => {
      relatedFilesTreeDataProvider.clearCacheAndRefresh()
      updateContextInBackground()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.relatedFiles.openToSide', async (item?: RelatedFileTreeItem) => {
      if (!item?.resourceUri) return
      await vscode.commands.executeCommand('explorer.openToSide', item.resourceUri)
    })
  )

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

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.relatedFiles.setViewRenderModeToRelative', () => {
      config.setViewRenderMode('relative')
      relatedFilesTreeDataProvider.clearCacheAndRefresh()

      updateContextInBackground()
      config.saveInBackground()
    }),
    vscode.commands.registerCommand('streamline.relatedFiles.setViewRenderModeToAbsolute', () => {
      config.setViewRenderMode('absolute')
      relatedFilesTreeDataProvider.clearCacheAndRefresh()

      updateContextInBackground()
      config.saveInBackground()
    }),
    vscode.commands.registerCommand('streamline.relatedFiles.setViewRenderModeToCompact', () => {
      config.setViewRenderMode('compact')
      relatedFilesTreeDataProvider.clearCacheAndRefresh()

      updateContextInBackground()
      config.saveInBackground()
    })
  )

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
    vscode.window.onDidChangeActiveTextEditor(() => scheduleRefresh()),
    vscode.workspace.onDidCreateFiles(() => scheduleClearCacheAndRefresh()),
    vscode.workspace.onDidDeleteFiles(() => scheduleClearCacheAndRefresh()),
    vscode.workspace.onDidRenameFiles(() => scheduleClearCacheAndRefresh()),
    vscode.workspace.onDidChangeWorkspaceFolders(() => scheduleClearCacheAndRefresh()),
  )

  updateContextInBackground()
}
