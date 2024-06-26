import * as vscode from 'vscode'
import { createHighlightedPathsFeature } from './features/highlighted-paths/highlighted-paths-feature'
import { createScopedPathsFeature } from './features/scoped-paths/scoped-paths-feature'
import { createRelatedFilesFeature } from './features/related-files/related-files-feature'
import { uriToPath } from './utils/uri'
import { createTabHistoryFeature } from './features/tab-history/tab-history-feature'
import { createBookmarksFeature } from './features/bookmarks/bookmarks-feature'
import { getConfig } from './config'

export function activate(context: vscode.ExtensionContext) {
	const onDidChangeFileDecorationsEmitter = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>()

	const initialConfig = getConfig()

	const highlightedPathsFeature = createHighlightedPathsFeature({
		context,
		onChange: () => onDidChangeFileDecorationsEmitter.fire(undefined),
	})

	const scopedPathsFeature = createScopedPathsFeature({
		context,
		onChange: async () => onDidChangeFileDecorationsEmitter.fire(undefined),
	})

	createRelatedFilesFeature({ context })
	createBookmarksFeature({ context })
	createTabHistoryFeature({ context })

	const highlightThemeColor = new vscode.ThemeColor('textLink.foreground')
	const fileDecorationProvider: vscode.FileDecorationProvider = {
		onDidChangeFileDecorations: onDidChangeFileDecorationsEmitter.event,
		provideFileDecoration: (uri: vscode.Uri): vscode.ProviderResult<vscode.FileDecoration> => {
			const path = uriToPath(uri)
			if (!path) return undefined

			const isScoped = scopedPathsFeature.isPathCurrentlyScoped(path)
			const isParentOfScoped = scopedPathsFeature.isParentOfCurrentlyScopedPaths(path)
			const isHighlighted = highlightedPathsFeature.isPathHighlighted(path)

			if (isHighlighted || isParentOfScoped || isScoped) {
				return new vscode.FileDecoration(
					isScoped ? '•' : isParentOfScoped ? '›' : undefined,
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

export function deactivate() {}
