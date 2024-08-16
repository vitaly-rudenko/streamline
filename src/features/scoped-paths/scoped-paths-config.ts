import { ConfigurationTarget } from 'vscode'
import { configExists, getConfig, initialConfig, updateEffectiveConfig } from '../../config'
import { FeatureConfig } from '../feature-config'
import { defaultCurrentScope, QUICK_SCOPE_PREFIX } from './constants'

const defaultHighlightStatusBarWhenEnabled = true

export class ScopedPathsConfig extends FeatureConfig {
  public onChange?: Function

  private _scopesObject: Record<string, string[]> = {}
  private _highlightStatusBarWhenEnabled: boolean = defaultHighlightStatusBarWhenEnabled

  constructor() {
    super('ScopedPaths')
    this.load(initialConfig)
  }

  load(config = getConfig()) {
    const scopesObject = config.get<Record<string, string[]>>('scopedPaths.scopes', {})
    const highlightStatusBarWhenEnabled = config.get<boolean>('scopedPaths.highlightStatusBarWhenEnabled', defaultHighlightStatusBarWhenEnabled)

    let hasChanged = false

    if (
      this._highlightStatusBarWhenEnabled !== highlightStatusBarWhenEnabled
      || JSON.stringify(this._scopesObject) !== JSON.stringify(scopesObject)
    ) {
      this._scopesObject = scopesObject
      this._highlightStatusBarWhenEnabled = highlightStatusBarWhenEnabled

      hasChanged = true
    }

    if (hasChanged) {
      this.onChange?.()
    }

    console.debug('[ScopedPaths] Config has been loaded', { hasChanged, scopesObject, highlightStatusBarWhenEnabled })

    return hasChanged
  }

  async save() {
    const config = getConfig()

    await updateEffectiveConfig(
      config,
      'scopedPaths.scopes',
      (configExists(config, 'scopedPaths.scopes') || Object.entries(this._scopesObject)
        .filter(([scope]) => !scope.startsWith(QUICK_SCOPE_PREFIX))
        .some(([scope, scopedPaths]) => scope !== defaultCurrentScope || scopedPaths.length > 0))
          ? this._scopesObject : undefined,
      ConfigurationTarget.Workspace,
    )

    console.debug('[ScopedPaths] Config has been saved')
  }

  getHighlightStatusBarWhenEnabled() {
    return this._highlightStatusBarWhenEnabled
  }

  setScopesObject(value: Record<string, string[]>) {
    this._scopesObject = value
    this.onChange?.()
  }

  getScopesObject() {
    return this._scopesObject
  }
}