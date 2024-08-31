import * as vscode from 'vscode'
import { createDebouncedFunction } from '../../utils/create-debounced-function'

type PatternsObject = Record<string, Config>
type Patterns = [RegExp, Config][]
type Config = Record<string, unknown>

const defaultPattern = 'default'

// TODO: Implement FeatureConfig and caching

export function createSmartConfigFeature(input: {
  context: vscode.ExtensionContext
}) {
  const { context } = input

  const debouncedUpdateRelevantConfigs = createDebouncedFunction(updateRelevantConfigs, 250)

  async function updateRelevantConfigs(textEditor?: vscode.TextEditor) {
    const path = (textEditor ?? vscode.window.activeTextEditor)?.document.uri.path

    const config = vscode.workspace.getConfiguration()
    const patternsObject = config.inspect<PatternsObject>('streamline.smartConfig.patterns')

    console.debug('streamline.smartConfig.patterns', patternsObject ? {
      globalValue: patternsObject.globalValue,
      workspaceValue: patternsObject.workspaceValue,
      workspaceFolderValue: patternsObject.workspaceFolderValue,
    } : 'undefined')

    if (!patternsObject) return

    const promises: Promise<void>[] = []

    if (patternsObject.globalValue) {
      promises.push(applyConfig(config, path, patternsObject.globalValue[defaultPattern], generatePatterns(patternsObject.globalValue), vscode.ConfigurationTarget.Global))
    }

    if (patternsObject.workspaceValue) {
      promises.push(applyConfig(config, path, patternsObject.workspaceValue[defaultPattern], generatePatterns(patternsObject.workspaceValue), vscode.ConfigurationTarget.Workspace))
    }

    if (patternsObject.workspaceFolderValue) {
      promises.push(applyConfig(config, path, patternsObject.workspaceFolderValue[defaultPattern], generatePatterns(patternsObject.workspaceFolderValue), vscode.ConfigurationTarget.WorkspaceFolder))
    }

    if (promises.length > 0) {
      await Promise.allSettled(promises)
    }
  }

  function generatePatterns(patternsObject: PatternsObject): Patterns {
    return Object.entries(patternsObject)
      .filter(([pattern]) => pattern !== defaultPattern)
      .map(([pattern, config]) => [new RegExp(pattern), config] as const)
  }

  async function applyConfig(
    config: vscode.WorkspaceConfiguration,
    path: string | undefined,
    defaultConfig: Config | undefined,
    patterns: Patterns,
    target: vscode.ConfigurationTarget
  ) {
    const configsToApply = path ? patterns.filter(([pattern]) => pattern.test(path)).map(([_, config]) => config) : []
    if (defaultConfig) configsToApply.unshift(defaultConfig)

    const mergedConfigToApply = Object.assign({}, ...configsToApply) as Config
    const remainingSectionsSet = new Set(patterns.flatMap(([_pattern, config]) => Object.keys(config)))

    for (const [section, value] of Object.entries(mergedConfigToApply)) {
      try {
        console.debug('+ Setting section', section, 'to value', value, 'in target', target, 'for path', path)
        await config.update(section, value === '__unset_by_streamline__' ? undefined : value, target)
      } catch (error: any) {
        console.warn(error.message)
      }

      remainingSectionsSet.delete(section)
    }

    for (const section of remainingSectionsSet) {
      try {
        console.debug('- Removing section', section, 'in target', target, 'for path', path)
        await config.update(section, undefined, target)
      } catch (error: any) {
        console.warn(error.message)
      }
    }
  }

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => {
      debouncedUpdateRelevantConfigs()
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('streamline.smartConfig')) {
        debouncedUpdateRelevantConfigs()
      }
    })
  )

  updateRelevantConfigs()
}