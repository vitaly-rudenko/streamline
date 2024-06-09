export abstract class FeatureConfig {
  private _saveInBackgroundQueue = Promise.resolve()
  private _isSavingInBackground = false

  constructor(private readonly featureName: string) {}

  abstract load(): boolean
  abstract save(): Promise<void>

  async saveInBackground() {
    this._saveInBackgroundQueue = this._saveInBackgroundQueue
      .then(() => {
        this._isSavingInBackground = true
        return this.save()
      })
      .catch((error) => console.warn(`[${this.featureName}] Could not save config`, error))
      .finally(() => this._isSavingInBackground = false)

    return this._saveInBackgroundQueue
  }

  get isSavingInBackground() {
    return this._isSavingInBackground
  }
}
