import * as Ably from "ably"

export interface VehicleMovementAlert {
	userId: number
	sessionId: number
	slotCode: string
	title: string
	body: string
	publishedAt: string
}

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
		subscribeVehicleMovement(onAlert: (alert: VehicleMovementAlert) => void) {
			channel.subscribe("vehicle_movement", (message) => {
				const alert = message.data as VehicleMovementAlert
				if (alert.userId === userId) onAlert(alert)
			})
		},
		unsubscribeVehicleMovement() {
			channel.unsubscribe("vehicle_movement")
		},
		close() {
			client.close()
		},
	}
}
