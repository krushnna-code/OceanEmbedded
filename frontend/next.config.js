/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const rawUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    const backendUrl = (rawUrl.startsWith('http://') || rawUrl.startsWith('https://') ? rawUrl : `https://${rawUrl}`).replace(/\/$/, '');
    return [
      {
        source: '/api-backend/:path*',
        destination: `${backendUrl}/:path*`
      }
    ];
  }
};

module.exports = nextConfig;
