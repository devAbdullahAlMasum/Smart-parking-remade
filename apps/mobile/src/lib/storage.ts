import { Preferences } from "@capacitor/preferences"

const KEYS = {
	apiUrl: "smartParking.apiUrl",
	user: "smartParking.user",
} as const

export const storage = {
	async getApiUrl(): Promise<string> {
		const { value } = await Preferences.get({ key: KEYS.apiUrl })
		return value ?? ""
	},

	async setApiUrl(url: string): Promise<void> {
		await Preferences.set({ key: KEYS.apiUrl, value: url })
	},

	async removeApiUrl(): Promise<void> {
		await Preferences.remove({ key: KEYS.apiUrl })
	},

	async getUser<T>(): Promise<T | null> {
		const { value } = await Preferences.get({ key: KEYS.user })
		if (!value) return null
		try {
			return JSON.parse(value) as T
		} catch {
			await Preferences.remove({ key: KEYS.user })
			return null
		}
	},

	async setUser<T>(user: T): Promise<void> {
		await Preferences.set({ key: KEYS.user, value: JSON.stringify(user) })
	},

	async removeUser(): Promise<void> {
		await Preferences.remove({ key: KEYS.user })
	},
}
