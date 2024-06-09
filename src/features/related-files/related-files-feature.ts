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
  const scheduleClearCacheAndRefresh = createDebouncedFunction(() => relatedFilesTreeDataProvider.clearCacheAndRefresh(), 1_000)

  const scheduleConfigLoad = createDebouncedFunction(() => {
    if (!config.load()) return
    relatedFilesTreeDataProvider.clearCacheAndRefresh()
  }, 1_000)

	context.subscriptions.push(vscode.window.registerTreeDataProvider('relatedFiles', relatedFilesTreeDataProvider))

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.relatedFiles.quickOpen', async (uri: vscode.Uri | undefined) => {
      uri ||= vscode.window.activeTextEditor?.document.uri
      if (!uri) return

      const basename = getBasename(uri.path)
      const workspaceFolder = isMultiRootWorkspace() ? vscode.workspace.getWorkspaceFolder(uri) : undefined
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
    vscode.commands.registerCommand('streamline.relatedFiles.toggleUseRelativePaths', () => {
      config.setUseRelativePaths(!config.getUseRelativePaths())
      relatedFilesTreeDataProvider.clearCacheAndRefresh()

      config.saveInBackground()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.relatedFiles.toggleUseExcludes', () => {
      config.setUseExcludes(!config.getUseExcludes())
      relatedFilesTreeDataProvider.clearCacheAndRefresh()

      config.saveInBackground()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.relatedFiles.copyPath', async (relatedFileTreeItem: RelatedFileTreeItem) => {
      await vscode.env.clipboard.writeText(relatedFileTreeItem.label)
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
}
