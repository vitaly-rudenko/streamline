import { BOOKMARKS_SCOPE, QUICK_SCOPE_PREFIX, defaultCurrentScope } from '../common'

/** Whether scopes object is worth saving to the config (e.g. contains non-empty non-dynamic scopes) */
export function isScopesObjectSerializable(scopesObject: Record<string, string[]>): boolean {
  return Object.entries(scopesObject)
    .filter(([scope]) => !scope.startsWith(QUICK_SCOPE_PREFIX) && scope !== BOOKMARKS_SCOPE)
    .some(([scope, scopedPaths]) => scope !== defaultCurrentScope || scopedPaths.length > 0)
}
