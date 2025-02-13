import z from 'zod'
import * as vscode from 'vscode'
import { createHighlightedPathsFeature } from './features/highlighted-paths/highlighted-paths-feature'
import { createScopedPathsFeature } from './features/scoped-paths/scoped-paths-feature'
import { createRelatedFilesFeature } from './features/related-files/related-files-feature'
import { uriToPath } from './utils/uri'
import { createBookmarksFeature } from './features/bookmarks/bookmarks-feature'
import { createCurrentPathFeature } from './features/current-path/current-path-feature'
import { initialConfig, safeConfigGet } from './config'
import { createSmartConfigFeature } from './features/smart-config/smart-config-feature'
import { createSuperSearchFeature } from './features/super-search/super-search-feature'

type Feature =
	| 'bookmarks'
	| 'currentPath'
	| 'highlightedPaths'
	| 'relatedFiles'
	| 'scopedPaths'
  | 'smartConfig'
  | 'superSearch'

export function activate(context: vscode.ExtensionContext) {
	const onDidChangeFileDecorationsEmitter = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>()

  const disabledFeatures = safeConfigGet(initialConfig, 'disabledFeatures', [], z.array(z.string()))
	const isFeatureEnabled = (feature: Feature) => !disabledFeatures.includes(feature)

	const highlightedPathsFeature = isFeatureEnabled('highlightedPaths')
		? createHighlightedPathsFeature({
			context,
			onChange: () => onDidChangeFileDecorationsEmitter.fire(undefined),
		})
		: undefined

  const smartConfigFeature = isFeatureEnabled('smartConfig')
    ? createSmartConfigFeature({
      context,
      dependencies: {
        getCurrentScope: () => scopedPathsFeature?.getCurrentScope(),
        isScopeEnabled: () => scopedPathsFeature?.isScopeEnabled() ?? false,
      }
    })
    : undefined

  const scopedPathsFeature = isFeatureEnabled('scopedPaths')
		? createScopedPathsFeature({
			context,
			onChange: () => {
        onDidChangeFileDecorationsEmitter.fire(undefined)
        smartConfigFeature?.scheduleRefresh()
      },
		})
		: undefined

  const bookmarksFeature = isFeatureEnabled('bookmarks')
    ? createBookmarksFeature({
      context,
      onChange: () => onDidChangeFileDecorationsEmitter.fire(undefined),
    })
    : undefined

	if (isFeatureEnabled('relatedFiles')) createRelatedFilesFeature({ context })
	if (isFeatureEnabled('currentPath')) createCurrentPathFeature({ context })
  if (isFeatureEnabled('superSearch')) createSuperSearchFeature({ context })

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
        const isBookmarked = bookmarksFeature ? bookmarksFeature.isPathBookmarkedInCurrentBookmarksList(uri.path) : false

        if (isHighlighted || isParentOfScopedAndExcluded || isScoped || isExcluded || isBookmarked) {
          console.log(path, { isScoped, isExcluded, isParentOfScopedAndExcluded, isHighlighted, isBookmarked })

          const badge = isScoped ? '•' : isExcluded ? '⨯' : isParentOfScopedAndExcluded ? '›' : undefined
          const prefix = isBookmarked ? '†' : undefined

          return new vscode.FileDecoration(
            (badge && prefix) ? `${prefix}${badge}` : badge ?? prefix,
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
