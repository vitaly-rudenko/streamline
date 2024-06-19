import { getConfig } from '../../config'
import { areObjectsShallowEqual } from '../../utils/are-objects-shallow-equal'
import { FeatureConfig } from '../feature-config'

const defaultUseRelativePaths = true
const defaultUseExcludes = true
const defaultUseStricterQuickOpenQuery = false
const defaultUseGlobalSearch = false
const defaultUseCompactPaths = false

export class RelatedFilesConfig extends FeatureConfig {
  private _customExcludes: Record<string, unknown> = {}
  private _useRelativePaths: boolean = defaultUseRelativePaths
  private _useExcludes: boolean = defaultUseExcludes
  private _useStricterQuickOpenQuery: boolean = defaultUseStricterQuickOpenQuery
  private _useGlobalSearch: boolean = defaultUseGlobalSearch
  private _useCompactPaths: boolean = defaultUseCompactPaths

  constructor() { super('RelatedFiles') }

  load() {
    const config = getConfig()
    const customExcludes = config.get<Record<string, unknown>>('relatedFiles.exclude', {})
    const useRelativePaths = config.get<boolean>('relatedFiles.useRelativePaths', defaultUseRelativePaths)
    const useExcludes = config.get<boolean>('relatedFiles.useExcludes', defaultUseExcludes)
    const useStricterQuickOpenQuery = config.get<boolean>('relatedFiles.useStricterQuickOpenQuery', defaultUseStricterQuickOpenQuery)
    const useGlobalSearch = config.get<boolean>('relatedFiles.useGlobalSearch', defaultUseGlobalSearch)
    const useCompactPaths = config.get<boolean>('relatedFiles.useCompactPaths', defaultUseCompactPaths)

    let hasChanged = false

    if (
      !areObjectsShallowEqual(this._customExcludes, customExcludes)
      || this._useRelativePaths !== useRelativePaths
      || this._useExcludes !== useExcludes
      || this._useStricterQuickOpenQuery !== useStricterQuickOpenQuery
      || this._useGlobalSearch !== useGlobalSearch
      || this._useCompactPaths !== useCompactPaths
    ) {
      this._customExcludes = customExcludes
      this._useRelativePaths = useRelativePaths
      this._useExcludes = useExcludes
      this._useStricterQuickOpenQuery = useStricterQuickOpenQuery
      this._useGlobalSearch = useGlobalSearch
      this._useCompactPaths = useCompactPaths

      hasChanged = true
    }

    console.debug('[RelatedFiles] Config has been loaded', { hasChanged, customExcludes, useRelativePaths, useExcludes, useStricterQuickOpenQuery, useGlobalSearch, useCompactPaths })

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

    await config.update(
      'relatedFiles.useGlobalSearch',
      this._useGlobalSearch !== defaultUseGlobalSearch ? this._useGlobalSearch : undefined
    )

    await config.update(
      'relatedFiles.useCompactPaths',
      this._useCompactPaths !== defaultUseCompactPaths ? this._useCompactPaths : undefined
    )

    console.debug('[RelatedFiles] Config has been saved')
  }

  getCustomExcludes() {
    return this._customExcludes
  }

  getUseStricterQuickOpenQuery() {
    return this._useStricterQuickOpenQuery
  }

  setUseCompactPaths(value: boolean) {
    this._useCompactPaths = value
  }

  getUseCompactPaths() {
    return this._useCompactPaths
  }

  setUseGlobalSearch(value: boolean) {
    this._useGlobalSearch = value
  }

  getUseGlobalSearch() {
    return this._useGlobalSearch
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
