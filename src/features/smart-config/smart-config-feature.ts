import * as vscode from 'vscode'
import { getConfig } from '../../config'

// TODO: global + workspace + workspace folder config merge support
// TODO: optimize by not applying if there's nothing to apply or if user didn't set any overrides

export function createSmartConfigFeature(input: {
  context: vscode.ExtensionContext
}) {
  const { context } = input

  const patternsObject = getConfig().get<Record<string, any>>('smartConfig.patterns', {})
  const patterns = Object.entries(patternsObject).map(([pattern, config]) => [new RegExp(pattern), config] as const)
  const allSectionsSet = new Set(Object.values(patternsObject).flatMap(config => Object.keys(config)))

  async function updateRelevantConfigs(textEditor?: vscode.TextEditor) {
    const path = (textEditor ?? vscode.window.activeTextEditor)?.document.uri.path
    const configs = path
      ? patterns.filter(([pattern]) => pattern.test(path)).map(([_, config]) => config)
      : []

    const config = {
      ...patternsObject.default,
      ...configs.reduce((acc, config) => ({ ...acc, ...config }), {}),
    }

    const remainingSectionsSet = new Set(allSectionsSet)
    for (const [section, value] of Object.entries(config)) {
      try {
        await vscode.workspace.getConfiguration().update(section, value === '__unset_by_streamline__' ? undefined : value, vscode.ConfigurationTarget.Workspace)
      } catch (error: any) {
        console.warn(error.message)
      }

      remainingSectionsSet.delete(section)
    }

    for (const section of remainingSectionsSet) {
      try {
        await vscode.workspace.getConfiguration().update(section, undefined, vscode.ConfigurationTarget.Workspace)
      } catch (error: any) {
        console.warn(error.message)
      }
    }
  }

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((textEditor) => {
      updateRelevantConfigs(textEditor)
    })
  )

  updateRelevantConfigs()
}