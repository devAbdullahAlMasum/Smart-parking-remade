export function normalizeBaseUrl(url: string): string {
	const trimmed = url.trim()
	if (!trimmed) return ""

	const withProtocol = /^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed)
		? trimmed
		: `http://${trimmed}`

	return withProtocol.replace(/\/+$/, "")
}

export async function requestJson<T = unknown>(
	url: string,
	options?: RequestInit,
): Promise<T> {
	const response = await fetch(url, options)
	const text = await response.text()
	const data = text ? JSON.parse(text) : {}

	if (!response.ok) {
		throw new Error(
			(data as { message?: string }).message ??
				`Request failed (${response.status})`,
		)
	}

	return data as T
}
