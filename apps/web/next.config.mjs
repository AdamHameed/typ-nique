/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  typedRoutes: true,
  transpilePackages: ["@typ-nique/ui", "@typ-nique/types"]
};

export default nextConfig;
