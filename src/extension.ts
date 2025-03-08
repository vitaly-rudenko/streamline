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
import { createQuickReplFeature } from './features/quick-repl/quick-repl-feature'
import { ConditionContext } from './common/when'
import { GenerateConditionContextInput } from './generate-condition-context'
import { DynamicScopeProvider } from './features/scoped-paths/dynamic-scope-provider'

const featureSchema = z.enum([
  'bookmarks',
  'currentPath',
  'highlightedPaths',
  'relatedFiles',
  'scopedPaths',
  'smartConfig',
  'superSearch',
  'quickRepl',
])

type Feature = z.infer<typeof featureSchema>

export function activate(context: vscode.ExtensionContext) {
  function registerCommand(command: string, callback: (...args: any[]) => any) {
    context.subscriptions.push(
      vscode.commands.registerCommand(command, async (...args) => {
        try {
          await callback(...args)
        } catch (error: any) {
          console.warn(`[Streamline] Command "${command}" failed:`, error)
          vscode.window.showWarningMessage(`Command "${command}" failed: ${error?.message}`)
          throw error
        }
      })
    )
  }

	const onDidChangeFileDecorationsEmitter = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>()

  const disabledFeatures = safeConfigGet(initialConfig, 'disabledFeatures', [], z.array(z.string()))
	const isFeatureEnabled = (feature: Feature) => !disabledFeatures.includes(feature)

  function generateConditionContext(input: GenerateConditionContextInput): ConditionContext {
    return {
      toggles: smartConfigFeature?.getEnabledToggles() ?? [],
      scopeSelected: scopedPathsFeature?.getCurrentScope(),
      scopeEnabled: scopedPathsFeature?.isScopeEnabled() ?? false,
      colorThemeKind: vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark ? 'dark'
        : vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.HighContrast ? 'high-contrast'
        : vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Light ? 'light'
        : 'high-contrast-light',

      ...(input && 'document' in input) ? {
        languageId: input.document.languageId,
        path: input.document.uri.path,
        untitled: input.document.isUntitled,
        fileType: 'file',
        selection: !input.selection.isEmpty,
      } : (input && 'path' in input) ? {
        path: input.path,
        fileType: input.fileType === vscode.FileType.File ? 'file'
          : input.fileType === vscode.FileType.Directory ? 'directory'
          : undefined,
      } : {}
    }
  }

  let highlightedPathsFeature: ReturnType<typeof createHighlightedPathsFeature> | undefined
  let smartConfigFeature: ReturnType<typeof createSmartConfigFeature> | undefined
  let scopedPathsFeature: ReturnType<typeof createScopedPathsFeature> | undefined
  let bookmarksFeature: ReturnType<typeof createBookmarksFeature> | undefined

	highlightedPathsFeature = isFeatureEnabled('highlightedPaths')
		? createHighlightedPathsFeature({
			context,
			onChange: () => onDidChangeFileDecorationsEmitter.fire(undefined),
		})
		: undefined

  smartConfigFeature = isFeatureEnabled('smartConfig')
    ? createSmartConfigFeature({
      context,
      registerCommand,
      generateConditionContext,
    })
    : undefined

  const onDidChangeBookmarksEmitter = new vscode.EventEmitter<void>()

  bookmarksFeature = isFeatureEnabled('bookmarks')
    ? createBookmarksFeature({
      context,
      registerCommand,
      onChange: () => {
        onDidChangeFileDecorationsEmitter.fire(undefined)
        onDidChangeBookmarksEmitter.fire()
      }
    })
    : undefined

  const dynamicScopeProviders: DynamicScopeProvider[] = []
  if (bookmarksFeature) {
    dynamicScopeProviders.push({
      name: 'Bookmarks',
      iconPath: new vscode.ThemeIcon('bookmark'),
      selectedIconPath: new vscode.ThemeIcon('bookmark'),
      isScopeMatching: (scope) => scope === '#bookmarks',
      getScopes: () => ['#bookmarks'],
      getScopedAndExcludedPaths: ({ uriToPath }) => (
        bookmarksFeature.getCachedBookmarksInCurrentBookmarksList()
          .map(b => uriToPath(b.uri))
          .filter((path): path is string => path !== undefined)
      ),
      subscribe: (callback: Function) => onDidChangeBookmarksEmitter.event(() => callback())
    })
  }

  scopedPathsFeature = isFeatureEnabled('scopedPaths')
		? createScopedPathsFeature({
			context,
      registerCommand,
			onChange: () => {
        onDidChangeFileDecorationsEmitter.fire(undefined)
        smartConfigFeature?.scheduleRefresh()
      },
      dynamicScopeProviders,
		})
		: undefined

	if (isFeatureEnabled('relatedFiles')) createRelatedFilesFeature({ context, registerCommand })
	if (isFeatureEnabled('currentPath')) createCurrentPathFeature({ context, registerCommand })
  if (isFeatureEnabled('superSearch')) createSuperSearchFeature({ context, registerCommand })
  if (isFeatureEnabled('quickRepl')) createQuickReplFeature({ context, registerCommand, generateConditionContext })

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
          const badge = isScoped ? '•' : isExcluded ? '⨯' : isParentOfScopedAndExcluded ? '›' : undefined
          const prefix = isBookmarked ? '⭑' : undefined

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

  registerCommand('streamline.help.when', async () => {
    await openHelp('docs/when.md')
  })

  registerCommand('streamline.help.quickRepl', async () => {
    await openHelp('docs/quick-repl.md')
  })

  async function openHelp(path: string) {
    const helpPath = context.asAbsolutePath(path)
    if (!helpPath) return

    const helpUri = vscode.Uri.file(helpPath)
    await vscode.commands.executeCommand('markdown.showPreview', helpUri)
  }

  async function updateContextInBackground() {
    try {
      for (const feature of featureSchema.options) {
        await vscode.commands.executeCommand('setContext', `streamline.${feature}.enabled`, isFeatureEnabled(feature))
      }
    } catch (error) {
      console.warn('[Streamline] Could not update context', error)
    }
  }

  updateContextInBackground()
}

export function deactivate() {}
