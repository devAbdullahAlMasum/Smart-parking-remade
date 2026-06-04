import type { CapacitorConfig } from "@capacitor/cli"

const config: CapacitorConfig = {
	appId: "com.smartparking.mobile",
	appName: "Smart Parking",
	webDir: "dist",
	server: {
		androidScheme: "https",
	},
}

export default config
