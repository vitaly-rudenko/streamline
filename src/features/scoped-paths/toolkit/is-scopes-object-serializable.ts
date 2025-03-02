import { defaultCurrentScope } from '../common'

/** Whether scopes object is worth saving to the config (e.g. contains non-empty scopes) */
export function isScopesObjectSerializable(scopesObject: Record<string, string[]>,): boolean {
  return Object.entries(scopesObject)
    .some(([scope, scopedPaths]) => scope !== defaultCurrentScope || scopedPaths.length > 0)
}
