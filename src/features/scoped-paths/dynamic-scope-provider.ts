import type { IconPath, Uri } from 'vscode'

export type DynamicScopeProvider = {
  name: string
  iconPath: IconPath
  selectedIconPath: IconPath
  isScopeMatching: (scope: string) => boolean
  getScopes: () => string[]
  subscribe?: (callback: Function) => void
  getScopedAndExcludedPaths: (input: {
    currentScope: string
    uriToPath: (uri: Uri) => string | undefined
  }) => string[]
}
