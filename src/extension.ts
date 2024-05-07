import * as vscode from 'vscode'
import { createHighlightedPathsFeature } from './features/highlighted-paths/highlighted-paths-feature'
import { createScopedPathsFeature } from './features/scoped-paths/scoped-paths-feature'

export async function activate(context: vscode.ExtensionContext) {
	const onDidChangeFileDecorationsEmitter = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>()

	const highlightedPathsFeature = await createHighlightedPathsFeature({
		context,
		onHighlightChanged: (payload) => onDidChangeFileDecorationsEmitter.fire(payload),
	})

	const scopedPathsFeature = await createScopedPathsFeature({
		context,
		onScopeChanged: (payload) => onDidChangeFileDecorationsEmitter.fire(payload),
	})

	const fileDecorationProvider: vscode.FileDecorationProvider = {
		onDidChangeFileDecorations: onDidChangeFileDecorationsEmitter.event,
		provideFileDecoration: (file: vscode.Uri): vscode.ProviderResult<vscode.FileDecoration> => {
			const workspaceFolder = vscode.workspace.workspaceFolders?.find(workspaceFolder => workspaceFolder.uri.path === file.path)
			const uncertainPath = workspaceFolder ? workspaceFolder.name : vscode.workspace.asRelativePath(file)

			const isScoped = scopedPathsFeature.isScoped(uncertainPath)
			const isParentOfScoped = scopedPathsFeature.isParentOfScoped(uncertainPath)
			const isHighlighted = highlightedPathsFeature.isHighlighted(uncertainPath)

			if (isHighlighted || isParentOfScoped || isScoped) {
				return new vscode.FileDecoration(
					isScoped ? '|' : isParentOfScoped ? '¦' : undefined,
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
