import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  reactStrictMode: true,
  // 伺服器端套件不要被打包進瀏覽器
  serverExternalPackages: ['postgres'],
};

export default nextConfig;
