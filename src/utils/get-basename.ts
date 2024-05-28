export function getBasename(path: string): string {
  return path.replace(/^.*\//, '').replace(/(.+?)\..+$/, '$1')
}