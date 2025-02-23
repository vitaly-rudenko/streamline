import * as vscode from 'vscode'
import { pathToUri } from '../../utils/uri'
import { unique } from '../../utils/unique'
import { ScopedPathsConfig } from './scoped-paths-config'
import { createDebouncedFunction } from '../../utils/create-debounced-function'
import { CachedDirectoryReader } from '../../utils/cached-directory-reader'
import { generateExcludedPathsFromScopedAndExcludedPaths } from './toolkit/generate-excluded-paths-from-scoped-and-excluded-paths'
import { BOOKMARKS_SCOPE, defaultCurrentScope, QUICK_SCOPE_PREFIX } from './common'
import { ScopedPathsWorkspaceState } from './scoped-paths-workspace-state'
import { ScopedPathsCache } from './scoped-paths-cache'
import { getTargetPathsForCommand } from './toolkit/get-target-paths-for-command'
import { getConfig, safeConfigInspect } from '../../config'
import { basename } from 'path'
import z from 'zod'
import { BookmarksFeature } from '../bookmarks/bookmarks-feature'

/** Set in "files.exclude" to ensure that current excludes were generated by Streamline */
const SCOPED_PATHS_KEY = '__set_by_streamline__'

/** Safely save workspace folders snapshot while this cooldown is active */
const APPLY_WORKSPACE_FOLDERS_COOLDOWN_MS = 3000

/*
From VS Code documentation:
- "Note: it is not valid to call updateWorkspaceFolders() multiple times without waiting for the onDidChangeWorkspaceFolders() to fire."
*/

