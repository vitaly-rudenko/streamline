import * as vscode from 'vscode'
import { generateExcludedPaths } from './generate-excluded-paths'
import { serializeExcludes } from './serialize-excludes'
import { uriToPath } from '../../utils/uri'
import { unique } from '../../utils/unique'
import { CachedDirectoryReader } from '../../utils/cached-directory-reader'
import { ScopedPathsConfig } from './scoped-paths-config'

export async function createScopedPathsFeature(input: {
  context: vscode.ExtensionContext
  onChange: () => unknown
}) {
  const { context, onChange } = input

  const textStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 2)
  textStatusBarItem.command = 'streamline.scopedPaths.changeCurrentScope'
  context.subscriptions.push(textStatusBarItem)
  textStatusBarItem.show()

  const buttonStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1)
  buttonStatusBarItem.command = 'streamline.scopedPaths.toggleScope'
  context.subscriptions.push(buttonStatusBarItem)
  buttonStatusBarItem.show()

  const config = new ScopedPathsConfig()
  const directoryReader = new CachedDirectoryReader()

  function isPathCurrentlyScoped(path: string) {
    return config.getCachedCurrentlyScopedPathsSet().has(path)
  }

  function isParentOfCurrentlyScopedPaths(path: string) {
    return config.getCachedParentsOfCurrentlyScopedPathsSet().has(path)
  }

  async function updateExcludes() {
    try {
      let excludes: Record<string, unknown> | undefined = undefined
      if (config.getEnabled()) {
        const excludedPaths = await generateExcludedPaths(config.getCachedCurrentlyScopedPaths() ?? [], directoryReader)
        excludes = serializeExcludes({ excludedPaths })
      }

      await vscode.workspace
        .getConfiguration('files', null)
        .update('exclude', excludes, vscode.ConfigurationTarget.Workspace)
    } catch (error) {
      console.warn('[ScopedPaths] Could not update workspace configuration', error)
    }
  }

  function updateStatusBarItems() {
    textStatusBarItem.text = `Scope: ${config.getCurrentScope()}`
    textStatusBarItem.backgroundColor = config.getEnabled() ? new vscode.ThemeColor('statusBarItem.warningBackground') : undefined

    buttonStatusBarItem.text = config.getEnabled() ? '$(pass-filled)' : '$(circle-large-outline)'
    buttonStatusBarItem.backgroundColor = config.getEnabled() ? new vscode.ThemeColor('statusBarItem.warningBackground') : undefined
  }

  async function updateContext() {
    try {
      await vscode.commands.executeCommand('setContext', 'streamline.scopedPaths.enabled', config.getEnabled())
    } catch (error) {
      console.warn('[ScopedPaths] Could not update context', error)
    }
  }

  async function setEnabled(value: boolean) {
    config.setEnabled(value)
    onChange()

    updateStatusBarItems()
    await updateContext()
    await updateExcludes()
    await config.save()
  }

  context.subscriptions.push(
		vscode.commands.registerCommand('streamline.scopedPaths.enableScope', async () => {
      await setEnabled(true)
		})
	)

	context.subscriptions.push(
		vscode.commands.registerCommand('streamline.scopedPaths.disableScope', async () => {
      await setEnabled(false)
		})
	)

  context.subscriptions.push(
		vscode.commands.registerCommand('streamline.scopedPaths.toggleScope', async() => {
      await setEnabled(!config.getEnabled())
		})
	)

  function getTargetPathsForCommand(uri: vscode.Uri | undefined, selectedUris: vscode.Uri[] | undefined) {
    let uris: vscode.Uri[] = []
    if (selectedUris && selectedUris.length > 0) {
      uris = selectedUris
    } else if (uri) {
      uris = [uri]
    } else if (vscode.window.activeTextEditor?.document.uri) {
      uris = [vscode.window.activeTextEditor.document.uri]
    }

    return uris.map(uri => uriToPath(uri)).filter((path): path is string => path !== undefined)
  }

  context.subscriptions.push(
		vscode.commands.registerCommand('streamline.scopedPaths.addPathToCurrentScope', async (uri: vscode.Uri | undefined, selectedUris: vscode.Uri[] | undefined) => {
			const paths = getTargetPathsForCommand(uri, selectedUris)
      if (paths.length === 0) return

      config.setScopesObject({
        ...config.getScopesObject(),
        [config.getCurrentScope()]: [
          ...config.getCachedCurrentlyScopedPaths(),
          ...paths.filter(path => !config.getCachedCurrentlyScopedPathsSet().has(path)),
        ]
      })

      onChange()

      await updateExcludes()
      await config.save()
		})
	)

  context.subscriptions.push(
		vscode.commands.registerCommand('streamline.scopedPaths.deletePathFromCurrentScope', async (uri: vscode.Uri | undefined, selectedUris: vscode.Uri[] | undefined) => {
      const paths = new Set(getTargetPathsForCommand(uri, selectedUris))
      if (paths.size === 0) return

      config.setScopesObject({
        ...config.getScopesObject(),
        [config.getCurrentScope()]: config.getCachedCurrentlyScopedPaths().filter(path => !paths.has(path)),
      })

      onChange()

      await updateExcludes()
      await config.save()
		})
	)

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.scopedPaths.changeCurrentScope', async () => {
      const scopes = Object.keys(config.getScopesObject())

      let selectedScope = await vscode.window.showQuickPick(
        unique(['default', ...scopes, config.getCurrentScope(), '+ Add new scope']),
        { title: 'Select a scope' }
      )

      if (!selectedScope) return

      if (selectedScope === '+ Add new scope') {
        selectedScope = await vscode.window.showInputBox({ prompt: 'Enter the name of new scope' })
        if (!selectedScope) return
      }

      config.setCurrentScope(selectedScope)
      onChange()

      updateStatusBarItems()
      await updateExcludes()
      await config.save()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.scopedPaths.clearCurrentScope', async () => {
      config.setScopesObject({
        ...config.getScopesObject(),
        [config.getCurrentScope()]: []
      })

      onChange()

      await updateExcludes()
      await config.save()
    })
  )

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (event.affectsConfiguration('streamline.scopedPaths')) {
        if (config.load()) {
          onChange()

          updateStatusBarItems()
          await updateContext()
          await updateExcludes()
        }
      }
    }),
    vscode.workspace.onDidCreateFiles(() => directoryReader.clearCache()),
    vscode.workspace.onDidRenameFiles(() => directoryReader.clearCache()),
  )

  config.load()
  updateStatusBarItems()
  await updateContext()
  await updateExcludes()

  return { isPathCurrentlyScoped, isParentOfCurrentlyScopedPaths }
}