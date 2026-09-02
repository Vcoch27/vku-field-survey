import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vku.fieldsurvey',
  appName: 'VKU Field Survey',
  webDir: 'dist',
  plugins: {
    // Để hỗ trợ giao diện tràn viền (Edge-to-edge), ta cần đảm bảo
    // status bar hiển thị đè lên WebView (overlay).
    StatusBar: {
      overlaysWebView: true,
    },
    // Chụp ảnh sẽ dùng Camera plugin
    Camera: {
      // Cấu hình Camera nếu cần
    }
  },
  // Tuỳ chỉnh nâng cao cho Android để hỗ trợ tràn viền
  android: {
    backgroundColor: "#00000000",
  },
  ios: {
    contentInset: "always"
  }
};

export default config;
