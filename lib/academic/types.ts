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

/**
 * Map a student's stored academic level to a curriculum level id.
 * Legacy levels (`junior_secondary`, `senior_secondary`, …) fold into the current ones.
 *
 * The curriculum currently stops at A-level. University levels (`undergraduate`,
 * `postgraduate`) and `other` therefore resolve to `a_level` — the closest real content —
 * rather than dropping a university student into Standard 1.
 */
export function resolveCurriculumLevelId(academicLevel: string): string {
  return LEVEL_MAPPING[academicLevel] ?? 'a_level';
}
