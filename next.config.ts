import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/embed",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' http://localhost:* http://127.0.0.1:* https://demo-m4tn.onrender.com *",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
