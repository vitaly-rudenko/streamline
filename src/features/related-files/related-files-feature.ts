import * as vscode from 'vscode'
import { isMultiRootWorkspace } from '../../utils/is-multi-root-workspace'
import { RelatedFilesTreeDataProvider, type RelatedFileTreeItem } from './related-files-tree-data-provider'
import { RelatedFilesConfig } from './related-files-config'
import { getBasename } from '../../utils/get-basename'
import { createDebouncedFunction } from '../../utils/create-debounced-function'

export function createRelatedFilesFeature(input: { context: vscode.ExtensionContext }) {
  const { context } = input

  const config = new RelatedFilesConfig()
  const relatedFilesTreeDataProvider = new RelatedFilesTreeDataProvider(config)

  const scheduleRefresh = createDebouncedFunction(() => relatedFilesTreeDataProvider.refresh(), 100)
  const scheduleClearCacheAndRefresh = createDebouncedFunction(() => relatedFilesTreeDataProvider.clearCacheAndRefresh(), 500)

  const scheduleConfigLoad = createDebouncedFunction(() => {
    if (!config.load()) return
    relatedFilesTreeDataProvider.clearCacheAndRefresh()
    updateContextInBackground()
  }, 500)

  async function updateContextInBackground() {
    try {
      await vscode.commands.executeCommand('setContext', 'streamline.relatedFiles.useExcludes', config.getUseExcludes())
      await vscode.commands.executeCommand('setContext', 'streamline.relatedFiles.useRelativePaths', config.getUseRelativePaths())
      await vscode.commands.executeCommand('setContext', 'streamline.relatedFiles.useGlobalSearch', config.getUseGlobalSearch())
      await vscode.commands.executeCommand('setContext', 'streamline.relatedFiles.useCompactPaths', config.getUseCompactPaths())
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
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.relatedFiles.enableUseRelativePaths', () => {
      config.setUseRelativePaths(true)
      relatedFilesTreeDataProvider.clearCacheAndRefresh()

      updateContextInBackground()
      config.saveInBackground()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.relatedFiles.disableUseRelativePaths', () => {
      config.setUseRelativePaths(false)
      relatedFilesTreeDataProvider.clearCacheAndRefresh()

      updateContextInBackground()
      config.saveInBackground()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.relatedFiles.enableUseCompactPaths', () => {
      config.setUseCompactPaths(true)
      relatedFilesTreeDataProvider.clearCacheAndRefresh()

      updateContextInBackground()
      config.saveInBackground()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.relatedFiles.disableUseCompactPaths', () => {
      config.setUseCompactPaths(false)
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
    })
  )

  context.subscriptions.push(
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
    })
  )

  context.subscriptions.push(
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
  )

  config.load()
  updateContextInBackground()
}
