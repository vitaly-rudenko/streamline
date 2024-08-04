import * as vscode from 'vscode'
import { uriToPath } from '../../utils/uri'
import { unique } from '../../utils/unique'
import { ScopedPathsConfig } from './scoped-paths-config'
import { createDebouncedFunction } from '../../utils/create-debounced-function'
import { CachedDirectoryReader } from '../../utils/cached-directory-reader'
import { generateExcludedPathsFromScopedPaths } from './generate-excluded-paths-from-scoped-paths'
import { WORKSPACE_FOLDER_SCOPE_PREFIX } from './constants'

const SCOPED_PATHS_KEY = '__set_by_scoped_paths__'

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
    updateExcludesInBackground()
  }, 250)

  async function updateExcludesInBackground() {
    try {
      const workspaceConfig = await vscode.workspace.getConfiguration('files', null)
      const currentExcludes = workspaceConfig.get('exclude', undefined)
      const isScopedPathsEnabled = currentExcludes?.[SCOPED_PATHS_KEY] === false

      if (config.getEnabled()) {
        const scopedPaths = config.getCachedCurrentlyScopedPaths() ?? []
        const excludedPaths = await generateExcludedPathsFromScopedPaths(scopedPaths, directoryReader)

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

        // TODO: test that workspace folder sorting is stable after using this feature

        if (config.getHideWorkspaceFolders()) {
          try {
            const currentWorkspaceFolders = vscode.workspace.workspaceFolders
            if (currentWorkspaceFolders) {
              const allWorkspaceFolders = getAllWorkspaceFolders()

              if (allWorkspaceFolders.length > 1) {
                config.setWorkspaceFoldersBackup(allWorkspaceFolders)
                await config.saveInBackground()

                const visibleWorkspaceFolders = config.getCachedCurrentlyScopedWorkspaceFolderNamesSet().size > 0
                  ? allWorkspaceFolders.filter(wf => config.getCachedCurrentlyScopedWorkspaceFolderNamesSet().has(wf.name))
                  : allWorkspaceFolders

                await vscode.workspace.updateWorkspaceFolders(0, currentWorkspaceFolders.length, ...visibleWorkspaceFolders)
              }
            }
          } catch (error) {
            console.warn('[ScopedPaths] Could not hide workspace folders', error)
          }
        }
      } else if (isScopedPathsEnabled) {
        // only remove current excludes when they're explicitly set by ScopedPaths feature
        // this prevents VS Code from creating .vscode/settings.json when it's not necessary
        await workspaceConfig.update('exclude', undefined, vscode.ConfigurationTarget.Workspace)

        if (config.getHideWorkspaceFolders()) {
          try {
            const workspaceFolders = vscode.workspace.workspaceFolders
            const workspaceFoldersBackup = config.getWorkspaceFoldersBackup()

            if (workspaceFolders && workspaceFoldersBackup.length > 0) {
              await vscode.workspace.updateWorkspaceFolders(0, workspaceFolders.length, ...workspaceFoldersBackup)

              config.setWorkspaceFoldersBackup([])
              await config.saveInBackground()
            }
          } catch (error) {
            console.warn('[ScopedPaths] Could not reset workspace folders', error)
          }
        }
      }
    } catch (error) {
      console.warn('[ScopedPaths] Could not update workspace configuration', error)
    }
  }


  function getAllWorkspaceFolders() {
    const currentWorkspaceFolders = vscode.workspace.workspaceFolders
    const workspaceFoldersBackup = config.getWorkspaceFoldersBackup()

    const allWorkspaceFolders = [...workspaceFoldersBackup, ...currentWorkspaceFolders ?? []]
      // deduplicate workspace folders
      .filter((workspaceFolder, index, workspaceFolders) => index === workspaceFolders.findIndex(wf => wf.uri.path === workspaceFolder.uri.path))
      // re-sort workspace folders
      .sort((a, b) => a.index - b.index)
      // update indexes, for new workspace folders and for existing ones,
      // because VS Code sometimes assigns identical index for multiple workspace folders
      .map((wf, index) => ({ ...wf, index }))

    return allWorkspaceFolders
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
    vscode.commands.registerCommand('streamline.scopedPaths.quickScopeIntoPath', (uri: vscode.Uri | undefined, selectedUris: vscode.Uri[] | undefined) => {
      const paths = getTargetPathsForCommand(uri, selectedUris)
      if (paths.length === 0) return
      if (paths.length > 1) {
        // TODO: warn that only one path can be used for quick scope
      }

      config.setCurrentScope(`${WORKSPACE_FOLDER_SCOPE_PREFIX}${paths[0]}`)
      config.setEnabled(true)
      onChange()

      updateStatusBarItems()
      updateContextInBackground()
      updateExcludesInBackground()
      config.saveInBackground()
    })
  )

  context.subscriptions.push(
		vscode.commands.registerCommand('streamline.scopedPaths.addPathToCurrentScope', (uri: vscode.Uri | undefined, selectedUris: vscode.Uri[] | undefined) => {
      // TODO: do not allow when quick scope is used
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
      // TODO: do not allow when quick scope is used
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
        unique([
          ...scopes,
          config.getCurrentScope(),
          ...scopes.length === 0 ? ['default'] : [],
          ...getAllWorkspaceFolders().map(wf => `${WORKSPACE_FOLDER_SCOPE_PREFIX}${wf.name}`),
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
    vscode.commands.registerCommand('streamline.scopedPaths.clearCurrentScope', () => {
      // TODO: do not allow when quick scope is used
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
    isParentOfCurrentlyScopedPaths(path: string) {
      return config.getCachedParentsOfCurrentlyScopedPathsSet().has(path)
    }
  }
}