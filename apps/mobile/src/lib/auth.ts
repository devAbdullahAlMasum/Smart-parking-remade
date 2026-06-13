import { createAuthClient } from "better-auth/react"

const authClients = new Map<string, ReturnType<typeof createAuthClient>>()

export function createWebAuthClient(apiUrl: string) {
	const existing = authClients.get(apiUrl)
	if (existing) return existing

	const client = createAuthClient({
		baseURL: apiUrl,
	})

	authClients.set(apiUrl, client)
	return client
}

export type AuthClient = ReturnType<typeof createWebAuthClient>
