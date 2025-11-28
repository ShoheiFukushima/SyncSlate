/**
 * Simple test for useAppMode hook
 * CRITICAL: CLIENT mode must require NO authentication
 */

import { useAppMode } from './use-app-mode';

// Mock window.location
const mockLocation = (search: string) => {
  Object.defineProperty(window, 'location', {
    value: { search },
    writable: true,
  });
};

describe('useAppMode Hook', () => {

  test('returns CLIENT when role=client', () => {
    mockLocation('?role=client');
    expect(useAppMode()).toBe('CLIENT');
  });

  test('returns CLIENT when session parameter exists', () => {
    mockLocation('?session=abc123');
    expect(useAppMode()).toBe('CLIENT');
  });

  test('returns HOST by default', () => {
    mockLocation('');
    expect(useAppMode()).toBe('HOST');
  });

  test('returns HOST when role=host', () => {
    mockLocation('?role=host');
    expect(useAppMode()).toBe('HOST');
  });
});