/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    // src/config/navigation.ts の LEGACY_ROUTE_REDIRECTS と同じ内容（.mjs から TS を読めないため複製。
    // tests/unit/navigation.test.ts が両者の一致を検証する）。
    return [
      { source: "/favorites", destination: "/candidates", permanent: false },
      { source: "/funds", destination: "/portfolio", permanent: false },
      { source: "/simulation", destination: "/candidates", permanent: false },
      { source: "/japan", destination: "/candidates", permanent: false },
      { source: "/us", destination: "/candidates", permanent: false },
      { source: "/research/:section*", destination: "/candidates", permanent: false },
    ];
  },
};

export default nextConfig;
