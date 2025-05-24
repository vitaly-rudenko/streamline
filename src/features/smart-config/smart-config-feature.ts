import * as vscode from 'vscode'
import { createDebouncedFunction } from '../../utils/create-debounced-function'
import { SmartConfigConfig } from './smart-config-config'
import { getMatchingConfigNames } from './toolkit/get-matching-config-names'
import { SmartConfigWorkspaceState } from './smart-config-workspace-state'
import { Config } from './common'
import { unique } from '../../utils/unique'
import { areArraysShallowEqual } from '../../utils/are-arrays-shallow-equal'
import { getInspectKeyFromConfigurationTarget } from '../../config'
import { GenerateConditionContext } from '../../generate-condition-context'
import { RegisterCommand } from '../../register-command'
import { UnsupportedTogglesError } from '../../common/when'

export function createSmartConfigFeature(input: {
  context: vscode.ExtensionContext
  registerCommand: RegisterCommand
  generateConditionContext: GenerateConditionContext,
}) {
  const { context, registerCommand, generateConditionContext } = input

  const config = new SmartConfigConfig()
  const workspaceState = new SmartConfigWorkspaceState(context.workspaceState)

  const scheduleConfigLoad = createDebouncedFunction(() => {
    if (!config.load()) return
    clearCache()
    applyMatchingConfigsInBackground()
    updateStatusBarItems()
  }, 500)

  const scheduleSoftRefresh = createDebouncedFunction(() => {
    applyMatchingConfigsInBackground()
    updateStatusBarItems()
  }, 100)

  const scheduleHardRefresh = createDebouncedFunction(() => {
    applyMatchingConfigsInBackground()
    updateStatusBarItems()
  }, 500)

  context.subscriptions.push(scheduleConfigLoad, scheduleSoftRefresh, scheduleHardRefresh)

  /** Stores currently created toggle buttons in the status bar to be able to update them */
  let toggleItems: vscode.StatusBarItem[] = []

  // Cache to avoid unnecessary updates to status bar items and configuration
  let cachedMergedToggles: string[] = []
  let cachedEnabledToggles: string[] = []
  let cachedMatchingConfigNames: string[] = []

  function clearCache() {
    cachedMergedToggles = []
    cachedEnabledToggles = []
    cachedMatchingConfigNames = []
  }

  // Creates toggle buttons in the status bar
  function updateStatusBarItems() {
    const mergedToggles = config.getMergedToggles()
    const enabledToggles = workspaceState.getEnabledToggles()

    if (
      areArraysShallowEqual(cachedEnabledToggles, enabledToggles)
      && areArraysShallowEqual(cachedMergedToggles, mergedToggles)
    ) return

    cachedMergedToggles = mergedToggles
    cachedEnabledToggles = enabledToggles

    // Delete all current toggle buttons
    for (const item of toggleItems) item.dispose()

    // Create new toggle buttons
    toggleItems = []
    for (const [i, toggle] of mergedToggles.entries()) {
      // 'Enable $(split-horizontal)' -> 'Enable Split Horizontal'
      const toggleName = toggle.replaceAll(/\$\((.+)\)/g, (_, m: string) => m[0].toUpperCase() + m.slice(1).replaceAll(/-./g, (m: string) => ' ' + m[1].toUpperCase()))

      const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 11 + i)
      item.name = `Smart Config: Toggle ${toggleName}`
      item.tooltip = `${enabledToggles.includes(toggle) ? 'Disable' : 'Enable'} ${toggleName}`
      item.text = `${enabledToggles.includes(toggle) ? '$(circle-filled)' : '$(circle-outline)'}${toggle}`
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

  /** Applies matching configs for each configuration target */
  async function applyMatchingConfigsInBackground() {
    try {
      const conditionContext = generateConditionContext(vscode.window.activeTextEditor)
      const matchingConfigNames = getMatchingConfigNames(conditionContext, config.getMergedRules(), config.getMergedToggles())

      if (areArraysShallowEqual(cachedMatchingConfigNames, matchingConfigNames)) return
      cachedMatchingConfigNames = matchingConfigNames

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
    } catch (error: any) {
      if (error instanceof UnsupportedTogglesError) {
        console.warn('[SmartConfig] Unsupported toggles:', error.toggles)
        vscode.window.showWarningMessage(error.message)
      } else {
        throw error
      }
    }
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

    // All sections that can potentially be set in this configuration target
    const allSectionsInTarget = unique([defaultConfigInTarget, ...Object.values(allConfigsInTarget)].flatMap(config => Object.keys(config))) satisfies string[]

    // Merge all matching configs into one, overriding sections when necessary
    const mergedMatchedConfigs = matchingConfigNames.reduce<Config>((mergedConfigs, configName) => ({ ...mergedConfigs, ...allConfigsInTarget[configName] }), { ...defaultConfigInTarget })

    console.debug(`[SmartConfig] Applying merged matched configs in target ${target}:`, mergedMatchedConfigs, allSectionsInTarget)

    for (const section of allSectionsInTarget) {
      const value: any | undefined = mergedMatchedConfigs[section]

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
    const oldValue = vscodeConfig.inspect(section)?.[getInspectKeyFromConfigurationTarget(target)]
    if (oldValue !== newValue) {
      try {
        await vscodeConfig.update(section, newValue, target)
      } catch (error: any) {
        console.warn('[SmartConfig] Could not set section', section, 'to value', newValue, 'in target', target, 'due to', error)
      }
    }
  }

  // Command for toggle buttons in the status bar
  registerCommand('streamline.smartConfig.toggle', async (toggle: string) => {
    if (workspaceState.getEnabledToggles().includes(toggle)) {
      workspaceState.setEnabledToggles(workspaceState.getEnabledToggles().filter(t => t !== toggle))
    } else {
      workspaceState.setEnabledToggles([...workspaceState.getEnabledToggles(), toggle])
    }

    scheduleSoftRefresh.schedule()
    await workspaceState.save()
  })

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('streamline.smartConfig')) {
        if (!config.isSavingInBackground) {
          scheduleConfigLoad.schedule()
        }
      }
    }),
    // Context to match rules against relies on currently active document and color theme
    vscode.window.onDidChangeActiveTextEditor(() => scheduleSoftRefresh.schedule()),
    vscode.window.onDidChangeActiveColorTheme(() => scheduleSoftRefresh.schedule()),
    vscode.window.onDidChangeWindowState(() => scheduleSoftRefresh.schedule()),
    vscode.window.onDidChangeTextEditorVisibleRanges(() => scheduleSoftRefresh.schedule()),
    vscode.debug.onDidChangeBreakpoints(() => scheduleSoftRefresh.schedule()),
    // Slower refresh rate to avoid performance issues
    vscode.window.onDidChangeTextEditorSelection(() => scheduleHardRefresh.schedule()),
  )

  scheduleSoftRefresh.schedule()

  return {
    scheduleRefresh: scheduleSoftRefresh,
    getEnabledToggles: () => workspaceState.getEnabledToggles(),
  }
}