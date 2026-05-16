const nextConfig = {
  reactStrictMode: true,
  experimental: {
    externalDir: true
  },
  async rewrites() {
    return [{
      source: "/api/:path*",
      destination: "http://localhost:8000/api/:path*"
    }];
  }
};

export default nextConfig;
