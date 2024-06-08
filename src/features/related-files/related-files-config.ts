import { getConfig } from '../../config'
import { areObjectsShallowEqual } from '../../utils/are-objects-shallow-equal'

const defaultCustomExcludes = {}
const defaultUseRelativePaths = true
const defaultUseExcludes = true

export class RelatedFilesConfig {
  private _customExcludes: Record<string, unknown> = defaultCustomExcludes
  private _useRelativePaths: boolean = defaultUseRelativePaths
  private _useExcludes: boolean = defaultUseExcludes

  load(): boolean {
    const config = getConfig()
    const customExcludes = config.get<Record<string, unknown>>('relatedFiles.exclude', defaultCustomExcludes)
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

  get customExcludes() {
    return this._customExcludes
  }

  set useRelativePaths(value: boolean) {
    this._useRelativePaths = value
  }

  get useRelativePaths() {
    return this._useRelativePaths
  }

  set useExcludes(value: boolean) {
    this._useExcludes = value
  }

  get useExcludes() {
    return this._useExcludes
  }
}
