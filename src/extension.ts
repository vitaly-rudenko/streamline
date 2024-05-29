import * as vscode from 'vscode'
import { createHighlightedPathsFeature } from './features/highlighted-paths/highlighted-paths-feature'
import { createScopedPathsFeature } from './features/scoped-paths/scoped-paths-feature'
import { createRelatedFilesFeature } from './features/related-files/related-files-feature'
import { uriToPath } from './utils/uri'
import { createTabHistoryFeature } from './features/tab-history/tab-history-feature'
import { createBookmarksFeature } from './features/bookmarks/bookmarks-feature'

export async function activate(context: vscode.ExtensionContext) {
	const onDidChangeFileDecorationsEmitter = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>()

	const highlightedPathsFeature = createHighlightedPathsFeature({
		context,
		onHighlightChanged: (payload) => onDidChangeFileDecorationsEmitter.fire(payload),
	})

	const scopedPathsFeature = await createScopedPathsFeature({
		context,
		onScopeChanged: async (payload) => onDidChangeFileDecorationsEmitter.fire(payload),
	})

	createRelatedFilesFeature({ context })
	createTabHistoryFeature({ context })
	createBookmarksFeature({ context })

	const fileDecorationProvider: vscode.FileDecorationProvider = {
		onDidChangeFileDecorations: onDidChangeFileDecorationsEmitter.event,
		provideFileDecoration: (uri: vscode.Uri): vscode.ProviderResult<vscode.FileDecoration> => {
			const path = uriToPath(uri)
			if (!path) return undefined

			const isScoped = scopedPathsFeature.isScoped(path)
			const isParentOfScoped = scopedPathsFeature.isParentOfScoped(path)
			const isHighlighted = highlightedPathsFeature.isHighlighted(path)

			if (isHighlighted || isParentOfScoped || isScoped) {
				return new vscode.FileDecoration(
					isScoped ? '•' : isParentOfScoped ? '›' : undefined,
					undefined,
					isHighlighted ? new vscode.ThemeColor('textLink.foreground') : undefined
				)
			}
		}
	}

	context.subscriptions.push(
		vscode.window.registerFileDecorationProvider(fileDecorationProvider),
		onDidChangeFileDecorationsEmitter,
	)
}

export function deactivate() {}
