import * as pathUtil from 'path'

export function generateRelatedFilesGlobs(path: string): string[] {
  const basename = pathUtil.basename(path)
  const parentFolder = pathUtil.basename(pathUtil.dirname(path))

  const basenameParts = basename.split('.')
  if (basenameParts[0] === '') {
    basenameParts.shift()
    basenameParts[0] = '.' + basenameParts[0]
  }

  const queries: string[] = []
  for (let i = basenameParts.length - 1; i >= 1; i--) {
    const partialBasename = basenameParts.slice(0, i).join('.')

    if (parentFolder !== '') queries.push(`**/${parentFolder}/${partialBasename}*`)
    queries.push(`**/${partialBasename}*`)

    if (parentFolder !== '') queries.push(`**/${parentFolder}/*${partialBasename}*`)
    queries.push(`**/*${partialBasename}*`)
  }

  return queries
}
