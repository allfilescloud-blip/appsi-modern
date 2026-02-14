import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            devOptions: {
                enabled: true
            },
            includeAssets: ['pwa-icon.svg'],
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
                navigateFallback: '/appsi-modern/index.html',
                navigateFallbackAllowlist: [/^(?!\/__).*/]
            },
            manifest: {
                name: 'Appsi Modern',
                short_name: 'Appsi',
                description: 'Sistema de Gestão Appsi',
                theme_color: '#ffffff',
                icons: [
                    {
                        src: 'pwa-icon.svg',
                        sizes: '192x192',
                        type: 'image/svg+xml'
                    },
                    {
                        src: 'pwa-icon.svg',
                        sizes: '512x512',
                        type: 'image/svg+xml'
                    }
                ],
                display: 'standalone',
                background_color: '#ffffff',
                start_url: '.',
                scope: '.'
            }
        })
    ],
    base: './',
})
