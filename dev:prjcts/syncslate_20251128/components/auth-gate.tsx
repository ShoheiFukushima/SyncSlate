/**
 * AuthGate Component
 * CRITICAL: CLIENT mode must NEVER require authentication
 * Only HOST mode requires Clerk authentication
 */

import React from 'react';
import { useAppMode } from '../hooks/use-app-mode';

interface AuthGateProps {
  children: React.ReactNode;
}

/**
 * Authentication gate that ONLY applies to HOST mode
 * CLIENT mode completely bypasses all authentication
 */
export function AuthGate({ children }: AuthGateProps) {
  const mode = useAppMode();

  // CRITICAL: CLIENT mode MUST skip authentication completely
  if (mode === 'CLIENT') {
    return <>{children}</>;
  }

  // HOST mode: Check for Clerk authentication
  // For now, we'll just return children as Clerk setup is pending
  // TODO: Integrate Clerk here for HOST mode only
  return (
    <div className="auth-gate">
      {/* Placeholder for Clerk integration */}
      {children}
    </div>
  );
}

/**
 * Hook to check if user is authenticated
 * Returns false for CLIENT mode (no auth needed)
 */
export function useIsAuthenticated(): boolean {
  const mode = useAppMode();

  // CLIENT mode is always "authenticated" (no auth needed)
  if (mode === 'CLIENT') {
    return true;
  }

  // HOST mode: Check Clerk authentication status
  // TODO: Integrate with Clerk
  return true; // Placeholder
}

/**
 * Hook to get current user
 * Returns null for CLIENT mode
 */
export function useCurrentUser() {
  const mode = useAppMode();

  // CLIENT mode has no user concept
  if (mode === 'CLIENT') {
    return null;
  }

  // HOST mode: Get user from Clerk
  // TODO: Integrate with Clerk
  return null; // Placeholder
}