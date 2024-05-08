export function getPathQuery(path: string, options: { includeSingleFolder?: boolean }) {
  const basename = path.replace(/^.*\//, '').replace(/(.+?)\..+$/, '$1')

  if (options.includeSingleFolder) {
    const singleFolder = path.split('/').at(-2)
    return singleFolder ? `${singleFolder}/${basename}` : basename
  }

  return basename
}
