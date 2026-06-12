export interface User {
	id: number
	authUserId?: string | null
	name: string
	phone: string
	licenseNumber: string
	vehicleNumber: string
	isDemo?: boolean
	createdAt: string
	updatedAt: string
}

export interface ParkingSession {
	id: number
	userId: number
	userName: string
	slotId: number
	slotCode: string
	status: "active" | "parked" | "departing" | "exited"
	assignedAt: string
	exitedAt?: string
	emptySince?: string
	departingSince?: string
}

export interface Parking {
	id: number
	name: string
	code: string
	updatedAt: string
}

export interface StatusData {
	session: ParkingSession | null
	lockdown: boolean
}
