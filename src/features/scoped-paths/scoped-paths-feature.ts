import * as vscode from 'vscode'
import { generateExcludedPaths } from './generate-excluded-paths'
import { readDirectory } from '../../utils/read-directory'
import { serializeExcludes } from './serialize-excludes'
import { getParents } from '../../utils/get-parents'
import { uriToPath } from '../../utils/uri'

export async function createScopedPathsFeature(input: {
  context: vscode.ExtensionContext
  onScopeChanged: (payload: vscode.Uri | vscode.Uri[] | undefined) => unknown
}) {
  const { context, onScopeChanged } = input
	const workspaceFilesConfig = vscode.workspace.getConfiguration('files', null)

  let cachedScopedPaths: Set<string> = new Set()
  let cachedParentScopedPaths: Set<string> = new Set()

  function isScoped(path: string) {
    return cachedScopedPaths.has(path)
  }

  function isParentOfScoped(path: string) {
    return cachedParentScopedPaths.has(path)
  }

  async function toggleScopeForFile(path: string) {
    const scopedPaths = await vscode.workspace.getConfiguration('streamline').get<string[]>('scopedPaths', [])
    await vscode.workspace.getConfiguration('streamline').update(
      'scopedPaths',
      scopedPaths.includes(path)
        ? scopedPaths.filter(scopedPaths => scopedPaths !== path)
        : [...scopedPaths, path],
    )
  }

  async function refresh() {
    const config = vscode.workspace.getConfiguration('streamline')

    const scopedPaths = config.get<string[]>('scopedPaths', [])
    const scopeEnabled = config.get<boolean>('scopeEnabled', false)

    cachedScopedPaths = new Set(scopedPaths)
    cachedParentScopedPaths = new Set(scopedPaths.flatMap(scopedPath => getParents(scopedPath)))

    if (scopeEnabled) {
      const excludedPaths = await generateExcludedPaths(scopedPaths, readDirectory)
      const excludes = serializeExcludes({ excludedPaths })
      await workspaceFilesConfig.update('exclude', excludes, vscode.ConfigurationTarget.Workspace)
    } else {
      await workspaceFilesConfig.update('exclude', undefined, vscode.ConfigurationTarget.Workspace)
    }

    await vscode.commands.executeCommand('setContext', 'streamline.scoped', scopeEnabled)

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
    vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (
        event.affectsConfiguration('streamline.scopedPaths') ||
        event.affectsConfiguration('streamline.scopeEnabled')
      ) {
        await refresh()
      }
    })
  )

  await refresh()

  return { isScoped, isParentOfScoped }
}