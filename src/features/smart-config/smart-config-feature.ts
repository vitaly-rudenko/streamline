import * as vscode from 'vscode'
import { createDebouncedFunction } from '../../utils/create-debounced-function'
import { Config, SmartConfigConfig } from './smart-config-config'
import { getMatchingConfigNames, SmartConfigContext } from './get-matching-config-names'
import { SmartConfigWorkspaceState } from './smart-config-workspace-state'

export function createSmartConfigFeature(input: { context: vscode.ExtensionContext }) {
  const { context } = input

  const config = new SmartConfigConfig()
  const workspaceState = new SmartConfigWorkspaceState(context.workspaceState)

  const debouncedUpdateRelevantConfigs = createDebouncedFunction(updateRelevantConfigs, 250)

  const scheduleConfigLoad = createDebouncedFunction(() => {
    if (!config.load()) return
    debouncedUpdateRelevantConfigs()
  }, 500)

  const appliedConfigsStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 10)
  context.subscriptions.push(appliedConfigsStatusBarItem)

  let toggleItems: vscode.StatusBarItem[] = []

  async function updateStatusBarItems() {
    const toggles = [...new Set([
      ...config.getInspectedToggles()?.globalValue ?? [],
      ...config.getInspectedToggles()?.workspaceValue ?? [],
      ...config.getInspectedToggles()?.workspaceFolderValue ?? [],
    ])]

    for (const item of toggleItems) item.dispose()

    toggleItems = []
    for (const [i, toggle] of toggles.entries()) {
      const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 11 + i)
      item.text = toggle
      item.command = {
        command: 'streamline.smartConfig.toggle',
        title: toggle,
        arguments: [toggle],
      }
      context.subscriptions.push(item)
      item.show()

      if (workspaceState.getToggles().includes(toggle)) {
        item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground')
      }

      toggleItems.push(item)
    }

    const ctx: SmartConfigContext = {
      path: vscode.window.activeTextEditor?.document.uri.path,
      toggles: workspaceState.getToggles(),
    }

    const configNames = [...new Set([
      ...getMatchingConfigNames(ctx, config.getInspectedRules()?.globalValue ?? []),
      ...getMatchingConfigNames(ctx, config.getInspectedRules()?.workspaceValue ?? []),
      ...getMatchingConfigNames(ctx, config.getInspectedRules()?.workspaceFolderValue ?? []),
    ])]

    if (configNames.length > 0) {
      appliedConfigsStatusBarItem.text = '[' + configNames.join(', ') + ']'
      appliedConfigsStatusBarItem.show()
    } else {
      appliedConfigsStatusBarItem.hide()
    }
  }

  async function updateRelevantConfigs() {
    const ctx: SmartConfigContext = {
      path: vscode.window.activeTextEditor?.document.uri.path,
      toggles: workspaceState.getToggles(),
    }

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
    vscode.commands.registerCommand('streamline.smartConfig.toggle', async (toggle: string) => {
      if (workspaceState.getToggles().includes(toggle)) {
        workspaceState.setToggles(workspaceState.getToggles().filter(t => t !== toggle))
      } else {
        workspaceState.setToggles([
          ...workspaceState.getToggles(),
          toggle,
        ])
      }

      await updateStatusBarItems()
    }),
    vscode.window.onDidChangeActiveTextEditor(() => {
      debouncedUpdateRelevantConfigs()
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('streamline.smartConfig')) {
        if (!config.isSavingInBackground) {
          scheduleConfigLoad()
        }
      }
    })
  )

  updateRelevantConfigs()
  updateStatusBarItems()
}