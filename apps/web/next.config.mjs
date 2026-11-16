/** @type {import('next').NextConfig} */

const isProduction = process.env.NODE_ENV === 'production';

function apiOrigin() {
  // Same fallback as the runtime client so local builds get the API origin in
  // `connect-src` even when the env file lives outside apps/web.
  const value = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  if (value === '') {
    return null;
  }
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

const api = apiOrigin();

// Next.js injects inline bootstrap scripts and Chakra/emotion inject <style>
// tags at runtime, so 'unsafe-inline' is required for script/styles. Everything
// else stays same-origin, and the API origin is the only extra connect target.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProduction ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${api === null ? '' : ` ${api}`}${isProduction ? '' : ' ws: wss:'}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  ...(isProduction
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]
    : []),
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
