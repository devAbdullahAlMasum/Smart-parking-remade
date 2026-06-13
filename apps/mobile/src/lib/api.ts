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
	function reportClientLog(payload: Record<string, unknown>) {
		try {
			const logUrl = new URL("/api/client-log", url).toString()
			void fetch(logUrl, {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			})
		} catch {
			// If URL parsing fails, the user-facing error below is still the useful part.
		}
	}

	let response: Response
	try {
		response = await fetch(url, {
			credentials: "include",
			...options,
		})
	} catch (error) {
		const method = options?.method ?? "GET"
		const message = error instanceof Error ? error.message : String(error)
		const hint = url.includes("localhost") || url.includes("127.0.0.1")
			? "This URL points to the phone/browser itself. Use the Tailscale address http://100.85.28.79:8881."
			: "Check that the server is running on 0.0.0.0:8881 and that this device is connected to Tailscale."

		console.error("[api] fetch failed", {
			url,
			method,
			message,
			hint,
		})
		reportClientLog({
			level: "error",
			message: `Fetch failed: ${message}`,
			url,
			method,
			hint,
		})

		throw new Error(`Failed to fetch ${method} ${url}. ${hint}`)
	}

	const text = await response.text()
	const data = text ? JSON.parse(text) : {}

	if (!response.ok) {
		const method = options?.method ?? "GET"
		console.error("[api] request failed", {
			url,
			method,
			status: response.status,
			body: data,
		})
		reportClientLog({
			level: "error",
			message: "HTTP request failed",
			url,
			method,
			status: response.status,
			body: data,
		})
		throw new Error(
			(data as { message?: string }).message ??
				`Request failed (${response.status})`,
		)
	}

	return data as T
}
