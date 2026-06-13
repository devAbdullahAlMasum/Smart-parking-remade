import { defineConfig } from "vite"
import { TanStackRouterVite } from "@tanstack/router-plugin/vite"
import viteReact from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
	server: {
		proxy: {
			"/api": {
				target: "http://127.0.0.1:8881",
				changeOrigin: true,
			},
		},
	},
	resolve: {
		alias: {
			"@": "/src",
			"#": "/src",
		},
	},
	plugins: [tailwindcss(), TanStackRouterVite(), viteReact()],
})
