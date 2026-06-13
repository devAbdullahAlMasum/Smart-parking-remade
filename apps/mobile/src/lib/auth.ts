import { createAuthClient } from "better-auth/react"

const authClients = new Map<string, ReturnType<typeof createAuthClient>>()
const sessionRetryDelays = [0, 250, 750]

function wait(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

export function createWebAuthClient(apiUrl: string) {
	const existing = authClients.get(apiUrl)
	if (existing) return existing

	const client = createAuthClient({
		baseURL: apiUrl,
	})

	authClients.set(apiUrl, client)
	return client
}

export async function getAuthSession(apiUrl: string) {
	const client = createWebAuthClient(apiUrl)
	let lastSession = await client.getSession()

	for (const delay of sessionRetryDelays) {
		if (lastSession.data?.user || lastSession.error) break
		if (delay > 0) await wait(delay)
		lastSession = await client.getSession()
	}

	return lastSession
}

export type AuthClient = ReturnType<typeof createWebAuthClient>
