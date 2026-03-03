/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    turbopack: true,
    turbopackRoot: __dirname, // ensures Turbopack sees this folder as root
  },
};

module.exports = nextConfig;