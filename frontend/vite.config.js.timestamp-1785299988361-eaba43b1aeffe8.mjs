// vite.config.js
import { defineConfig } from "file:///C:/Users/91965/Desktop/KL%20Edge/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/91965/Desktop/KL%20Edge/node_modules/@vitejs/plugin-react/dist/index.js";
import { VitePWA } from "file:///C:/Users/91965/Desktop/KL%20Edge/node_modules/vite-plugin-pwa/dist/index.js";
var vite_config_default = defineConfig({
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8000"
    }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "KL Edge",
        short_name: "KLEdge",
        description: "Advanced KL University ERP Scraper and Attendance Tracker",
        theme_color: "#12151f"
        // icons: [
        //   {
        //     src: '/pwa-192x192.png',
        //     sizes: '192x192',
        //     type: 'image/png'
        //   },
        //   {
        //     src: '/pwa-512x512.png',
        //     sizes: '512x512',
        //     type: 'image/png'
        //   }
        // ]
      }
    })
  ]
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFw5MTk2NVxcXFxEZXNrdG9wXFxcXEtMIEVkZ2VcXFxcZnJvbnRlbmRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXDkxOTY1XFxcXERlc2t0b3BcXFxcS0wgRWRnZVxcXFxmcm9udGVuZFxcXFx2aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvOTE5NjUvRGVza3RvcC9LTCUyMEVkZ2UvZnJvbnRlbmQvdml0ZS5jb25maWcuanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJ1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xuaW1wb3J0IHsgVml0ZVBXQSB9IGZyb20gJ3ZpdGUtcGx1Z2luLXB3YSdcblxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHNlcnZlcjoge1xuICAgIHByb3h5OiB7XG4gICAgICAnL2FwaSc6ICdodHRwOi8vMTI3LjAuMC4xOjgwMDAnXG4gICAgfVxuICB9LFxuICBwbHVnaW5zOiBbXG4gICAgcmVhY3QoKSxcbiAgICBWaXRlUFdBKHtcbiAgICAgIHJlZ2lzdGVyVHlwZTogJ2F1dG9VcGRhdGUnLFxuICAgICAgbWFuaWZlc3Q6IHtcbiAgICAgICAgbmFtZTogJ0tMIEVkZ2UnLFxuICAgICAgICBzaG9ydF9uYW1lOiAnS0xFZGdlJyxcbiAgICAgICAgZGVzY3JpcHRpb246ICdBZHZhbmNlZCBLTCBVbml2ZXJzaXR5IEVSUCBTY3JhcGVyIGFuZCBBdHRlbmRhbmNlIFRyYWNrZXInLFxuICAgICAgICB0aGVtZV9jb2xvcjogJyMxMjE1MWYnLFxuICAgICAgICAvLyBpY29uczogW1xuICAgICAgICAvLyAgIHtcbiAgICAgICAgLy8gICAgIHNyYzogJy9wd2EtMTkyeDE5Mi5wbmcnLFxuICAgICAgICAvLyAgICAgc2l6ZXM6ICcxOTJ4MTkyJyxcbiAgICAgICAgLy8gICAgIHR5cGU6ICdpbWFnZS9wbmcnXG4gICAgICAgIC8vICAgfSxcbiAgICAgICAgLy8gICB7XG4gICAgICAgIC8vICAgICBzcmM6ICcvcHdhLTUxMng1MTIucG5nJyxcbiAgICAgICAgLy8gICAgIHNpemVzOiAnNTEyeDUxMicsXG4gICAgICAgIC8vICAgICB0eXBlOiAnaW1hZ2UvcG5nJ1xuICAgICAgICAvLyAgIH1cbiAgICAgICAgLy8gXVxuICAgICAgfVxuICAgIH0pXG4gIF0sXG59KSJdLAogICJtYXBwaW5ncyI6ICI7QUFBcVQsU0FBUyxvQkFBb0I7QUFDbFYsT0FBTyxXQUFXO0FBQ2xCLFNBQVMsZUFBZTtBQUd4QixJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixRQUFRO0FBQUEsSUFDTixPQUFPO0FBQUEsTUFDTCxRQUFRO0FBQUEsSUFDVjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNQLE1BQU07QUFBQSxJQUNOLFFBQVE7QUFBQSxNQUNOLGNBQWM7QUFBQSxNQUNkLFVBQVU7QUFBQSxRQUNSLE1BQU07QUFBQSxRQUNOLFlBQVk7QUFBQSxRQUNaLGFBQWE7QUFBQSxRQUNiLGFBQWE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxNQWFmO0FBQUEsSUFDRixDQUFDO0FBQUEsRUFDSDtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
