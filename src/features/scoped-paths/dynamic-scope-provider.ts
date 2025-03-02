export type DynamicScopeProvider = {
  name: string
  isScopeMatching: (scope: string) => boolean;
  getScopes: () => string[];
  subscribe?: (callback: Function) => void;
  getScopedAndExcludedPaths: (scope: string) => string[];
}
