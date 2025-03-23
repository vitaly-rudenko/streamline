import z from 'zod'
import { ConfigurationTarget } from 'vscode'
import { getConfig, initialConfig, safeConfigGet, updateEffectiveConfig } from '../../config'
import { FeatureConfig } from '../feature-config'
import { isScopesObjectSerializable } from './toolkit/is-scopes-object-serializable'

export class ScopedPathsConfig extends FeatureConfig {
  public onChange?: Function

  private _scopesObject: Record<string, string[]> = {}

  constructor() {
    super('ScopedPaths')
    this.load(initialConfig)
  }

  load(config = getConfig()) {
    const scopesObject = safeConfigGet(config, 'scopedPaths.scopes', {}, z.record(z.string(), z.array(z.string())))

    let hasChanged = false

    if (
      JSON.stringify(this._scopesObject) !== JSON.stringify(scopesObject)
    ) {
      this._scopesObject = scopesObject

      hasChanged = true
    }

    if (hasChanged) {
      this.onChange?.()
    }

    console.debug('[ScopedPaths] Config has been loaded', { hasChanged, scopesObject })

    return hasChanged
  }

  async save() {
    const config = getConfig()

    await updateEffectiveConfig(
      config,
      ConfigurationTarget.Workspace,
      'scopedPaths.scopes',
      exists => (exists || isScopesObjectSerializable(this._scopesObject)) ? this._scopesObject : undefined,
    )

    console.debug('[ScopedPaths] Config has been saved')
  }

  setScopesObject(value: Record<string, string[]>) {
    this._scopesObject = value
    this.onChange?.()
  }

  getScopesObject() {
    return this._scopesObject
  }
}
