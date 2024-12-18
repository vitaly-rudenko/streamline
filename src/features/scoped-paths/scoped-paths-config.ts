import { ConfigurationTarget } from 'vscode'
import { getConfig, initialConfig, updateEffectiveConfig } from '../../config'
import { FeatureConfig } from '../feature-config'
import { isScopesObjectSerializable } from './toolkit/is-scopes-object-serializable'

const defaultHideWorkspaceFolders = false

export class ScopedPathsConfig extends FeatureConfig {
  public onChange?: Function

  private _scopesObject: Record<string, string[]> = {}
  private _hideWorkspaceFolders: boolean = defaultHideWorkspaceFolders

  constructor() {
    super('ScopedPaths')
    this.load(initialConfig)
  }

  load(config = getConfig()) {
    const scopesObject = config.get<Record<string, string[]>>('scopedPaths.scopes', {})
    const hideWorkspaceFolders = config.get<boolean>('scopedPaths.hideWorkspaceFolders', defaultHideWorkspaceFolders)

    let hasChanged = false

    if (
      JSON.stringify(this._scopesObject) !== JSON.stringify(scopesObject)
      || this._hideWorkspaceFolders !== hideWorkspaceFolders
    ) {
      this._scopesObject = scopesObject
      this._hideWorkspaceFolders = hideWorkspaceFolders

      hasChanged = true
    }

    if (hasChanged) {
      this.onChange?.()
    }

    console.debug('[ScopedPaths] Config has been loaded', { hasChanged, hideWorkspaceFolders, scopesObject })

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

  getHideWorkspaceFolders() {
    return this._hideWorkspaceFolders
  }
}
