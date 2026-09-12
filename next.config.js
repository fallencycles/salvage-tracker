/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Default 10MB is too small for full-resolution document photos/PDFs
    // uploaded to the Engine Sales intake tools.
    middlewareClientMaxBodySize: "50mb",
  },
};
module.exports = nextConfig;
