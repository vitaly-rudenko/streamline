export const defaultCurrentScope = 'Default'

export function generateQuickScope(path: string) {
  return `@${path}`
}

export function isQuickScope(scope: string) {
  return scope.startsWith('@')
}
