export function getParents(path: string) {
  const parts = path.split('/')
  const parents = []

  for (let i = 1; i < parts.length; i++) {
    parents.push(parts.slice(0, parts.length - i).join('/'))
  }

  parents.push('')

  return parents
}
