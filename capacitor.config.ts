import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.yuejie.news",
  appName: "阅界",
  webDir: "dist",
  // 页面资源全部打进 APK，只有接口走局域网；http 方案下明文接口才不会被当成混合内容拦掉
  androidScheme: "http",
  android: {
    // -release 包不放行 DevTools，避免任何人连上手机就能读走 WebView 里的数据
    webContentsDebuggingEnabled: false,
  },
};

export default config;
