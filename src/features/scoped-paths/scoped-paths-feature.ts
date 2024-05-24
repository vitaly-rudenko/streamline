import * as vscode from 'vscode'
import { generateExcludedPaths } from './generate-excluded-paths'
import { readDirectory } from '../../utils/read-directory'
import { serializeExcludes } from './serialize-excludes'
import { getParents } from '../../utils/get-parents'
import { uriToPath } from '../../utils/uri'
import { unique } from '../../utils/unique'

export async function createScopedPathsFeature(input: {
  context: vscode.ExtensionContext
  onScopeChanged: (payload: vscode.Uri | vscode.Uri[] | undefined) => unknown
}) {
  const { context, onScopeChanged } = input

  const textStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 2)
  textStatusBarItem.command = 'streamline.scopedPaths.changeCurrentScope'
  context.subscriptions.push(textStatusBarItem)

  const buttonStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1)
  buttonStatusBarItem.command = 'streamline.scopedPaths.toggleScope'
  context.subscriptions.push(buttonStatusBarItem)

  let cachedEnabled = false
  let cachedScopedPaths: Set<string> = new Set()
  let cachedParentScopedPaths: Set<string> = new Set()

  function isScoped(path: string) {
    return cachedScopedPaths.has(path)
  }

  function isParentOfScoped(path: string) {
    return cachedParentScopedPaths.has(path)
  }

  async function toggleScopeForSelected(path: string) {
    const config = vscode.workspace.getConfiguration('streamline')
    const scopes = config.get<Record<string, string[]>>('scopedPaths.scopes', {})
    const currentScope = config.get<string>('scopedPaths.currentScope', 'default')

    const scopedPaths = scopes[currentScope] ?? []
    scopes[currentScope] = scopedPaths.includes(path)
      ? scopedPaths.filter(scopedPaths => scopedPaths !== path)
      : [...scopedPaths, path]

    await config.update('scopedPaths.scopes', scopes)
    await refresh()
  }

  async function refresh() {
    const config = vscode.workspace.getConfiguration('streamline')

    const scopes = config.get<Record<string, string[]>>('scopedPaths.scopes', {})
    const currentScope = config.get<string>('scopedPaths.currentScope', 'default')
    const enabled = config.get<boolean>('scopedPaths.enabled', false)

    const scopedPaths = scopes[currentScope] ?? []
    cachedEnabled = enabled
    cachedScopedPaths = new Set(scopedPaths)
    cachedParentScopedPaths = new Set(scopedPaths.flatMap(scopedPath => getParents(scopedPath)))

    try {
      const workspaceFilesConfig = vscode.workspace.getConfiguration('files', null)
      if (enabled) {
        const excludedPaths = await generateExcludedPaths(scopedPaths, readDirectory)
        const excludes = serializeExcludes({ excludedPaths })
        await workspaceFilesConfig.update('exclude', excludes, vscode.ConfigurationTarget.Workspace)
      } else {
        await workspaceFilesConfig.update('exclude', undefined, vscode.ConfigurationTarget.Workspace)
      }
    } catch (err) {
      console.warn('Could not update workspace configuration', err)
    }

    await vscode.commands.executeCommand('setContext', 'streamline.scopedPaths.enabled', enabled)

    textStatusBarItem.text = `Scope: ${currentScope}`
    textStatusBarItem.backgroundColor = enabled ? new vscode.ThemeColor('statusBarItem.warningBackground') : undefined
    textStatusBarItem.show()

    buttonStatusBarItem.text = enabled ? '$(pass-filled)' : '$(circle-large-outline)'
    buttonStatusBarItem.backgroundColor = enabled ? new vscode.ThemeColor('statusBarItem.warningBackground') : undefined
    buttonStatusBarItem.show()

    onScopeChanged(undefined)
  }

  context.subscriptions.push(
		vscode.commands.registerCommand('streamline.scopedPaths.scope', async () => {
      await vscode.workspace.getConfiguration('streamline').update('scopedPaths.enabled', true)
      await refresh()
		})
	)

	context.subscriptions.push(
		vscode.commands.registerCommand('streamline.scopedPaths.unscope', async () => {
      await vscode.workspace.getConfiguration('streamline').update('scopedPaths.enabled', false)
      await refresh()
		})
	)

  context.subscriptions.push(
		vscode.commands.registerCommand('streamline.scopedPaths.toggleScope', async () => {
      const config = vscode.workspace.getConfiguration('streamline')
      const enabled = config.get('scopedPaths.enabled', false)

      await config.update('scopedPaths.enabled', !enabled)
      await refresh()
		})
	)

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.scopedPaths.suggestScopes', async (file: vscode.Uri | undefined) => {
      file ||= vscode.window.activeTextEditor?.document.uri
      if (!file) return

      const path = uriToPath(file)
      if (!path) return

      const parents = getParents(path)

      const suggestedPaths = [...parents, path].filter(Boolean).sort((a, b) => b.length - a.length)
      if (suggestedPaths.length === 0) return

      const suggestedPath = await vscode.window.showQuickPick(suggestedPaths, { title: 'Select path to include into the scope' })
      if (!suggestedPath) return

      await toggleScopeForSelected(suggestedPath)
    })
  )

  // TODO: allow adding multiple selected files/folders to scope at once (in explorer)
  context.subscriptions.push(
		vscode.commands.registerCommand('streamline.scopedPaths.toggleScopeForSelected', async (file: vscode.Uri | undefined) => {
      file ||= vscode.window.activeTextEditor?.document.uri
      if (!file) return

			const path = uriToPath(file)
      if (!path) return

      await toggleScopeForSelected(path)
		})
	)

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.scopedPaths.changeCurrentScope', async () => {
      const config = vscode.workspace.getConfiguration('streamline')
      const scopes = config.get<Record<string, string[]>>('scopedPaths.scopes', {})

      let scope = await vscode.window.showQuickPick(
        unique(['default', ...Object.keys(scopes), '+ Add new scope']),
        { title: 'Select a scope' }
      )

      if (!scope) return

      if (scope === '+ Add new scope') {
        scope = await vscode.window.showInputBox({ prompt: 'Enter the name of new scope' })
        if (!scope) return
        await config.update('scopedPaths.scopes', { ...scopes, [scope]: [] })
      }

      await config.update('scopedPaths.currentScope', scope)
      await refresh()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.scopedPaths.clearCurrentScope', async () => {
      const config = vscode.workspace.getConfiguration('streamline')
      const scopes = config.get<Record<string, string[]>>('scopedPaths.scopes', {})
      const currentScope = config.get<string>('scopedPaths.currentScope', 'default')

      await config.update('scopedPaths.scopes', { ...scopes, [currentScope]: [] })
      await refresh()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.scopedPaths.refresh', async () => {
      await refresh()
    })
  )

  await refresh()

  return { isScoped, isParentOfScoped }
}