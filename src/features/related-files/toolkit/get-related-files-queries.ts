import { getSmartBasename } from './get-smart-basename'

// 'path/to/file.suffix.ts' => ['**/to/file.suffix*', '**/to/file*', '**/*file.suffix*']
// 'file.suffix.ts'         => ['**/file.suffix*', '**/file*', '**/*file.suffix*']
export function getRelatedFilesQueries(path: string, excludedSuffixes: string[]): string[] {
  const basename = getSmartBasename(path, excludedSuffixes)
  const singleFolder = path.split('/').at(-2)

  const looserBasename = basename.split('.').slice(0, -1).join('.')

  if (singleFolder) {
    return [
      `**/${singleFolder}/${basename}*`,
      looserBasename && `**/${singleFolder}/${looserBasename}*`,
      `**/*${basename}*`,
    ].filter(Boolean)
  }

  return [
    `**/${basename}*`,
    looserBasename && `**/${looserBasename}*`,
    `**/*${basename}*`,
  ].filter(Boolean)
}
