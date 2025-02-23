import { Command, Template } from '../common'
import { expandHomedir } from './expand-homedir'
import { substitute } from './substitute'

export function isCommandValid(command: Command) {
  if (!isValidSubstitutableAbsolutePath(command.cwd)) {
    return false
  }

  const commandCommand = typeof command.command === 'string'
    ? command.command
    : command.command.join('\n')

  if (!isValidSubstitutableInput(commandCommand)) {
    return false
  }

  return true
}

export function isTemplateValid(template: Template) {
  if (template.type === 'snippet') {
    if (template.template) {
      if ('path' in template.template) {
        if (!isValidSubstitutableAbsolutePath(template.template.path)) {
          return false
        }
      }
    }
  }

  if (template.type === 'file' || template.type === 'directory') {
    if (template.defaultPath) {
      if (!isValidSubstitutableAbsolutePath(template.defaultPath)) {
        return false
      }
    }

    if (template.template) {
      if ('path' in template.template) {
        if (!isValidSubstitutableAbsolutePath(template.template.path)) {
          return false
        }
      }
    }
  }

  return true
}

function isValidSubstitutableInput(input: string) {
  const substituted = substitute({
    input,
    homedir: '/home/fake',
    replsPath: '/home/user/repls',
    context: {
      path: '/home/user/repls/quick-repl',
      content: 'console.log(\'Hello, World!\');',
      selection: 'console.log(\'Hello, World!\');'
    }
  })

  return !substituted.includes('$')
}

function isValidSubstitutableAbsolutePath(path: string) {
  const substituted = substitute({
    input: expandHomedir(path, '/home/fake'),
    homedir: '/home/fake',
    replsPath: '/home/user/repls',
    context: {
      path: '/home/user/repls/quick-repl',
      content: 'console.log(\'Hello, World!\');',
      selection: 'console.log(\'Hello, World!\');'
    }
  })

  return substituted.startsWith('/') && !substituted.includes('$')
}