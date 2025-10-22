import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest(async () => ({
  manifest_version: 3,
  name: "Pulse Kit",
  version: "0.1.0",
  description: "IdeaEngine + ReplyCopilot assistant for X.",
  action: {
    default_popup: "popup.html",
  },
  background: {
    service_worker: "src/background.ts",
    type: "module",
  },
  permissions: ["storage", "activeTab", "scripting"],
  host_permissions: ["https://x.com/*", "https://twitter.com/*"],
  content_scripts: [
    {
      matches: ["https://x.com/*", "https://twitter.com/*"],
      js: ["src/content/index.tsx"],
      run_at: "document_idle",
    },
  ],
  icons: {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png",
  },
}));
