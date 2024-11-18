import { Memento } from 'vscode'

export class SmartConfigWorkspaceState {
    private _toggles: string[] = []

    constructor(
        private readonly workspaceState: Memento
    ) {
        this.load()
    }

    private load() {
        const toggles = this.workspaceState.get<string[]>('streamline.smartConfig.toggles', [])

        this._toggles = toggles

        console.debug('[SmartConfig] WorkspaceState has been loaded', { toggles })
    }

    async save() {
        await this.workspaceState.update(
            'streamline.smartConfig.toggle',
            this._toggles.length > 0 ? this._toggles : undefined,
        )

        console.debug('[SmartConfig] WorkspaceState has been saved')
    }

    setToggles(value: string[]) {
        this._toggles = value
    }

    getToggles() {
        return this._toggles
    }
}