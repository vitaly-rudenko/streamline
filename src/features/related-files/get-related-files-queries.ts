import { getBasename } from './get-basename'

export function getRelatedFilesQueries(path: string) {
  const basename = getBasename(path)
  const singleFolder = path.split('/').at(-2)

  return {
    best: `**/${singleFolder ? `${singleFolder}/${basename}` : basename}*`,
    worst: `**/${basename}*`
  }
}
