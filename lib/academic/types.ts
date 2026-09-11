export const USER_ROLES = ['student', 'parent', 'school'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ACADEMIC_LEVELS = [
  'primary',
  'secondary',
  'a_level',
  // Legacy levels for backward compatibility
  'junior_secondary',
  'senior_secondary',
  'undergraduate',
  'postgraduate',
  'other',
] as const;
export type AcademicLevel = (typeof ACADEMIC_LEVELS)[number];

// Map legacy levels to curriculum levels
export const LEVEL_MAPPING: Record<string, string> = {
  primary: 'primary',
  secondary: 'secondary',
  a_level: 'a_level',
  junior_secondary: 'secondary',
  senior_secondary: 'a_level',
};

export function isUserRole(value: string): value is UserRole {
  return (USER_ROLES as readonly string[]).includes(value);
}

export function isAcademicLevel(value: string): value is AcademicLevel {
  return (ACADEMIC_LEVELS as readonly string[]).includes(value);
}
