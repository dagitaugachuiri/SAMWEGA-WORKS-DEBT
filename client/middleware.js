import { NextResponse } from 'next/server';

// List of allowed IP addresses
const ALLOWED_IPS = ['127.0.0.1', '::1', '192.168.1.100', '203.0.113.10'];

export function middleware(request) {
  // Get client IP from headers (X-Forwarded-For for proxies, or remoteAddress)
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.ip || 'unknown';

  // Check if the client's IP is in the allowed list
  const isAllowed = ALLOWED_IPS.includes(clientIp);

  // Create a response
  const response = NextResponse.next();

  // Set a custom header to indicate if the IP is allowed
  response.headers.set('x-ip-allowed', isAllowed.toString());

  // Optionally, you can redirect or rewrite to an error page for unauthorized IPs
  if (!isAllowed) {
    // You can redirect to a custom error page or return a response
    // For now, we'll let the request proceed and handle UI in _app.jsx
  }

  return response;
}

// Apply middleware to all routes
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};