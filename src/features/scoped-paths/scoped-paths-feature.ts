import * as vscode from 'vscode'
import { generateExcludedPaths } from './generate-excluded-paths'
import { serializeExcludes } from './serialize-excludes'
import { getParents } from '../../utils/get-parents'
import { uriToPath } from '../../utils/uri'
import { unique } from '../../utils/unique'
import { CachedDirectoryReader } from '../../utils/cached-directory-reader'
import { ScopedPathsStorage } from './scoped-paths-storage'
import { config } from '../../config'



export async function createScopedPathsFeature(input: {
  context: vscode.ExtensionContext
  onScopeChanged: (payload: vscode.Uri | vscode.Uri[] | undefined) => unknown
}) {
  const { context, onScopeChanged } = input

  const textStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 2)
  textStatusBarItem.command = 'streamline.scopedPaths.changeCurrentScope'
  context.subscriptions.push(textStatusBarItem)
  textStatusBarItem.show()

  const buttonStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1)
  buttonStatusBarItem.command = 'streamline.scopedPaths.toggleScope'
  context.subscriptions.push(buttonStatusBarItem)
  buttonStatusBarItem.show()

  let enabled = config.get<boolean>('scopedPaths.enabled', false)
  let currentScope = config.get<string>('scopedPaths.currentScope', 'default')
  let scopedPathsStorage = new ScopedPathsStorage(config.get<string[]>(`scopedPaths.scopes.${currentScope}`, []))
  const directoryReader = new CachedDirectoryReader()

  function isScoped(path: string) {
    return scopedPathsStorage.isScoped(path)
  }

  function isParentOfScoped(path: string) {
    return scopedPathsStorage.isParentOfScoped(path)
  }

  async function updateExcludes() {
    try {
      const workspaceFilesConfig = vscode.workspace.getConfiguration('files', null)

      if (enabled) {
        const excludedPaths = await generateExcludedPaths(scopedPathsStorage.export(), directoryReader)
        const excludes = serializeExcludes({ excludedPaths })
        await workspaceFilesConfig.update('exclude', excludes, vscode.ConfigurationTarget.Workspace)
      } else {
        await workspaceFilesConfig.update('exclude', undefined, vscode.ConfigurationTarget.Workspace)
      }
    } catch (err) {
      console.warn('Could not update workspace configuration', err)
    }
  }

  function updateStatusBarItems() {
    textStatusBarItem.text = `Scope: ${currentScope}`
    textStatusBarItem.backgroundColor = enabled ? new vscode.ThemeColor('statusBarItem.warningBackground') : undefined

    buttonStatusBarItem.text = enabled ? '$(pass-filled)' : '$(circle-large-outline)'
    buttonStatusBarItem.backgroundColor = enabled ? new vscode.ThemeColor('statusBarItem.warningBackground') : undefined
  }

  async function updateContext() {
    await vscode.commands.executeCommand('setContext', 'streamline.scopedPaths.enabled', enabled)
  }

  async function setEnabled(value: boolean) {
    enabled = value

    updateStatusBarItems()

    await updateContext()
    await updateExcludes()
    await config.update('scopedPaths.enabled', enabled)
  }

  context.subscriptions.push(
		vscode.commands.registerCommand('streamline.scopedPaths.scope', async () => {
      await setEnabled(true)
		})
	)

	context.subscriptions.push(
		vscode.commands.registerCommand('streamline.scopedPaths.unscope', async () => {
      await setEnabled(false)
		})
	)

  context.subscriptions.push(
		vscode.commands.registerCommand('streamline.scopedPaths.toggleScope', async () => {
      await setEnabled(!enabled)
		})
	)

  // TODO: allow adding multiple selected files/folders to scope at once (in explorer)
  context.subscriptions.push(
		vscode.commands.registerCommand('streamline.scopedPaths.toggleScopeForPath', async (uri: vscode.Uri | undefined) => {
      uri ||= vscode.window.activeTextEditor?.document.uri
      if (!uri) return

			const path = uriToPath(uri)
      if (!path) return

      if (scopedPathsStorage.has(path)) {
        scopedPathsStorage.remove(path)
      } else {
        scopedPathsStorage.add(path)
      }

      onScopeChanged(uri)
      await updateExcludes()
      await config.update(`scopedPaths.scopes.${currentScope}`, scopedPathsStorage.export())
		})
	)

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.scopedPaths.changeCurrentScope', async () => {
      const scopes = config.get<Record<string, string[]>>('scopedPaths.scopes', {})

      let scope = await vscode.window.showQuickPick(
        unique(['default', ...Object.keys(scopes), '+ Add new scope']),
        { title: 'Select a scope' }
      )

      if (!scope) return

      if (scope === '+ Add new scope') {
        scope = await vscode.window.showInputBox({ prompt: 'Enter the name of new scope' })
        if (!scope) return
      }

      currentScope = scope
      scopedPathsStorage = new ScopedPathsStorage(config.get<string[]>(`scopedPaths.scopes.${currentScope}`, []))

      onScopeChanged(undefined)
      await updateExcludes()
      await config.update('scopedPaths.currentScope', scope)
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.scopedPaths.clearCurrentScope', async () => {
      scopedPathsStorage = new ScopedPathsStorage([])

      onScopeChanged(undefined)
      await updateExcludes()
      await config.update(`scopedPaths.scopes.${currentScope}`, [])
    })
  )

  context.subscriptions.push(
    vscode.workspace.onDidCreateFiles(() => directoryReader.clearCache()),
    vscode.workspace.onDidRenameFiles(() => directoryReader.clearCache()),
  )

  updateStatusBarItems()
  await updateContext()

  return { isScoped, isParentOfScoped }
}