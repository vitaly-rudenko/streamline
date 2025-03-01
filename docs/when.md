# Syntax for 'when'

> Implementation: [src/common/when.ts](../src/common/when.ts)

## Supported conditions

```ts
type Condition = {
  /** Whether current file is Untitled (not saved) */
  untitled: boolean
  /** Regular expression for the basename */
  basename: string
  /** Regular expression for the absolute path */
  path: string
  /** Whether toggle from SmartConfig is enabled */
  toggle: string
  /** Current VS Code's theme type */
  colorThemeKind: 'dark' | 'light' | 'high-contrast' | 'high-contrast-light'
  /** https://code.visualstudio.com/docs/languages/identifiers */
  languageId: string
  /** Which scope from ScopedPaths is currently selected */
  scopeSelected: string
  /** Whether current ScopedPaths' scope is enabled */
  scopeEnabled: boolean
  /** Shorthand for [{ scopeSelected: 'scope' }, { scopeEnabled: true }] */
  scope: string
  /** Applicable in certain scenarios (e.g. Quick Repl View) */
  fileType: 'file' | 'directory'
  /** Whether file has a non-empty selection */
  selection: boolean
}
```

## Syntax

```ts
// [{ Condition1 }, { Condition2 }, ...]
//   => Condition1 || Condition2 || ...

// [{ Condition1, Condition2 }, { Condition3, Condition4 }]
//   => (Condition1 && Condition2) || (Condition3 && Condition4) || ...

type When = (Condition | Condition[])[]
```

## Examples

Single condition:
```json
{
  "when": [
    { "languageId": "javascript" }
  ]
}
```
> `file.languageId === 'javascript'`

Multiple conditions (OR):
```json
{
  "when": [
    { "languageId": "javascript" },
    { "languageId": "typescript" },
  ]
}
```
> `file.languageId === 'javascript' || file.languageId === 'javascript'`

Multiple conditions (AND):
```json
{
  "when": [
    { "untitled": true, "languageId": "javascript" }
  ]
}
```
> `file.isUntitled && file.languageId === 'javascript'`

Multiple conditions (complex):
```json
{
  "when": [
    { "basename": "\\.m?js$" },
    { "untitled": true, "languageId": "javascript" },
  ]
}
```
> `/\.m?js$/.test(file.basename) || (file.isUntitled && file.languageId === 'javascript')`
