import { getConfig } from '../../config'
import { areObjectsShallowEqual } from '../../utils/are-objects-shallow-equal'
import { FeatureConfig } from '../feature-config'

const defaultUseRelativePaths = true
const defaultUseExcludes = true

export class RelatedFilesConfig extends FeatureConfig {
  private _customExcludes: Record<string, unknown> = {}
  private _useRelativePaths: boolean = defaultUseRelativePaths
  private _useExcludes: boolean = defaultUseExcludes

  constructor() { super('RelatedFiles') }

  load() {
    const config = getConfig()
    const customExcludes = config.get<Record<string, unknown>>('relatedFiles.exclude', {})
    const useRelativePaths = config.get<boolean>('relatedFiles.useRelativePaths', defaultUseRelativePaths)
    const useExcludes = config.get<boolean>('relatedFiles.useExcludes', defaultUseExcludes)

    let hasChanged = false

    if (
      !areObjectsShallowEqual(this._customExcludes, customExcludes) ||
      this._useRelativePaths !== useRelativePaths ||
      this._useExcludes !== useExcludes
    ) {
      this._customExcludes = customExcludes
      this._useRelativePaths = useRelativePaths
      this._useExcludes = useExcludes

      hasChanged = true
    }

    console.debug('[RelatedFiles] Config has been loaded', { hasChanged, customExcludes, useRelativePaths, useExcludes })

    return hasChanged
  }

  async save() {
    const config = getConfig()

    await config.update(
      'relatedFiles.useRelativePaths',
      this._useRelativePaths !== defaultUseRelativePaths ? this._useRelativePaths : undefined
    )

    await config.update(
      'relatedFiles.useExcludes',
      this._useExcludes !== defaultUseExcludes ? this._useExcludes : undefined
    )

    console.debug('[RelatedFiles] Config has been saved')
  }

  getCustomExcludes() {
    return this._customExcludes
  }

  setUseRelativePaths(value: boolean) {
    this._useRelativePaths = value
  }

  getUseRelativePaths() {
    return this._useRelativePaths
  }

  setUseExcludes(value: boolean) {
    this._useExcludes = value
  }

  getUseExcludes() {
    return this._useExcludes
  }
}
