import * as vscode from 'vscode'
import { createHighlightedPathsFeature } from './features/highlighted-paths/highlighted-paths-feature'
import { createScopedPathsFeature } from './features/scoped-paths/scoped-paths-feature'
import { createRelatedFilesFeature } from './features/related-files/related-files-feature'
import { uriToPath } from './utils/uri'
import { createTabHistoryFeature } from './features/tab-history/tab-history-feature'
import { createBookmarksFeature } from './features/bookmarks/bookmarks-feature'
import { createCurrentPathFeature } from './features/current-path/current-path-feature'
import { initialConfig } from './config'
import { createSmartConfigFeature } from './features/smart-config/smart-config-feature'

type Feature =
	| 'bookmarks'
	| 'currentPath'
	| 'highlightedPaths'
	| 'relatedFiles'
	| 'scopedPaths'
	| 'tabHistory'
  | 'smartConfig'

export function activate(context: vscode.ExtensionContext) {
	const onDidChangeFileDecorationsEmitter = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>()

	const disabledFeatures = initialConfig.get<Feature[]>('disabledFeatures', [])
	const isFeatureEnabled = (feature: Feature) => !disabledFeatures.includes(feature)

	const highlightedPathsFeature = isFeatureEnabled('highlightedPaths')
		? createHighlightedPathsFeature({
			context,
			onChange: () => onDidChangeFileDecorationsEmitter.fire(undefined),
		})
		: undefined

	const scopedPathsFeature = isFeatureEnabled('scopedPaths')
		? createScopedPathsFeature({
			context,
			onChange: async () => onDidChangeFileDecorationsEmitter.fire(undefined),
		})
		: undefined

	if (isFeatureEnabled('relatedFiles')) createRelatedFilesFeature({ context })
	if (isFeatureEnabled('bookmarks')) createBookmarksFeature({ context })
	if (isFeatureEnabled('tabHistory')) createTabHistoryFeature({ context })
	if (isFeatureEnabled('currentPath')) createCurrentPathFeature({ context })
  if (isFeatureEnabled('smartConfig')) createSmartConfigFeature({ context })

  if (scopedPathsFeature || highlightedPathsFeature) {
    const highlightThemeColor = new vscode.ThemeColor('textLink.foreground')
    const fileDecorationProvider: vscode.FileDecorationProvider = {
      onDidChangeFileDecorations: onDidChangeFileDecorationsEmitter.event,
      provideFileDecoration: (uri: vscode.Uri): vscode.ProviderResult<vscode.FileDecoration> => {
        const path = uriToPath(uri)
        if (!path) return undefined

        const isScoped = scopedPathsFeature ? scopedPathsFeature.isPathCurrentlyScoped(path) : false
        const isExcluded = scopedPathsFeature ? scopedPathsFeature.isPathCurrentlyExcluded(path) : false
        const isParentOfScopedAndExcluded = scopedPathsFeature ? scopedPathsFeature.isParentOfCurrentlyScopedAndExcludedPaths(path) : false
        const isHighlighted = highlightedPathsFeature ? highlightedPathsFeature.isPathHighlighted(path) : false

        if (isHighlighted || isParentOfScopedAndExcluded || isScoped || isExcluded) {
          return new vscode.FileDecoration(
            isScoped ? '•' :
            isExcluded ? '⨯' :
            isParentOfScopedAndExcluded ? '›'
            : undefined,
            undefined,
            isHighlighted ? highlightThemeColor : undefined
          )
        }

        return undefined
      }
    }

    context.subscriptions.push(
      vscode.window.registerFileDecorationProvider(fileDecorationProvider),
      onDidChangeFileDecorationsEmitter,
    )
  }
}

export function deactivate() {}
