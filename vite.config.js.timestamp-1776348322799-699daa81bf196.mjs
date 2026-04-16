// vite.config.js
import { defineConfig } from "file:///C:/Users/FX/Desktop/Antigravity/appsi/appsi-modern/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/FX/Desktop/Antigravity/appsi/appsi-modern/node_modules/@vitejs/plugin-react/dist/index.js";
import { VitePWA } from "file:///C:/Users/FX/Desktop/Antigravity/appsi/appsi-modern/node_modules/vite-plugin-pwa/dist/index.js";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["pwa-icon.svg"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        navigateFallback: "index.html",
        navigateFallbackAllowlist: [/^(?!\/__).*/]
      },
      manifest: {
        name: "Appsi Modern",
        short_name: "Appsi",
        description: "Sistema de Gest\xE3o Appsi",
        theme_color: "#ffffff",
        icons: [
          {
            src: "pwa-icon.svg",
            sizes: "192x192",
            type: "image/svg+xml"
          },
          {
            src: "pwa-icon.svg",
            sizes: "512x512",
            type: "image/svg+xml"
          }
        ],
        display: "standalone",
        background_color: "#ffffff",
        start_url: ".",
        scope: "."
      }
    })
  ],
  base: process.env.NODE_ENV === "production" ? "/appsi-modern/" : "/"
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxGWFxcXFxEZXNrdG9wXFxcXEFudGlncmF2aXR5XFxcXGFwcHNpXFxcXGFwcHNpLW1vZGVyblwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcRlhcXFxcRGVza3RvcFxcXFxBbnRpZ3Jhdml0eVxcXFxhcHBzaVxcXFxhcHBzaS1tb2Rlcm5cXFxcdml0ZS5jb25maWcuanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL0ZYL0Rlc2t0b3AvQW50aWdyYXZpdHkvYXBwc2kvYXBwc2ktbW9kZXJuL3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcclxuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xyXG5pbXBvcnQgeyBWaXRlUFdBIH0gZnJvbSAndml0ZS1wbHVnaW4tcHdhJ1xyXG5cclxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcclxuICAgIHBsdWdpbnM6IFtcclxuICAgICAgICByZWFjdCgpLFxyXG4gICAgICAgIFZpdGVQV0Eoe1xyXG4gICAgICAgICAgICByZWdpc3RlclR5cGU6ICdhdXRvVXBkYXRlJyxcclxuICAgICAgICAgICAgaW5jbHVkZUFzc2V0czogWydwd2EtaWNvbi5zdmcnXSxcclxuICAgICAgICAgICAgd29ya2JveDoge1xyXG4gICAgICAgICAgICAgICAgZ2xvYlBhdHRlcm5zOiBbJyoqLyoue2pzLGNzcyxodG1sLGljbyxwbmcsc3ZnfSddLFxyXG4gICAgICAgICAgICAgICAgbmF2aWdhdGVGYWxsYmFjazogJ2luZGV4Lmh0bWwnLFxyXG4gICAgICAgICAgICAgICAgbmF2aWdhdGVGYWxsYmFja0FsbG93bGlzdDogWy9eKD8hXFwvX18pLiovXVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBtYW5pZmVzdDoge1xyXG4gICAgICAgICAgICAgICAgbmFtZTogJ0FwcHNpIE1vZGVybicsXHJcbiAgICAgICAgICAgICAgICBzaG9ydF9uYW1lOiAnQXBwc2knLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdTaXN0ZW1hIGRlIEdlc3RcdTAwRTNvIEFwcHNpJyxcclxuICAgICAgICAgICAgICAgIHRoZW1lX2NvbG9yOiAnI2ZmZmZmZicsXHJcbiAgICAgICAgICAgICAgICBpY29uczogW1xyXG4gICAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgc3JjOiAncHdhLWljb24uc3ZnJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgc2l6ZXM6ICcxOTJ4MTkyJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2ltYWdlL3N2Zyt4bWwnXHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNyYzogJ3B3YS1pY29uLnN2ZycsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNpemVzOiAnNTEyeDUxMicsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdpbWFnZS9zdmcreG1sJ1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIF0sXHJcbiAgICAgICAgICAgICAgICBkaXNwbGF5OiAnc3RhbmRhbG9uZScsXHJcbiAgICAgICAgICAgICAgICBiYWNrZ3JvdW5kX2NvbG9yOiAnI2ZmZmZmZicsXHJcbiAgICAgICAgICAgICAgICBzdGFydF91cmw6ICcuJyxcclxuICAgICAgICAgICAgICAgIHNjb3BlOiAnLidcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pXHJcbiAgICBdLFxyXG4gICAgYmFzZTogcHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09ICdwcm9kdWN0aW9uJyA/ICcvYXBwc2ktbW9kZXJuLycgOiAnLycsXHJcbn0pXHJcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBc1YsU0FBUyxvQkFBb0I7QUFDblgsT0FBTyxXQUFXO0FBQ2xCLFNBQVMsZUFBZTtBQUd4QixJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUN4QixTQUFTO0FBQUEsSUFDTCxNQUFNO0FBQUEsSUFDTixRQUFRO0FBQUEsTUFDSixjQUFjO0FBQUEsTUFDZCxlQUFlLENBQUMsY0FBYztBQUFBLE1BQzlCLFNBQVM7QUFBQSxRQUNMLGNBQWMsQ0FBQyxnQ0FBZ0M7QUFBQSxRQUMvQyxrQkFBa0I7QUFBQSxRQUNsQiwyQkFBMkIsQ0FBQyxhQUFhO0FBQUEsTUFDN0M7QUFBQSxNQUNBLFVBQVU7QUFBQSxRQUNOLE1BQU07QUFBQSxRQUNOLFlBQVk7QUFBQSxRQUNaLGFBQWE7QUFBQSxRQUNiLGFBQWE7QUFBQSxRQUNiLE9BQU87QUFBQSxVQUNIO0FBQUEsWUFDSSxLQUFLO0FBQUEsWUFDTCxPQUFPO0FBQUEsWUFDUCxNQUFNO0FBQUEsVUFDVjtBQUFBLFVBQ0E7QUFBQSxZQUNJLEtBQUs7QUFBQSxZQUNMLE9BQU87QUFBQSxZQUNQLE1BQU07QUFBQSxVQUNWO0FBQUEsUUFDSjtBQUFBLFFBQ0EsU0FBUztBQUFBLFFBQ1Qsa0JBQWtCO0FBQUEsUUFDbEIsV0FBVztBQUFBLFFBQ1gsT0FBTztBQUFBLE1BQ1g7QUFBQSxJQUNKLENBQUM7QUFBQSxFQUNMO0FBQUEsRUFDQSxNQUFNLFFBQVEsSUFBSSxhQUFhLGVBQWUsbUJBQW1CO0FBQ3JFLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
