import * as vscode from 'vscode'
import { generateExcludedPaths } from './generate-excluded-paths'
import { serializeExcludes } from './serialize-excludes'
import { uriToPath } from '../../utils/uri'
import { unique } from '../../utils/unique'
import { CachedDirectoryReader } from '../../utils/cached-directory-reader'
import { ScopedPathsConfig } from './scoped-paths-config'
import { createDebouncedFunction } from '../../utils/create-debounced-function'

export function createScopedPathsFeature(input: { context: vscode.ExtensionContext, onChange: () => unknown }) {
  const { context, onChange } = input

  const textStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 2)
  textStatusBarItem.command = 'streamline.scopedPaths.changeCurrentScope'
  context.subscriptions.push(textStatusBarItem)
  textStatusBarItem.show()

  const buttonStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1)
  context.subscriptions.push(buttonStatusBarItem)
  buttonStatusBarItem.show()

  const config = new ScopedPathsConfig()
  const directoryReader = new CachedDirectoryReader()

  const scheduleConfigLoad = createDebouncedFunction(() => {
    if (!config.load()) return
    onChange()
    updateStatusBarItems()
    updateContextInBackground()
    updateExcludesInBackground()
  }, 500)

  async function updateExcludesInBackground() {
    try {
      let excludes: Record<string, unknown> | undefined = undefined
      if (config.getEnabled()) {
        const includedPaths = config.getCachedCurrentlyScopedPaths() ?? []
        const excludedPaths = await generateExcludedPaths(includedPaths, directoryReader)
        excludes = serializeExcludes({ excludedPaths, includedPaths })
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

    buttonStatusBarItem.command = config.getEnabled() ? 'streamline.scopedPaths.disableScope' : 'streamline.scopedPaths.enableScope'
    buttonStatusBarItem.text = config.getEnabled() ? '$(pass-filled)' : '$(circle-large-outline)'
    buttonStatusBarItem.backgroundColor = config.getEnabled() ? new vscode.ThemeColor('statusBarItem.warningBackground') : undefined
  }

  async function updateContextInBackground() {
    try {
      await vscode.commands.executeCommand('setContext', 'streamline.scopedPaths.enabled', config.getEnabled())
    } catch (error) {
      console.warn('[ScopedPaths] Could not update context', error)
    }
  }

  context.subscriptions.push(
		vscode.commands.registerCommand('streamline.scopedPaths.enableScope', () => {
      config.setEnabled(true)
      onChange()

      updateStatusBarItems()
      updateContextInBackground()
      updateExcludesInBackground()
      config.saveInBackground()
		})
	)

	context.subscriptions.push(
		vscode.commands.registerCommand('streamline.scopedPaths.disableScope', () => {
      config.setEnabled(false)
      onChange()

      updateStatusBarItems()
      updateContextInBackground()
      updateExcludesInBackground()
      config.saveInBackground()
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
		vscode.commands.registerCommand('streamline.scopedPaths.addPathToCurrentScope', (uri: vscode.Uri | undefined, selectedUris: vscode.Uri[] | undefined) => {
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

      updateExcludesInBackground()
      config.saveInBackground()
		})
	)

  context.subscriptions.push(
		vscode.commands.registerCommand('streamline.scopedPaths.deletePathFromCurrentScope', (uri: vscode.Uri | undefined, selectedUris: vscode.Uri[] | undefined) => {
      const paths = new Set(getTargetPathsForCommand(uri, selectedUris))
      if (paths.size === 0) return

      config.setScopesObject({
        ...config.getScopesObject(),
        [config.getCurrentScope()]: config.getCachedCurrentlyScopedPaths().filter(path => !paths.has(path)),
      })

      onChange()

      updateExcludesInBackground()
      config.saveInBackground()
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
      updateExcludesInBackground()
      config.saveInBackground()
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.scopedPaths.clearCurrentScope', () => {
      config.setScopesObject({ ...config.getScopesObject(), [config.getCurrentScope()]: [] })
      onChange()

      updateExcludesInBackground()
      config.saveInBackground()
    })
  )

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('streamline.scopedPaths')) {
        if (!config.isSavingInBackground) {
          scheduleConfigLoad()
        }
      }
    }),
    vscode.workspace.onDidCreateFiles(() => directoryReader.clearCache()),
    vscode.workspace.onDidRenameFiles(() => directoryReader.clearCache()),
  )

  config.load()
  updateStatusBarItems()
  updateContextInBackground()
  updateExcludesInBackground()

  return {
    isPathCurrentlyScoped(path: string) {
      return config.getCachedCurrentlyScopedPathsSet().has(path)
    },
    isParentOfCurrentlyScopedPaths(path: string) {
      return config.getCachedParentsOfCurrentlyScopedPathsSet().has(path)
    }
  }
}