export function createScopedPathsFeature(input: {
  context: vscode.ExtensionContext
  onChange: () => unknown
  bookmarksFeature: BookmarksFeature | undefined
}) {
  const { context, onChange, bookmarksFeature } = input

  const textStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 2)
  textStatusBarItem.name = 'Change Current Scope...'
  textStatusBarItem.command = 'streamline.scopedPaths.changeCurrentScope'
  context.subscriptions.push(textStatusBarItem)
  textStatusBarItem.show()

  const buttonStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1)
  buttonStatusBarItem.name = 'Toggle Current Scope'
  context.subscriptions.push(buttonStatusBarItem)
  buttonStatusBarItem.show()

  const config = new ScopedPathsConfig()
  const workspaceState = new ScopedPathsWorkspaceState(context.workspaceState)

  const cache = new ScopedPathsCache(config, workspaceState, bookmarksFeature)
  config.onChange = workspaceState.onChange = () => {
    cache.update()
    onChange()
  }

  const directoryReader = new CachedDirectoryReader()

  const scheduleConfigLoad = createDebouncedFunction(async () => {
    if (!config.load()) return
    updateStatusBarItems()
    directoryReader.clearCache()
    await updateContextInBackground()
    await updateExcludesInBackground()
  }, 500)

  const scheduleHardRefresh = createDebouncedFunction(async () => {
    updateStatusBarItems()
    directoryReader.clearCache()
    await updateContextInBackground()
    await updateExcludesInBackground()
  }, 250)

  const scheduleSoftRefresh = createDebouncedFunction(async () => {
    updateStatusBarItems()
    await updateContextInBackground()
    await updateExcludesInBackground()
  }, 250)

  /** Returns 'true' is excludes are currently set by the extension */
  function isScopedPathsEffectivelyEnabled() {
    const workspaceConfig = vscode.workspace.getConfiguration('files', null)
    const currentExcludes = workspaceConfig.get('exclude', undefined)
    return currentExcludes?.[SCOPED_PATHS_KEY] === false
  }

  /** Returns currently scoped workspace folders, but only ones that are valid in context of the current snapshot */
  function getScopedWorkspaceFolders(): vscode.WorkspaceFolder[] {
    const currentWorkspaceFoldersSnapshot = getCurrentWorkspaceFoldersSnapshot()
    const scopedWorkspaceFolderNames = cache.getCachedCurrentlyScopedWorkspaceFolderNames()

    return scopedWorkspaceFolderNames.length > 0
      ? currentWorkspaceFoldersSnapshot.filter(wf => scopedWorkspaceFolderNames.includes(wf.name))
      : currentWorkspaceFoldersSnapshot // Avoid removing all workspace folders if none are scoped
  }

  /** Stores timestamp of latest workspace folders change by the extension, used for cooldown */
  let appliedWorkspaceFoldersAt = Date.now()

  /** Updates current workspace folders to match 'expected' list of workspace folders (depending on whether scope is enabled in state) - only if necessary */
  function applyWorkspaceFolders() {
    if (!vscode.workspace.workspaceFolders) return // Do nothing when no workspace is opened

    const currentWorkspaceFolders = [...vscode.workspace.workspaceFolders]
    const expectedWorkspaceFolders = workspaceState.getEnabled()
      ? getScopedWorkspaceFolders()
      : getCurrentWorkspaceFoldersSnapshot()

    const requiresUpdate = currentWorkspaceFolders.length !== expectedWorkspaceFolders.length
                        || currentWorkspaceFolders.some(wf1 => expectedWorkspaceFolders.every(wf2 => wf1.uri.path !== wf2.uri.path))

    console.debug('[ScopedPaths] applyWorkspaceFolders()', {
      current: currentWorkspaceFolders.map(wf => wf.name),
      expected: expectedWorkspaceFolders.map(wf => wf.name),
      requiresUpdate,
    })

    if (requiresUpdate) {
      vscode.workspace.updateWorkspaceFolders(0, currentWorkspaceFolders.length, ...expectedWorkspaceFolders)
      appliedWorkspaceFoldersAt = Date.now()
      return true
    }

    return false
  }

  /** Updates "files.exclude" configuration based on the currently 'scoped paths' & 'excluded paths' */
  async function updateExcludesInBackground() {
    if (!vscode.workspace.workspaceFolders) return // Do nothing when no workspace is opened

    try {
      await saveCurrentWorkspaceFoldersSnapshot()

      const hasChanged = applyWorkspaceFolders()
      if (hasChanged) return // Retry automatically when onDidChangeWorkspaceFolders() triggers

      const workspaceConfig = vscode.workspace.getConfiguration('files', null)

      const scopedAndExcludedPaths = cache.getCachedCurrentlyScopedAndExcludedPaths()
      if (workspaceState.getEnabled() && scopedAndExcludedPaths.length > 0 /* avoid unnecessarily setting excludes when there is nothing to exclude */) {
        const excludedPaths = await generateExcludedPathsFromScopedAndExcludedPaths(
          scopedAndExcludedPaths,
          directoryReader,
          vscode.workspace.workspaceFolders.map(wf => wf.name),
        )

        const excludes = {
          // Special key to be able to detect that these excludes were indeed set by the extension
          [SCOPED_PATHS_KEY]: false,
          // These excludes are set by default in VS Code, so we want to keep them
          '**/.git': true,
          '**/.svn': true,
          '**/.hg': true,
          '**/CVS': true,
          '**/.DS_Store': true,
          '**/Thumbs.db': true,
          // Excludes generated by the extension
          ...Object.fromEntries(excludedPaths.map(excludedPath => [`${excludedPath}/**`, true]))
        }

        await workspaceConfig.update('exclude', excludes, vscode.ConfigurationTarget.Workspace)
      } else if (isScopedPathsEffectivelyEnabled()) {
        // Only remove current excludes when they're explicitly set by Streamline,
        // which prevents VS Code from creating ".vscode/settings.json" when it's not necessary
        await workspaceConfig.update('exclude', undefined, vscode.ConfigurationTarget.Workspace)
      }
    } catch (error) {
      console.warn('[ScopedPaths] Could not update workspace configuration', error)
    }
  }

  function updateStatusBarItems() {
    textStatusBarItem.text = workspaceState.getCurrentScope()

    buttonStatusBarItem.command = workspaceState.getEnabled() ? 'streamline.scopedPaths.disableScope' : 'streamline.scopedPaths.enableScope'
    buttonStatusBarItem.text = workspaceState.getEnabled() ? '$(pass-filled)' : '$(circle-large-outline)'
  }

  /** Create / update snapshot of 'current' workspace folders to be able to restore from it when unscoped */
  async function saveCurrentWorkspaceFoldersSnapshot() {
    if (!vscode.workspace.workspaceFolders) return // Do nothing when no workspace is opened

    // if not already saved, avoid unnecessarily saving snapshot if not scoped or if there's only one workspace folder
    if (!getConfig().inspect('scopedPaths.workspaceFoldersSnapshot')?.workspaceValue) {
      if (!workspaceState.getEnabled() && !isScopedPathsEffectivelyEnabled()) return
      if (vscode.workspace.workspaceFolders.length <= 1) return
    }

    let currentWorkspaceFolders: vscode.WorkspaceFolder[]

    // Safe mode:
    // If currently scoped (effectively or in state) or in cooldown, allow to only add new workspace folders to the snapshot
    // This prevents extension from permanently losing workspace folders from the snapshot
    if ((Date.now() - appliedWorkspaceFoldersAt) < APPLY_WORKSPACE_FOLDERS_COOLDOWN_MS
        || isScopedPathsEffectivelyEnabled()
        || workspaceState.getEnabled()) {
      currentWorkspaceFolders = [...getCurrentWorkspaceFoldersSnapshot()]

      for (const workspaceFolder of vscode.workspace.workspaceFolders) {
        if (currentWorkspaceFolders.every(wf => wf.uri.path !== workspaceFolder.uri.path)) {
          currentWorkspaceFolders.push(workspaceFolder)
        }
      }
    } else { // Otherwise, reflect current workspace folder list (unsafe mode)
      currentWorkspaceFolders = [...vscode.workspace.workspaceFolders]
    }

    console.debug('[ScopedPaths] saveCurrentWorkspaceFoldersSnapshot()', { currentWorkspaceFolders: currentWorkspaceFolders.map(wf => wf.name) })

    await getConfig().update(
      'scopedPaths.workspaceFoldersSnapshot',
      currentWorkspaceFolders
        // Sort by index generated by VS Code...
        .sort((a, b) => a.index - b.index)
        // But real index is still gonna be inferred from the saved order
        .map((workspaceFolder) => {
          // Do not save name if it matches basename from the path
          const generatedName = basename(workspaceFolder.uri.path)
          if (generatedName === workspaceFolder.name) {
            return workspaceFolder.uri.path
          }

          // Save path and custom name
          return `${workspaceFolder.uri.path}:${workspaceFolder.name}`
        }),
      vscode.ConfigurationTarget.Workspace, // Only makes sense in context of Workspace configuration
    )
  }

  function getCurrentWorkspaceFoldersSnapshot(): vscode.WorkspaceFolder[] {
    const inspectedSerializedWorkspaceFolders = safeConfigInspect(getConfig(), 'scopedPaths.workspaceFoldersSnapshot', z.array(z.string()))
    if (!inspectedSerializedWorkspaceFolders?.workspaceValue) {
      return [...vscode.workspace.workspaceFolders ?? []]
    }

    return inspectedSerializedWorkspaceFolders.workspaceValue
      .map((serializedWorkspaceFolder, index) => {
        if (serializedWorkspaceFolder.includes(':')) {
          const [path, ...nameParts] = serializedWorkspaceFolder.split(':')
          return {
            index,
            uri: vscode.Uri.parse(path),
            name: nameParts.join(':'),
          }
        }

        return {
          index,
          uri: vscode.Uri.parse(serializedWorkspaceFolder),
          name: basename(serializedWorkspaceFolder),
        }
      })
  }

  async function updateContextInBackground() {
    try {
      await vscode.commands.executeCommand('setContext', 'streamline.scopedPaths.enabled', workspaceState.getEnabled())

      const scopedPaths = cache.getCachedCurrentlyScopedPaths().map(scopedPath => pathToUri(scopedPath)?.path).filter(path => path !== undefined)
      await vscode.commands.executeCommand('setContext', 'streamline.scopedPaths.scopedPaths', scopedPaths satisfies string[])

      const excludedPaths = cache.getCachedCurrentlyExcludedPaths().map(excludedPath => pathToUri(excludedPath)?.path).filter(path => path !== undefined)
      await vscode.commands.executeCommand('setContext', 'streamline.scopedPaths.excludedPaths', excludedPaths satisfies string[])
    } catch (error) {
      console.warn('[ScopedPaths] Could not update context', error)
    }
  }

  // Activate current scope
  context.subscriptions.push(
		vscode.commands.registerCommand('streamline.scopedPaths.enableScope', async () => {
      workspaceState.setEnabled(true)

      updateStatusBarItems()
      updateContextInBackground()
      updateExcludesInBackground()
      await workspaceState.save()
		})
	)

  // Deactivate current scope
	context.subscriptions.push(
		vscode.commands.registerCommand('streamline.scopedPaths.disableScope', async () => {
      workspaceState.setEnabled(false)

      updateStatusBarItems()
      updateContextInBackground()
      updateExcludesInBackground()
      await workspaceState.save()
		})
	)

  // Create a Quick Scope from a selected path
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.scopedPaths.quickScopeIntoPath', async (uri: vscode.Uri | undefined, selectedUris: vscode.Uri[] | undefined) => {
      const paths = getTargetPathsForCommand(uri, selectedUris)
      if (paths.length === 0) return
      if (paths.length > 1) {
        vscode.window.showWarningMessage('Only one path can be used for Quick Scope')
        return
      }

      workspaceState.setCurrentScope(`${QUICK_SCOPE_PREFIX}${paths[0]}`)
      workspaceState.setEnabled(true)

      updateStatusBarItems()
      updateContextInBackground()
      updateExcludesInBackground()
      await workspaceState.save()
    })
  )

  // Add path to the current scope
  context.subscriptions.push(
		vscode.commands.registerCommand('streamline.scopedPaths.addPathToCurrentScope', async (uri: vscode.Uri | undefined, selectedUris: vscode.Uri[] | undefined) => {
      if (workspaceState.getDynamicIsInQuickScope()) {
        vscode.window.showWarningMessage('Cannot modify Quick Scope')
        return
      }

			const scopedPathsToAdd = getTargetPathsForCommand(uri, selectedUris)
      if (scopedPathsToAdd.length === 0) return

      config.setScopesObject({
        ...config.getScopesObject(),
        [workspaceState.getCurrentScope()]: unique([
          ...config.getScopesObject()[workspaceState.getCurrentScope()] ?? [],
          ...scopedPathsToAdd,
        ])
      })

      updateContextInBackground()
      updateExcludesInBackground()
      config.saveInBackground()
		})
	)

  // Delete path from the current scope
  context.subscriptions.push(
		vscode.commands.registerCommand('streamline.scopedPaths.deletePathFromCurrentScope', async (uri: vscode.Uri | undefined, selectedUris: vscode.Uri[] | undefined) => {
      if (workspaceState.getDynamicIsInQuickScope()) {
        vscode.window.showWarningMessage('Cannot modify Quick Scope')
        return
      }

      const scopedPathsToDelete = new Set(getTargetPathsForCommand(uri, selectedUris))
      if (scopedPathsToDelete.size === 0) return

      config.setScopesObject({
        ...config.getScopesObject(),
        [workspaceState.getCurrentScope()]: config.getScopesObject()[workspaceState.getCurrentScope()].filter(path => !scopedPathsToDelete.has(path)),
      })

      updateContextInBackground()
      updateExcludesInBackground()
      config.saveInBackground()
		})
	)

  // Exclude path from the current scope (not the same as deleting path from the current scope!)
  context.subscriptions.push(
		vscode.commands.registerCommand('streamline.scopedPaths.excludePathFromCurrentScope', async (uri: vscode.Uri | undefined, selectedUris: vscode.Uri[] | undefined) => {
      if (workspaceState.getDynamicIsInQuickScope()) {
        vscode.window.showWarningMessage('Cannot modify Quick Scope')
        return
      }

			const excludedPathsToAdd = getTargetPathsForCommand(uri, selectedUris).map(path => `!${path}`)
      if (excludedPathsToAdd.length === 0) return

      config.setScopesObject({
        ...config.getScopesObject(),
        [workspaceState.getCurrentScope()]: unique([
          ...config.getScopesObject()[workspaceState.getCurrentScope()] ?? [],
          ...excludedPathsToAdd,
        ])
      })

      updateContextInBackground()
      updateExcludesInBackground()
      config.saveInBackground()
		})
	)

  // Include previously 'excluded path' (not the same as adding path to the current scope!)
  context.subscriptions.push(
		vscode.commands.registerCommand('streamline.scopedPaths.includePathIntoCurrentScope', async (uri: vscode.Uri | undefined, selectedUris: vscode.Uri[] | undefined) => {
      if (workspaceState.getDynamicIsInQuickScope()) {
        vscode.window.showWarningMessage('Cannot modify Quick Scope')
        return
      }

      const excludedPathsToDelete = new Set(getTargetPathsForCommand(uri, selectedUris).map(path => `!${path}`))
      if (excludedPathsToDelete.size === 0) return

      config.setScopesObject({
        ...config.getScopesObject(),
        [workspaceState.getCurrentScope()]: config.getScopesObject()[workspaceState.getCurrentScope()].filter(path => !excludedPathsToDelete.has(path)),
      })

      updateContextInBackground()
      updateExcludesInBackground()
      config.saveInBackground()
		})
	)

  // Select current scope
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.scopedPaths.changeCurrentScope', async () => {
      const addNewScopeItem = '+ Add new scope'

      const scopes = Object.keys(config.getScopesObject())
      let selectedScope = await vscode.window.showQuickPick(
        unique([
          ...scopes.length === 0 ? [defaultCurrentScope] : [],
          ...scopes,
          workspaceState.getCurrentScope(),
          BOOKMARKS_SCOPE,
          addNewScopeItem,
        ]),
        { title: 'Select Scope' }
      )

      if (!selectedScope) return
      if (selectedScope === addNewScopeItem) {
        selectedScope = await vscode.window.showInputBox({ prompt: 'Enter the name of new scope' })
        if (!selectedScope) return
      }
      workspaceState.setCurrentScope(selectedScope)

      updateStatusBarItems()
      updateExcludesInBackground()
      await workspaceState.save()
    })
  )

  // Clear all files in current scope
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.scopedPaths.clearCurrentScope', async () => {
      if (workspaceState.getDynamicIsInQuickScope()) {
        vscode.window.showWarningMessage('Cannot modify Quick Scope')
        return
      }

      config.setScopesObject({ ...config.getScopesObject(), [workspaceState.getCurrentScope()]: [] })

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
    // Clear cache and re-generate excludes when files are created or renamed
    vscode.workspace.onDidCreateFiles(() => scheduleHardRefresh()),
    vscode.workspace.onDidRenameFiles(() => scheduleHardRefresh()),
    // Clear cache and re-generate excludes when workspace folders are added, renamed or deleted
    vscode.workspace.onDidChangeWorkspaceFolders(async () => {
      if (!vscode.workspace.workspaceFolders) return

      await saveCurrentWorkspaceFoldersSnapshot()
      scheduleHardRefresh()
    })
  )

  updateStatusBarItems()
  updateContextInBackground()
  updateExcludesInBackground()

  return {
    isScopeEnabled() {
      return workspaceState.getEnabled()
    },
    getCurrentScope() {
      return workspaceState.getCurrentScope()
    },
    isPathCurrentlyScoped(path: string) {
      return cache.getCachedCurrentlyScopedPathsSet().has(path)
    },
    isPathCurrentlyExcluded(path: string) {
      return cache.getCachedCurrentlyExcludedPathsSet().has(path)
    },
    isParentOfCurrentlyScopedAndExcludedPaths(path: string) {
      return cache.getCachedParentsOfCurrentlyScopedAndExcludedPathsSet().has(path)
    },
    // TODO: probably doesn't belong here, perhaps can be abstracted to be more generic & reusable (e.g. for highlighted paths too?)
    handleBookmarksChanged() {
      cache.update()
      scheduleSoftRefresh()
    }
  }
}