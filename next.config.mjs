import os from 'node:os';

// Akses dari perangkat satu jaringan kantor saat `next dev`: Next 16 memblokir sumber dev (/_next, HMR)
// dari alamat selain localhost. Yang diizinkan hanya IPv4 komputer ini sendiri; tidak berpengaruh ke build.
const ipKomputerIni = Object.values(os.networkInterfaces())
  .flat()
  .filter((a) => a && (a.family === 'IPv4' || a.family === 4) && !a.internal)
  .map((a) => a.address);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  turbopack: { root: process.cwd() },
  allowedDevOrigins: ipKomputerIni,
};
export default nextConfig;
