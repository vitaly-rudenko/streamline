import { getBasename } from '../../utils/get-basename'

export function getRelatedFilesQueries(path: string) {
  const basename = getBasename(path)
  const singleFolder = path.split('/').at(-2)

  if (singleFolder) {
    return {
      best: `**/${singleFolder}/${basename}*`,
      worst: `**/*${basename}*`
    }
  }

  return {
    best: `**/${basename}*`,
    worst: `**/*${basename}*`
  }
}
