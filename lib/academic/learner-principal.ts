export function studentLearnerKey(studentId: string): string {
  return `user:${studentId}`;
}

export function isStudentRole(role: string): boolean {
  return role === 'student';
}
