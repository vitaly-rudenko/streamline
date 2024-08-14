import * as vscode from 'vscode'
import { pathToUri, uriToPath } from '../../utils/uri'
import { unique } from '../../utils/unique'
import { ScopedPathsConfig } from './scoped-paths-config'
import { createDebouncedFunction } from '../../utils/create-debounced-function'
import { CachedDirectoryReader } from '../../utils/cached-directory-reader'
import { generateExcludedPathsFromScopedAndExcludedPaths } from './generate-excluded-paths-from-scoped-and-excluded-paths'
import { QUICK_SCOPE_PREFIX } from './constants'

const SCOPED_PATHS_KEY = '__set_by_streamline__'

export function createScopedPathsFeature(input: {
  context: vscode.ExtensionContext
  onChange: () => unknown
}) {
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

  const scheduleClearCacheAndUpdateExcludes = createDebouncedFunction(() => {
    directoryReader.clearCache()
    updateContextInBackground()
    updateExcludesInBackground()
  }, 250)

  async function updateExcludesInBackground() {
    try {
      const workspaceConfig = await vscode.workspace.getConfiguration('files', null)
      const currentExcludes = workspaceConfig.get('exclude', undefined)
      const isScopedPathsEnabled = currentExcludes?.[SCOPED_PATHS_KEY] === false

      if (config.getEnabled()) {
        const scopedAndExcludedPaths = config.getCachedCurrentlyScopedAndExcludedPaths()
        const excludedPaths = await generateExcludedPathsFromScopedAndExcludedPaths(scopedAndExcludedPaths, directoryReader)

        const excludes = {
          [SCOPED_PATHS_KEY]: false,
          '**/.git': true,
          '**/.svn': true,
          '**/.hg': true,
          '**/CVS': true,
          '**/.DS_Store': true,
          '**/Thumbs.db': true,
          ...Object.fromEntries(excludedPaths.map(excludedPath => [`${excludedPath}/**`, true]))
        }

        await workspaceConfig.update('exclude', excludes, vscode.ConfigurationTarget.Workspace)
      } else if (isScopedPathsEnabled) {
        // only remove current excludes when they're explicitly set by ScopedPaths feature
        // this prevents VS Code from creating .vscode/settings.json when it's not necessary
        await workspaceConfig.update('exclude', undefined, vscode.ConfigurationTarget.Workspace)
      }
    } catch (error) {
      console.warn('[ScopedPaths] Could not update workspace configuration', error)
    }
  }

  const enabledThemeColor = new vscode.ThemeColor('statusBarItem.warningBackground')
  function updateStatusBarItems() {
    textStatusBarItem.text = `Scope: ${config.getCurrentScope()}`
    textStatusBarItem.backgroundColor = config.getEnabled() && config.getHighlightStatusBarWhenEnabled() ? enabledThemeColor : undefined

    buttonStatusBarItem.command = config.getEnabled() ? 'streamline.scopedPaths.disableScope' : 'streamline.scopedPaths.enableScope'
    buttonStatusBarItem.text = config.getEnabled() ? '$(pass-filled)' : '$(circle-large-outline)'
    buttonStatusBarItem.backgroundColor = config.getEnabled() && config.getHighlightStatusBarWhenEnabled() ? enabledThemeColor : undefined
  }

  async function updateContextInBackground() {
    try {
      await vscode.commands.executeCommand('setContext', 'streamline.scopedPaths.enabled', config.getEnabled())

      const scopedPaths = config.getCachedCurrentlyScopedPaths().map(scopedPath => pathToUri(scopedPath)?.path).filter(Boolean)
      await vscode.commands.executeCommand('setContext', 'streamline.scopedPaths.scopedPaths', scopedPaths)

      const excludedPaths = config.getCachedCurrentlyExcludedPaths().map(excludedPath => pathToUri(excludedPath)?.path).filter(Boolean)
      await vscode.commands.executeCommand('setContext', 'streamline.scopedPaths.excludedPaths', excludedPaths)
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
    vscode.commands.registerCommand('streamline.scopedPaths.quickScopeIntoPath', async (uri: vscode.Uri | undefined, selectedUris: vscode.Uri[] | undefined) => {
      const paths = getTargetPathsForCommand(uri, selectedUris)
      if (paths.length === 0) return
      if (paths.length > 1) {
        await vscode.window.showWarningMessage('Only one path can be used for Quick Scope')
        return
      }

      config.setCurrentScope(`${QUICK_SCOPE_PREFIX}${paths[0]}`)
      config.setEnabled(true)
      onChange()

      updateStatusBarItems()
      updateContextInBackground()
      updateExcludesInBackground()
      config.saveInBackground()
    })
  )

  context.subscriptions.push(
		vscode.commands.registerCommand('streamline.scopedPaths.addPathToCurrentScope', async (uri: vscode.Uri | undefined, selectedUris: vscode.Uri[] | undefined) => {
      if (config.getDynamicIsInQuickScope()) {
        await vscode.window.showWarningMessage('Cannot modify Quick Scope')
        return
      }

			const scopedPathsToAdd = getTargetPathsForCommand(uri, selectedUris)
      if (scopedPathsToAdd.length === 0) return

      config.setScopesObject({
        ...config.getScopesObject(),
        [config.getCurrentScope()]: unique([
          ...config.getScopesObject()[config.getCurrentScope()] ?? [],
          ...scopedPathsToAdd,
        ])
      })
      onChange()

      updateContextInBackground()
      updateExcludesInBackground()
      config.saveInBackground()
		})
	)

  context.subscriptions.push(
		vscode.commands.registerCommand('streamline.scopedPaths.deletePathFromCurrentScope', async (uri: vscode.Uri | undefined, selectedUris: vscode.Uri[] | undefined) => {
      if (config.getDynamicIsInQuickScope()) {
        await vscode.window.showWarningMessage('Cannot modify Quick Scope')
        return
      }

      const scopedPathsToDelete = new Set(getTargetPathsForCommand(uri, selectedUris))
      if (scopedPathsToDelete.size === 0) return

      config.setScopesObject({
        ...config.getScopesObject(),
        [config.getCurrentScope()]: config.getScopesObject()[config.getCurrentScope()].filter(path => !scopedPathsToDelete.has(path)),
      })
      onChange()

      updateContextInBackground()
      updateExcludesInBackground()
      config.saveInBackground()
		})
	)

  // TODO: these two commands are identical to commands above except for '!' prefix
  context.subscriptions.push(
		vscode.commands.registerCommand('streamline.scopedPaths.excludePathFromCurrentScope', async (uri: vscode.Uri | undefined, selectedUris: vscode.Uri[] | undefined) => {
      if (config.getDynamicIsInQuickScope()) {
        await vscode.window.showWarningMessage('Cannot modify Quick Scope')
        return
      }

			const excludedPathsToAdd = getTargetPathsForCommand(uri, selectedUris).map(path => `!${path}`)
      if (excludedPathsToAdd.length === 0) return

      config.setScopesObject({
        ...config.getScopesObject(),
        [config.getCurrentScope()]: unique([
          ...config.getScopesObject()[config.getCurrentScope()] ?? [],
          ...excludedPathsToAdd,
        ])
      })
      onChange()

      updateContextInBackground()
      updateExcludesInBackground()
      config.saveInBackground()
		})
	)

  context.subscriptions.push(
		vscode.commands.registerCommand('streamline.scopedPaths.deletePathFromCurrentScope', async (uri: vscode.Uri | undefined, selectedUris: vscode.Uri[] | undefined) => {
      if (config.getDynamicIsInQuickScope()) {
        await vscode.window.showWarningMessage('Cannot modify Quick Scope')
        return
      }

      const excludedPathsToDelete = new Set(getTargetPathsForCommand(uri, selectedUris).map(path => `!${path}`))
      if (excludedPathsToDelete.size === 0) return

      config.setScopesObject({
        ...config.getScopesObject(),
        [config.getCurrentScope()]: config.getScopesObject()[config.getCurrentScope()].filter(path => !excludedPathsToDelete.has(path)),
      })
      onChange()

      updateContextInBackground()
      updateExcludesInBackground()
      config.saveInBackground()
		})
	)

  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.scopedPaths.changeCurrentScope', async () => {
      const scopes = Object.keys(config.getScopesObject())
      let selectedScope = await vscode.window.showQuickPick(
        unique([
          ...scopes.length === 0 ? ['default'] : [],
          ...scopes,
          config.getCurrentScope(),
          ...(vscode.workspace.workspaceFolders ?? []).map(wf => `${QUICK_SCOPE_PREFIX}${wf.name}`),
          '+ Add new scope'
        ]),
        { title: 'Select Scope' }
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
    vscode.commands.registerCommand('streamline.scopedPaths.clearCurrentScope', async () => {
      if (config.getDynamicIsInQuickScope()) {
        await vscode.window.showWarningMessage('Cannot modify Quick Scope')
        return
      }

      config.setScopesObject({ ...config.getScopesObject(), [config.getCurrentScope()]: [] })
      onChange()

      updateContextInBackground()
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
    vscode.workspace.onDidCreateFiles(() => scheduleClearCacheAndUpdateExcludes()),
    vscode.workspace.onDidRenameFiles(() => scheduleClearCacheAndUpdateExcludes()),
    vscode.workspace.onDidChangeWorkspaceFolders(() => scheduleClearCacheAndUpdateExcludes())
  )

  updateStatusBarItems()
  updateContextInBackground()
  updateExcludesInBackground()

  return {
    isPathCurrentlyScoped(path: string) {
      return config.getCachedCurrentlyScopedPathsSet().has(path)
    },
    isPathCurrentlyExcluded(path: string) {
      return config.getCachedCurrentlyExcludedPathsSet().has(path)
    },
    isParentOfCurrentlyScopedAndExcludedPaths(path: string) {
      return config.getCachedParentsOfCurrentlyScopedAndExcludedPathsSet().has(path)
    }
  }
}