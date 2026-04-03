/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true
  },
  transpilePackages: ["@typ-nique/ui", "@typ-nique/types"]
};

export default nextConfig;
