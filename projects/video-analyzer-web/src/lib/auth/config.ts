// AuthCentral OAuth Configuration

export const authConfig = {
  authCentralUrl: process.env.AUTHCENTRAL_URL || 'http://localhost:3900',
  clientId: process.env.AUTHCENTRAL_CLIENT_ID || 'video-ana',
  redirectUri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/callback',

  // OAuth 2.0 endpoints (corrected paths)
  authorizeUrl: `${process.env.AUTHCENTRAL_URL || 'http://localhost:3900'}/oauth/authorize`,
  tokenUrl: `${process.env.AUTHCENTRAL_URL || 'http://localhost:3900'}/oauth/token',
  revokeUrl: `${process.env.AUTHCENTRAL_URL || 'http://localhost:3900'}/oauth/revoke',

  // JWT verification
  jwksUrl: process.env.AUTHCENTRAL_JWKS_URL || `${process.env.AUTHCENTRAL_URL || 'http://localhost:3900'}/.well-known/jwks.json`,

  // Video Analyzer specific scopes (matched with AuthCentral predefined scopes)
  scopes: [
    'openid',
    'profile',
    'email',
    'video:read',
    'video:upload',
    'video:process',
    'offline_access',  // Required for refresh tokens
  ].join(' '),
}

// Validation
if (!process.env.AUTHCENTRAL_URL && process.env.NODE_ENV === 'production') {
  console.warn('⚠️  AUTHCENTRAL_URL not set, using default')
}

if (!process.env.AUTHCENTRAL_CLIENT_ID && process.env.NODE_ENV === 'production') {
  throw new Error('AUTHCENTRAL_CLIENT_ID must be set in production')
}
