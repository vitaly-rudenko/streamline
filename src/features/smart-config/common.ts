export type Config = Record<string, unknown>

export type Condition = { basename: string } | { path: string } | { toggle: string }

export type Rule = {
  apply: string[]
  when: Condition[]
}

export type SmartConfigContext = {
  path: string | undefined
  toggles: string[]
}
