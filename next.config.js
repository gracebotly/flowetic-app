/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@mastra/core',
    '@mastra/memory',
    '@mastra/libsql',
    '@mastra/mcp',
    '@mastra/pg'
  ],
  experimental: {
    serverComponentsExternalPackages: ['@mastra/core']
  }
};

module.exports = nextConfig;