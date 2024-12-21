import * as vscode from 'vscode'
import { createDebouncedFunction } from '../../utils/create-debounced-function'
import { SmartConfigConfig } from './smart-config-config'
import { getMatchingConfigNames } from './toolkit/get-matching-config-names'
import { SmartConfigWorkspaceState } from './smart-config-workspace-state'
import { Config, SmartConfigContext } from './common'
import { unique } from '../../utils/unique'

export function createSmartConfigFeature(input: {
  context: vscode.ExtensionContext
  dependencies: {
    getCurrentScope: () => string | undefined
    isScopeEnabled: () => boolean
  }
}) {
  const { context, dependencies } = input

  const config = new SmartConfigConfig()
  const workspaceState = new SmartConfigWorkspaceState(context.workspaceState)

  const scheduleConfigLoad = createDebouncedFunction(() => {
    if (!config.load()) return
    applyMatchingConfigsInBackground()
    updateStatusBarItems()
  }, 500)

  const scheduleRefresh = createDebouncedFunction(() => {
    applyMatchingConfigsInBackground()
    updateStatusBarItems()
  }, 100)

  /** Stores currently created toggle buttons in the status bar to be able to update them */
  let toggleItems: vscode.StatusBarItem[] = []

  /** Generates current context for rules to be matched against */
  function generateSmartConfigContext(): SmartConfigContext {
    return {
      languageId: vscode.window.activeTextEditor?.document.languageId,
      path: vscode.window.activeTextEditor?.document.uri.path,
      toggles: workspaceState.getToggles(),
      colorThemeKind: vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark ? 'dark'
        : vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.HighContrast ? 'high-contrast'
        : vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Light ? 'light'
        : 'high-contrast-light',
      scopeSelected: dependencies.getCurrentScope(),
      scopeEnabled: dependencies.isScopeEnabled(),
    }
  }

  // TODO: avoid unnecessary updates (check by toggle changes)
  // Creates toggle buttons in the status bar
  function updateStatusBarItems() {
    // Delete all current toggle buttons
    for (const item of toggleItems) item.dispose()

    // Create new toggle buttons
    toggleItems = []
    for (const [i, toggle] of config.getMergedToggles().entries()) {
      const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 11 + i)
      item.name = `Toggle "${toggle}"`
      item.text = `${workspaceState.getToggles().includes(toggle) ? '$(circle-filled)' : '$(circle-outline)'}${toggle}`
      item.command = {
        command: 'streamline.smartConfig.toggle',
        title: toggle,
        arguments: [toggle],
      }
      context.subscriptions.push(item)
      item.show()

      toggleItems.push(item)
    }
  }

  // TODO: avoid unnecessary updates (check by context changes)
  /** Applies matching configs for each configuration target */
  async function applyMatchingConfigsInBackground() {
    const ctx = generateSmartConfigContext()

    const matchingConfigNames = getMatchingConfigNames(ctx, config.getMergedRules())

    await applyMatchingConfigsForConfigurationTarget(
      config.getInspectedDefaults()?.globalValue,
      config.getInspectedConfigs()?.globalValue,
      matchingConfigNames,
      vscode.ConfigurationTarget.Global
    )

    await applyMatchingConfigsForConfigurationTarget(
      config.getInspectedDefaults()?.workspaceValue,
      config.getInspectedConfigs()?.workspaceValue,
      matchingConfigNames,
      vscode.ConfigurationTarget.Workspace
    )

    await applyMatchingConfigsForConfigurationTarget(
      config.getInspectedDefaults()?.workspaceFolderValue,
      config.getInspectedConfigs()?.workspaceFolderValue,
      matchingConfigNames,
      vscode.ConfigurationTarget.WorkspaceFolder
    )
  }

  /** Apply sections from all matching configs in a given configuration target and remove all other sections */
  async function applyMatchingConfigsForConfigurationTarget(
    defaultConfigInTarget: Config | undefined,
    allConfigsInTarget: Record<string, Config> | undefined,
    matchingConfigNames: string[],
    target: vscode.ConfigurationTarget
  ) {
    if (!defaultConfigInTarget && !allConfigsInTarget) return

    defaultConfigInTarget ??= {}
    allConfigsInTarget ??= {}

    const vscodeConfig = vscode.workspace.getConfiguration()

    // TODO: can be cached
    // All sections that can potentially be set in this configuration target
    const allSectionsInTarget = unique([defaultConfigInTarget, ...Object.values(allConfigsInTarget)].flatMap(config => Object.keys(config))) satisfies string[]

    // Merge all matching configs into one, overriding sections when necessary
    const mergedConfigs = matchingConfigNames.reduce<Config>((mergedConfigs, configName) => ({ ...mergedConfigs, ...allConfigsInTarget[configName] }), { ...defaultConfigInTarget })

    for (const section of allSectionsInTarget) {
      const value: any | undefined = mergedConfigs[section]

      // Value may be undefined if not set by any matching config
      // This is expected behavior, and the section will be removed if value is undefined
      await safelyUpdateSectionIfNecessary(vscodeConfig, section, value === '__unset_by_streamline__' ? undefined : value, target)
    }
  }

  /** Updates section in a given configuration target if value has changed */
  async function safelyUpdateSectionIfNecessary(
    vscodeConfig: vscode.WorkspaceConfiguration,
    section: string,
    newValue: object | undefined,
    target: vscode.ConfigurationTarget
  ) {
    const inspected = vscodeConfig.inspect(section)
    const oldValue = target === vscode.ConfigurationTarget.Global ? inspected?.globalValue
      : target === vscode.ConfigurationTarget.Workspace ? inspected?.workspaceValue
      : inspected?.workspaceFolderValue

    if (oldValue !== newValue) {
      try {
        await vscodeConfig.update(section, newValue, target)
        console.debug('[SmartConfig] Setting section', section, 'to value', newValue, 'in target', target)
      } catch (error: any) {
        console.warn('[SmartConfig] Could not set section', section, 'to value', newValue, 'in target', target, 'due to', error)
      }
    }
  }

  // Command for toggle buttons in the status bar
  context.subscriptions.push(
    vscode.commands.registerCommand('streamline.smartConfig.toggle', (toggle: string) => {
      if (workspaceState.getToggles().includes(toggle)) {
        workspaceState.setToggles(workspaceState.getToggles().filter(t => t !== toggle))
      } else {
        workspaceState.setToggles([...workspaceState.getToggles(), toggle])
      }

      scheduleRefresh()
    }),
  )

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('streamline.smartConfig')) {
        if (!config.isSavingInBackground) {
          scheduleConfigLoad()
        }
      }
    }),
    vscode.window.onDidChangeActiveTextEditor(() => scheduleRefresh()),
    vscode.window.onDidChangeActiveColorTheme(() => scheduleRefresh()),
  )

  scheduleRefresh()

  return {
    scheduleRefresh,
  }
}