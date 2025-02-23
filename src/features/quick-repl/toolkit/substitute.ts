import { dirname, basename, relative } from 'path'
import { QuickReplNotSetUpError } from '../common'
import { adjectives } from './adjectives'
import { nouns } from './nouns'

export function substitute(
  input: {
    input: string
    homedir: string
    replsPath?: string
    context?: {
      path: string
      content?: string
      selection?: string
    }
  },
  deps = {
    now: new Date(),
    nouns,
    adjectives,
  }
) {
  if (!input.replsPath) throw new QuickReplNotSetUpError()

  enforceAbsolute(input.replsPath)
  enforceAbsolute(input.homedir)

  let result = input.input
    .replaceAll('$homedir', input.homedir)
    .replaceAll('$replsPath', input.replsPath)
    .replaceAll('$shortReplsPath', shortenHomedir(input.replsPath, input.homedir))
    .replaceAll('$datetime', () => deps.now.toISOString().replaceAll(/(\d{2}\.\d+Z|\D)/g, ''))
    .replaceAll('$randomNoun', () => deps.nouns[Math.floor(Math.random() * deps.nouns.length)])
    .replaceAll('$randomAdjective', () => deps.adjectives[Math.floor(Math.random() * deps.adjectives.length)])

  if (input.context) {
    enforceAbsolute(input.context.path)

    const contextRelativePath = input.context.path.startsWith(input.replsPath + '/')
      ? input.context.path.slice(input.replsPath.length + 1)
      : input.context.path

    result = result
      .replaceAll('$contextPath', input.context.path)
      .replaceAll('$shortContextPath', shortenHomedir(input.context.path, input.homedir))
      .replaceAll('$contextDirname', dirname(input.context.path))
      .replaceAll('$shortContextDirname', shortenHomedir(dirname(input.context.path), input.homedir))
      .replaceAll('$contextBasename', basename(input.context.path))
      .replaceAll('$contextRelativePath', contextRelativePath)
      .replaceAll('$shortContextRelativePath', shortenHomedir(contextRelativePath, input.homedir))

    if (input.context.content !== undefined) {
      result = result.replaceAll('$contextContent', input.context.content)
    }

    if (input.context.selection !== undefined) {
      result = result.replaceAll('$contextSelection', input.context.selection)
    }
  }

  return result
}

export function shortenHomedir(path: string, homedir: string) {
  return path.startsWith(homedir + '/') ? ('~' + path.slice(homedir.length)) : path
}

function enforceAbsolute(path: string) {
  if (!path.startsWith('/')) {
    throw new Error(`Path must be absolute: ${path}`)
  }
}
