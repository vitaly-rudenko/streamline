import * as vscode from 'vscode'
import { createDebouncedFunction } from '../../utils/create-debounced-function'
import { ConfigurationTargetPatterns, SmartConfigConfig } from './smart-config-config'

export function createSmartConfigFeature(input: { context: vscode.ExtensionContext }) {
  const { context } = input

  const config = new SmartConfigConfig()

  const debouncedUpdateRelevantConfigs = createDebouncedFunction(updateRelevantConfigs, 250)

  const scheduleConfigLoad = createDebouncedFunction(() => {
    if (!config.load()) return
    debouncedUpdateRelevantConfigs()
  }, 500)

  async function updateRelevantConfigs(textEditor?: vscode.TextEditor) {
    const path = (textEditor ?? vscode.window.activeTextEditor)?.document.uri.path
    const promises: Promise<void>[] = []

    const globalPatterns = config.getCachedGlobalPatterns()
    if (globalPatterns) {
      promises.push(applyConfig(path, globalPatterns, vscode.ConfigurationTarget.Global))
    }

    const workspacePatterns = config.getCachedWorkspacePatterns()
    if (workspacePatterns) {
      promises.push(applyConfig(path, workspacePatterns, vscode.ConfigurationTarget.Workspace))
    }

    const workspaceFolderPatterns = config.getCachedWorkspaceFolderPatterns()
    if (workspaceFolderPatterns) {
      promises.push(applyConfig(path, workspaceFolderPatterns, vscode.ConfigurationTarget.WorkspaceFolder))
    }

    if (promises.length > 0) {
      await Promise.allSettled(promises)
    }
  }

  async function applyConfig(
    path: string | undefined,
    { patterns, defaultConfig }: ConfigurationTargetPatterns,
    target: vscode.ConfigurationTarget
  ) {
    const vscodeConfig = vscode.workspace.getConfiguration()

    const configsToApply = path ? patterns.filter(([pattern]) => pattern.test(path)).map(([_, config]) => config) : []
    if (defaultConfig) configsToApply.unshift(defaultConfig)

    const mergedConfigToApply = Object.assign({}, ...configsToApply)
    const remainingSectionsSet = new Set(patterns.flatMap(([_pattern, config]) => Object.keys(config)))

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
}