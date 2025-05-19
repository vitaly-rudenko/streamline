# Syntax for 'when'

> Implementation: [src/common/when.ts](https://github.com/vitaly-rudenko/streamline/blob/main/src/common/when.ts)

This syntax is supported in `streamline.smartConfig.rules[].when` and in `streamline.quickRepl.commands[].when` configuration sections.

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
  /** Whether file has at least one folded region */
  hasFoldedRegions: boolean
  /** Whether file has at least one breakpoint */
  hasBreakpoints: boolean
  /** For negating the condition */
  not: Condition
}
```

## Syntax

```ts
type When = Condition[]
```

## Examples

Single condition:
```jsonc
{
  "when": [
    { "languageId": "javascript" }
  ]
}
```

> ```js
> file.languageId === 'javascript'
> ```

Multiple conditions (OR):
```jsonc
{
  "when": [
    { "languageId": "javascript" },
    { "languageId": "typescript" },
  ]
}
```

> ```js
> file.languageId === 'javascript' || file.languageId === 'javascript'
> ```

Shorthand syntax for the same condition:
```jsonc
{
  "when": [
    { "languageId": ["javascript", "typescript"] }
  ]
}
```

> ```js
> file.languageId === 'javascript' || file.languageId === 'javascript'
> ```

Multiple conditions (AND):
```jsonc
{
  "when": [
    { "untitled": true, "languageId": "javascript" }
  ]
}
```

> ```js
> file.isUntitled && file.languageId === 'javascript'
> ```

Multiple conditions (complex):
```jsonc
{
  "when": [
    { "basename": "\\.m?js$" },
    { "untitled": true, "languageId": "javascript" },
  ]
}
```

> ```js
>    /\.m?js$/.test(file.basename)
> || (file.isUntitled && file.languageId === 'javascript')
> ```

Negating the condition:
```jsonc
{
  "when": [
    { "not": { "basename": "\\.js$" } }
  ]
}
```

> ```js
> !/\.js$/.test(file.basename)
> ```

Negating the condition (complex):
```jsonc
{
  "when": [
    { "path": "\\/repls", "not": { "path": "\\/playground" } },
    { "languageId": "javascript", "not": { "basename": "\\.cjs$" } }
  ]
}
```

> ```js
>    (/\/repls/.test(file.path)        && !/\/playground/.test(file.path))
> || (file.languageId === 'javascript' && !/\.cjs$/.test(file.basename))
> ```
