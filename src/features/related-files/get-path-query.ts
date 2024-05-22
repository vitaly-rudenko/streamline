import { getBasename } from './get-basename'

export function getPathQuery(path: string, options: { includeSingleFolder?: boolean }) {
  const basename = getBasename(path)

  if (options.includeSingleFolder) {
    const singleFolder = path.split('/').at(-2)
    return singleFolder ? `${singleFolder}/${basename}` : basename
  }

  return basename
}
