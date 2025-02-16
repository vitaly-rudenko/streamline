import * as os from 'os'

const homedir = os.homedir()

export function formatPath(path: string) {
  return path.startsWith(homedir + '/')
    ? `~/${path.slice(homedir.length + 1)}`
    : path
}