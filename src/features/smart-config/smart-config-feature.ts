import * as vscode from 'vscode'
import { createDebouncedFunction } from '../../utils/create-debounced-function'
import { SmartConfigConfig } from './smart-config-config'
import { getMatchingConfigNames } from './toolkit/get-matching-config-names'
import { SmartConfigWorkspaceState } from './smart-config-workspace-state'
import { Config, SmartConfigContext } from './common'

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
    updateRelevantConfigsInBackground()
    updateStatusBarItems()
  }, 500)

  const scheduleRefresh = createDebouncedFunction(() => {
    updateRelevantConfigsInBackground()
    updateStatusBarItems()
  }, 100)

  let toggleItems: vscode.StatusBarItem[] = []

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

  function updateStatusBarItems() {
    const toggles = [...new Set([
      ...config.getInspectedToggles()?.globalValue ?? [],
      ...config.getInspectedToggles()?.workspaceValue ?? [],
      ...config.getInspectedToggles()?.workspaceFolderValue ?? [],
    ])]

    for (const item of toggleItems) item.dispose()

    toggleItems = []
    for (const [i, toggle] of toggles.entries()) {
      const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 11 + i)
      item.name = `Toggle "${toggle}"`
      item.text = toggle
      item.command = {
        command: 'streamline.smartConfig.toggle',
        title: toggle,
        arguments: [toggle],
      }
      context.subscriptions.push(item)
      item.show()

      // TODO: Use icon instead of background
      if (workspaceState.getToggles().includes(toggle)) {
        item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground')
      }

      toggleItems.push(item)
    }

    const ctx = generateSmartConfigContext()

    const configNames = [...new Set([
      ...getMatchingConfigNames(ctx, config.getInspectedRules()?.globalValue ?? []),
      ...getMatchingConfigNames(ctx, config.getInspectedRules()?.workspaceValue ?? []),
      ...getMatchingConfigNames(ctx, config.getInspectedRules()?.workspaceFolderValue ?? []),
    ])]
  }

  async function updateRelevantConfigsInBackground() {
    const ctx = generateSmartConfigContext()

    console.debug('Context:', ctx)

    // TODO: optimize

    await applyConfigs(
      config.getInspectedDefaults()?.globalValue,
      getMatchingConfigNames(ctx, config.getInspectedRules()?.globalValue ?? [])
        .map(configName => config.getInspectedConfigs()?.globalValue?.[configName])
        .filter(config => config !== undefined),
      vscode.ConfigurationTarget.Global
    )

    await applyConfigs(
      config.getInspectedDefaults()?.workspaceValue,
      getMatchingConfigNames(ctx, config.getInspectedRules()?.workspaceValue ?? [])
        .map(configName => config.getInspectedConfigs()?.workspaceValue?.[configName])
        .filter(config => config !== undefined),
      vscode.ConfigurationTarget.Global
    )

    await applyConfigs(
      config.getInspectedDefaults()?.workspaceFolderValue,
      getMatchingConfigNames(ctx, config.getInspectedRules()?.workspaceFolderValue ?? [])
        .map(configName => config.getInspectedConfigs()?.workspaceFolderValue?.[configName])
        .filter(config => config !== undefined),
      vscode.ConfigurationTarget.Global
    )
  }

  async function applyConfigs(
    defaultConfig: Config | undefined,
    configs: Config[],
    target: vscode.ConfigurationTarget
  ) {
    const startedAt = Date.now()
    console.debug('Applying configs, default:', defaultConfig, 'and', configs.length, 'custom configs to', target)

    const vscodeConfig = vscode.workspace.getConfiguration()

    const configsToApply = [...configs]
    if (defaultConfig) configsToApply.unshift(defaultConfig)

    const mergedConfigToApply = Object.assign({}, ...configsToApply)
    const remainingSectionsSet = new Set(configs.flatMap(config => Object.keys(config)))

    for (const [section, value] of Object.entries(mergedConfigToApply)) {
      try {
        await updateConfigIfNecessary(vscodeConfig, section, value === '__unset_by_streamline__' ? undefined : value, target)
      } catch (error: any) {
        console.warn(error.message)
      }

      remainingSectionsSet.delete(section)
    }

    for (const section of remainingSectionsSet) {
      try {
        await updateConfigIfNecessary(vscodeConfig, section, undefined, target)
      } catch (error: any) {
        console.warn(error.message)
      }
    }

    console.debug('Applied configs, default:', defaultConfig, 'and', configs.length, 'custom configs to', target, 'in', ((Date.now() - startedAt) / 1000).toFixed(1), 'seconds')
  }

  async function updateConfigIfNecessary(vscodeConfig: vscode.WorkspaceConfiguration, section: string, newValue: any, target: vscode.ConfigurationTarget) {
    const inspected = vscodeConfig.inspect(section)
    const oldValue = target === vscode.ConfigurationTarget.Global
      ? inspected?.globalValue
      : target === vscode.ConfigurationTarget.Workspace
      ? inspected?.workspaceValue
      : inspected?.workspaceFolderValue

    if (oldValue === newValue) {
      console.debug('[SmartConfig] Skipping section', section, 'with value', newValue, 'in target', target)
      return
    }

    console.debug('[SmartConfig] Setting section', section, 'to value', newValue, 'in target', target)
    await vscodeConfig.update(section, newValue, target)
  }

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