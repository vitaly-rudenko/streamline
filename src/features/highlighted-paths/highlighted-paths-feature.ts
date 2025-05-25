import * as vscode from 'vscode'
import { HighlightedPathsConfig } from './highlighted-paths-config'
import { createDebouncedFunction } from '../../utils/create-debounced-function'

export function createHighlightedPathsFeature(input: {
  context: vscode.ExtensionContext
  onChange: () => unknown
}) {
  const { context, onChange } = input

  const config = new HighlightedPathsConfig()

  const debouncedConfigLoad = createDebouncedFunction(() => {
    if (!config.load()) return
    onChange()
  }, 500)

  context.subscriptions.push(debouncedConfigLoad)

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('streamline.highlightedPaths')) {
        if (!config.isSaving) {
          debouncedConfigLoad.schedule()
        }
      }
    }),
  )

  return {
    isPathHighlighted(path: string): boolean {
      return config.getCachedCombinedPatternRegExp()?.test(path) === true
    }
  }
}
