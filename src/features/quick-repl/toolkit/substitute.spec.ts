import { substitute } from './substitute'

describe('substitute()', () => {
  it('substitutes (without context)', () => {
    expect(substitute({
      input: [
        '$homedir, $replsPath, $shortReplsPath, $datetime, $randomNoun, $randomAdjective',
        '$contextPath, $shortContextPath, $contextDirname, $shortContextDirname, $contextBasename, $contextRelativePath, $shortContextRelativePath',
        '$contextContent, $contextSelection',
      ].join('\n'),
      homedir: '/home/user',
      replsPath: '/home/user/repls',
    }, {
      now: new Date('2022-03-04T12:34:56.789Z'),
      nouns: ['fake_noun'],
      adjectives: ['fake_adjective'],
    })).toEqual([
      '/home/user, /home/user/repls, ~/repls, 202203041234, fake_noun, fake_adjective',
      '$contextPath, $shortContextPath, $contextDirname, $shortContextDirname, $contextBasename, $contextRelativePath, $shortContextRelativePath',
      '$contextContent, $contextSelection',
    ].join('\n'))
  })

  it('substitutes (with minimal context)', () => {
    expect(substitute({
      input: [
        '$homedir, $replsPath, $shortReplsPath, $datetime, $randomNoun, $randomAdjective',
        '$contextPath, $shortContextPath, $contextDirname, $shortContextDirname, $contextBasename, $contextRelativePath, $shortContextRelativePath',
        '$contextContent, $contextSelection',
      ].join('\n'),
      homedir: '/home/user',
      replsPath: '/home/user/repls',
      context: {
        path: '/home/user/repls/playground/hello_world.mjs',
      }
    }, {
      now: new Date('2022-03-04T12:34:56.789Z'),
      nouns: ['squirrel'],
      adjectives: ['funny'],
    })).toEqual([
      '/home/user, /home/user/repls, ~/repls, 202203041234, squirrel, funny',
      '/home/user/repls/playground/hello_world.mjs, ~/repls/playground/hello_world.mjs, /home/user/repls/playground, ~/repls/playground, hello_world.mjs, playground/hello_world.mjs, playground/hello_world.mjs',
      '$contextContent, $contextSelection',
    ].join('\n'))
  })

  it('substitutes (with full context)', () => {
    expect(substitute({
      input: [
        '$homedir, $replsPath, $shortReplsPath, $datetime, $randomNoun, $randomAdjective',
        '$contextPath, $shortContextPath, $contextDirname, $shortContextDirname, $contextBasename, $contextRelativePath, $shortContextRelativePath',
        '$contextContent, $contextSelection',
      ].join('\n'),
      homedir: '/home/user',
      replsPath: '/home/user/repls',
      context: {
        path: '/home/user/repls/playground/hello_world.mjs',
        selection: '// My\n// Selection',
        content: '// My\n//Selection\nconsole.log("Hello world!")'
      }
    }, {
      now: new Date('2022-03-04T12:34:56.789Z'),
      nouns: ['squirrel'],
      adjectives: ['funny'],
    })).toEqual([
      '/home/user, /home/user/repls, ~/repls, 202203041234, squirrel, funny',
      '/home/user/repls/playground/hello_world.mjs, ~/repls/playground/hello_world.mjs, /home/user/repls/playground, ~/repls/playground, hello_world.mjs, playground/hello_world.mjs, playground/hello_world.mjs',
      '// My\n//Selection\nconsole.log("Hello world!"), // My\n// Selection',
    ].join('\n'))
  })

  it('substitutes relative path correctly when file is not in replsPath', () => {
    expect(substitute({
      input: '$contextRelativePath, $shortContextRelativePath',
      homedir: '/home/user',
      replsPath: '/home/user/repls',
      context: {
        path: '/home/user/not_repls/playground/hello_world.mjs',
      }
    }, {
      now: new Date('2022-03-04T12:34:56.789Z'),
      nouns: ['squirrel'],
      adjectives: ['funny'],
    })).toEqual('/home/user/not_repls/playground/hello_world.mjs, ~/not_repls/playground/hello_world.mjs')
  })

  it('handles replacements with $ (dollar signs) correctly', () => {
    expect(substitute({
      input: '$contextSelection',
      homedir: '/home/user',
      replsPath: '/home/user/repls',
      context: {
        path: '/home/user/not_repls/playground/hello_world.mjs',
        selection: 'console.log(\'$\')',
      }
    }, {
      now: new Date('2022-03-04T12:34:56.789Z'),
      nouns: ['squirrel'],
      adjectives: ['funny'],
    })).toEqual('console.log(\'$\')')
  })
  it('correctly handles untitled files', () => {
    expect(substitute({
      input: [
        '$homedir, $replsPath, $shortReplsPath, $datetime, $randomNoun, $randomAdjective',
        '$contextPath, $shortContextPath, $contextDirname, $shortContextDirname, $contextBasename, $contextRelativePath, $shortContextRelativePath',
        '$contextContent, $contextSelection',
      ].join('\n'),
      homedir: '/home/user',
      replsPath: '/home/user/repls',
      context: {
        path: 'Untitled-3',
        content: 'console.log("Hello world!")',
        selection: '"Hello world!"',
      }
    }, {
      now: new Date('2022-03-04T12:34:56.789Z'),
      nouns: ['squirrel'],
      adjectives: ['funny'],
    })).toEqual([
      '/home/user, /home/user/repls, ~/repls, 202203041234, squirrel, funny',
      'Untitled-3, Untitled-3, $contextDirname, $shortContextDirname, Untitled-3, Untitled-3, Untitled-3',
      'console.log("Hello world!"), "Hello world!"',
    ].join('\n'))
  })
})