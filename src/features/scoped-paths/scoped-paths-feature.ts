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
  textStatusBarItem.command = 'streamline.select-scope'
  context.subscriptions.push(textStatusBarItem)

  const buttonStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1)
  buttonStatusBarItem.command = 'streamline.toggle-scope'
  context.subscriptions.push(buttonStatusBarItem)

  let cachedScopeEnabled = false
  let cachedScopedPaths: Set<string> = new Set()
  let cachedParentScopedPaths: Set<string> = new Set()

  function isScoped(path: string) {
    return cachedScopedPaths.has(path)
  }

  function isParentOfScoped(path: string) {
    return cachedParentScopedPaths.has(path)
  }

  async function toggleScopeForFile(path: string) {
    const config = vscode.workspace.getConfiguration('streamline')
    const scopes = config.get<Record<string, string[]>>('scopes', {})
    const currentScope = config.get<string>('currentScope', 'default')

    const scopedPaths = scopes[currentScope] ?? []
    scopes[currentScope] = scopedPaths.includes(path)
      ? scopedPaths.filter(scopedPaths => scopedPaths !== path)
      : [...scopedPaths, path]

    await config.update('scopes', scopes)
  }

  async function refresh() {
    const config = vscode.workspace.getConfiguration('streamline')

    const scopes = config.get<Record<string, string[]>>('scopes', {})
    const currentScope = config.get<string>('currentScope', 'default')
    const scopeEnabled = config.get<boolean>('scopeEnabled', false)

    const scopedPaths = scopes[currentScope] ?? []
    cachedScopeEnabled = scopeEnabled
    cachedScopedPaths = new Set(scopedPaths)
    cachedParentScopedPaths = new Set(scopedPaths.flatMap(scopedPath => getParents(scopedPath)))

    try {
      const workspaceFilesConfig = vscode.workspace.getConfiguration('files', null)
      if (scopeEnabled) {
        const excludedPaths = await generateExcludedPaths(scopedPaths, readDirectory)
        const excludes = serializeExcludes({ excludedPaths })
        await workspaceFilesConfig.update('exclude', excludes, vscode.ConfigurationTarget.Workspace)
      } else {
        await workspaceFilesConfig.update('exclude', undefined, vscode.ConfigurationTarget.Workspace)
      }
    } catch (err) {
      console.warn('Could not update workspace configuration', err)
    }

    await vscode.commands.executeCommand('setContext', 'streamline.scopeEnabled', scopeEnabled)

    textStatusBarItem.text = `Scope: ${currentScope}`
    textStatusBarItem.backgroundColor = scopeEnabled ? new vscode.ThemeColor('statusBarItem.warningBackground') : undefined
    textStatusBarItem.show()

    buttonStatusBarItem.text = scopeEnabled ? '$(pass-filled)' : '$(circle-large-outline)'
    buttonStatusBarItem.backgroundColor = scopeEnabled ? new vscode.ThemeColor('statusBarItem.warningBackground') : undefined
    buttonStatusBarItem.show()

    onScopeChanged(undefined)
  }

  context.subscriptions.push(
		vscode.commands.registerCommand('streamline.scope', async () => {
      await vscode.workspace.getConfiguration('streamline').update('scopeEnabled', true)
			await refresh()
		})
	)

	context.subscriptions.push(
		vscode.commands.registerCommand('streamline.unscope', async () => {
      await vscode.workspace.getConfiguration('streamline').update('scopeEnabled', false)
		})
	)

  context.subscriptions.push(
		vscode.commands.registerCommand('streamline.toggle-scope', async () => {
      const config = vscode.workspace.getConfiguration('streamline')
      await config.update('scopeEnabled', !config.get('scopeEnabled', false))
		})
	)

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.suggest-scopes-for-file', async (file: vscode.Uri | undefined) => {
      file ||= vscode.window.activeTextEditor?.document.uri
      if (!file) return

      const path = uriToPath(file)
      if (!path) return

      console.log('Generating scope suggestions for', path)

      const parents = getParents(path)

      const suggestedPaths = [...parents, path].filter(Boolean).sort((a, b) => b.length - a.length)
      if (suggestedPaths.length === 0) return

      const suggestedPath = await vscode.window.showQuickPick(suggestedPaths, { title: 'Select path to include into the scope' })
      if (!suggestedPath) return

      console.log('Toggling scope for', suggestedPath)

      await toggleScopeForFile(suggestedPath)
    })
  )

  context.subscriptions.push(
		vscode.commands.registerCommand('streamline.toggle-scope-for-file', async (file: vscode.Uri | undefined) => {
      file ||= vscode.window.activeTextEditor?.document.uri
      if (!file) return

			const path = uriToPath(file)
      if (!path) return

      console.log('Toggling scope for', path)

      await toggleScopeForFile(path)
      await refresh()
		})
	)

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.select-scope', async () => {
      const config = vscode.workspace.getConfiguration('streamline')
      const scopes = config.get<Record<string, string[]>>('scopes', {})

      let scope = await vscode.window.showQuickPick(
        unique(['default', ...Object.keys(scopes), '+ Add new scope']),
        { title: 'Select a scope' }
      )

      if (!scope) return

      if (scope === '+ Add new scope') {
        scope = await vscode.window.showInputBox({ prompt: 'Enter the name of new scope' })
        if (!scope) return
        await config.update('scopes', { ...scopes, [scope]: [] })
      }

      await config.update('currentScope', scope)
      await refresh()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.clear-scope', async () => {
      const config = vscode.workspace.getConfiguration('streamline')
      const scopes = config.get<Record<string, string[]>>('scopes', {})
      const currentScope = config.get<string>('currentScope', 'default')

      await config.update('scopes', { ...scopes, [currentScope]: [] })
      await refresh()
    })
  )

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (
        event.affectsConfiguration('streamline.scopedPaths') ||
        event.affectsConfiguration('streamline.scopeEnabled')
      ) {
        await refresh()
      }
    }),
    vscode.workspace.onDidCreateFiles(async () => {
      if (cachedScopeEnabled) {
        await refresh()
      }
    }),
  )

  await refresh()

  return { isScoped, isParentOfScoped }
}