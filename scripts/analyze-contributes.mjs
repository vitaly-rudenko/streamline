import { readFileSync } from 'fs'
import path from 'path'

const packageJson = JSON.parse(readFileSync(path.join(import.meta.dirname, '../package.json'), 'utf8'))
const commands = packageJson.contributes.commands.map(c => c.command)
const commandTitles = Object.fromEntries(packageJson.contributes.commands.map(c => [c.command, { title: c.title, shortTitle: c.shortTitle }]))
const hiddenCommands = packageJson.contributes.menus.commandPalette.filter(c => c.when === 'false').map(c => c.command)
const shownCommands = commands.filter(c => !hiddenCommands.includes(c))

console.log('Shown commands:', shownCommands.length, 'of', commands.length)
for (const command of shownCommands) {
  console.log('-', `"${commandTitles[command].title}" / "${commandTitles[command].shortTitle ?? '<no short title>'}"`, `(${command})`)
}
