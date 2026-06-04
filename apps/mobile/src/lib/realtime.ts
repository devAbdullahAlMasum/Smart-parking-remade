import * as Ably from "ably"

export function createRealtimeClient(apiUrl: string, userId: number) {
	const client = new Ably.Realtime({
		authUrl: `${apiUrl}/api/realtime/token?clientId=user-${userId}`,
		clientId: `user-${userId}`,
	})

	const channel = client.channels.get("smart-parking")

	return {
		subscribe(onRefresh: () => void) {
			channel.subscribe("refresh", onRefresh)
		},
		unsubscribe(onRefresh: () => void) {
			channel.unsubscribe("refresh", onRefresh)
		},
		close() {
			client.close()
		},
	}
}
