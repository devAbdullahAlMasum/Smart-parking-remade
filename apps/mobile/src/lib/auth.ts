import { createAuthClient } from "better-auth/react"

export function createWebAuthClient(apiUrl: string) {
	return createAuthClient({
		baseURL: apiUrl,
	})
}

export type AuthClient = ReturnType<typeof createWebAuthClient>
