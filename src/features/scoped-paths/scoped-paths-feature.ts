import * as vscode from 'vscode'
import { generateExcludedPaths } from './generate-excluded-paths'
import { readDirectory } from '../../utils/read-directory'
import { serializeExcludes } from './serialize-excludes'
import { unique } from '../../utils/unique'
import { getParents } from '../../utils/get-parents'

export async function createScopedPathsFeature(input: {
  context: vscode.ExtensionContext
  onScopeChanged: (payload: vscode.Uri | vscode.Uri[] | undefined) => unknown
}) {
  const { context, onScopeChanged } = input
	const workspaceFilesConfig = vscode.workspace.getConfiguration('files', null)

  let cachedUncertainScopedPaths: Set<string> = new Set()
  let cachedUncertainParentScopedPaths: Set<string> = new Set()

  function isScoped(uncertainPath: string) {
    return cachedUncertainScopedPaths.has(uncertainPath)
  }

  function isParentOfScoped(uncertainPath: string) {
    return cachedUncertainParentScopedPaths.has(uncertainPath)
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

    const uncertainScopedPaths = scopedPaths.map(scopedPath => scopedPath.endsWith('/') ? scopedPath.slice(0, -1) : scopedPath)
    cachedUncertainScopedPaths = new Set(uncertainScopedPaths)
    cachedUncertainParentScopedPaths = new Set(
      uncertainScopedPaths
        .flatMap(
          scopedPath => scopedPath
            .split('/')
            .map((_, i, parts) => parts.slice(0, i).join('/'))
        )
        .filter(Boolean)
    )

    await vscode.commands.executeCommand('setContext', 'streamline.scoped', scopeEnabled)

    let excludes = {}
    if (scopeEnabled) {
      const excludedPaths = await generateExcludedPaths(scopedPaths, readDirectory)

      // TODO: VS Code doesn't support excluding files in a specific workspace folder using workspace configuration.
      //       See https://github.com/microsoft/vscode/issues/82145.
      const excludedPathsWithoutWorkspaceFolder = unique(
        excludedPaths
          .map(excludedPath => excludedPath.split('/').slice(1).join('/'))
          .filter(Boolean)
      )

      excludes = serializeExcludes({ includedPaths: scopedPaths, excludedPaths: excludedPathsWithoutWorkspaceFolder })
    }
    await workspaceFilesConfig.update('exclude', excludes, vscode.ConfigurationTarget.Workspace)

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

      const workspaceFolder = vscode.workspace.workspaceFolders?.find(workspaceFolder => workspaceFolder.uri.path === file.path)
			const path = workspaceFolder
        ? workspaceFolder.name + '/'
        : vscode.workspace.asRelativePath(file) + ((await vscode.workspace.fs.stat(file)).type === vscode.FileType.Directory ? '/' : '')

      // TODO: Cannot scope workspace folder, so exclude it from the list
      const parents = getParents(path).filter(Boolean).sort((a, b) => b.length - a.length).slice(0, -1)
      const parent = await vscode.window.showQuickPick(parents, { title: 'Select path to Scope' })
      if (!parent) return

      await toggleScopeForFile(parent)
    })
  )

  context.subscriptions.push(
		vscode.commands.registerCommand('streamline.toggle-scope-for-file', async (file: vscode.Uri) => {
			const workspaceFolder = vscode.workspace.workspaceFolders?.find(workspaceFolder => workspaceFolder.uri.path === file.path)
			const path = workspaceFolder
        ? workspaceFolder.name + '/'
        : vscode.workspace.asRelativePath(file) + ((await vscode.workspace.fs.stat(file)).type === vscode.FileType.Directory ? '/' : '')

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