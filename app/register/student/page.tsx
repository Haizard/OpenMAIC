'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ACADEMIC_LEVELS } from '@/lib/academic/types';

export default function StudentRegisterPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    studentEmail: '',
    studentPassword: '',
    studentDisplayName: '',
    academicLevel: 'primary',
    formLevel: 'standard-1',
    parentEmail: '',
    parentPassword: '',
    parentDisplayName: '',
  });

  // Forms available for each level
  const formsByLevel: Record<string, { value: string; label: string }[]> = {
    primary: [
      { value: 'standard-1', label: 'Standard 1' },
      { value: 'standard-2', label: 'Standard 2' },
      { value: 'standard-3', label: 'Standard 3' },
      { value: 'standard-4', label: 'Standard 4' },
      { value: 'standard-5', label: 'Standard 5' },
      { value: 'standard-6', label: 'Standard 6' },
      { value: 'standard-7', label: 'Standard 7' },
    ],
    secondary: [
      { value: 'form-1', label: 'Form 1' },
      { value: 'form-2', label: 'Form 2' },
      { value: 'form-3', label: 'Form 3' },
      { value: 'form-4', label: 'Form 4' },
    ],
    a_level: [
      { value: 'form-5', label: 'Form 5' },
      { value: 'form-6', label: 'Form 6' },
    ],
    // Legacy mappings
    junior_secondary: [
      { value: 'form-1', label: 'Form 1' },
      { value: 'form-2', label: 'Form 2' },
      { value: 'form-3', label: 'Form 3' },
    ],
    senior_secondary: [
      { value: 'form-4', label: 'Form 4' },
      { value: 'form-5', label: 'Form 5' },
      { value: 'form-6', label: 'Form 6' },
    ],
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/academic/register/student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Registration failed');
        return;
      }

      // Auto-login after registration
      const loginResponse = await fetch('/api/academic/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.studentEmail, password: form.studentPassword }),
      });

      if (loginResponse.ok) {
        router.push('/learn');
      } else {
        router.push('/login');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 border border-border/60">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-foreground">Student Registration</h1>
            <p className="text-sm text-muted-foreground mt-2">Create your learning account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {/* Student Details */}
            <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
              <h3 className="text-sm font-medium text-foreground">Your Details</h3>

              <div className="space-y-2">
                <Label htmlFor="studentDisplayName">Your Name</Label>
                <Input
                  id="studentDisplayName"
                  value={form.studentDisplayName}
                  onChange={(e) => updateField('studentDisplayName', e.target.value)}
                  placeholder="John Doe"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="studentEmail">Your Email</Label>
                <Input
                  id="studentEmail"
                  type="email"
                  value={form.studentEmail}
                  onChange={(e) => updateField('studentEmail', e.target.value)}
                  placeholder="student@example.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="studentPassword">Password</Label>
                <Input
                  id="studentPassword"
                  type="password"
                  value={form.studentPassword}
                  onChange={(e) => updateField('studentPassword', e.target.value)}
                  placeholder="••••••••"
                  minLength={8}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="academicLevel">Education Level</Label>
                <select
                  id="academicLevel"
                  value={form.academicLevel}
                  onChange={(e) => {
                    const newLevel = e.target.value;
                    setForm((prev) => ({
                      ...prev,
                      academicLevel: newLevel,
                      formLevel: formsByLevel[newLevel]?.[0]?.value || '',
                    }));
                  }}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  required
                >
                  {ACADEMIC_LEVELS.filter(
                    (l) => !['junior_secondary', 'senior_secondary'].includes(l),
                  ).map((level) => (
                    <option key={level} value={level}>
                      {level === 'primary'
                        ? 'Primary Education (Standard 1-7)'
                        : level === 'secondary'
                          ? 'Secondary Education (Form 1-4)'
                          : level === 'a_level'
                            ? 'Advanced Level (Form 5-6)'
                            : level.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    </option>
                  ))}
                </select>
              </div>

              {formsByLevel[form.academicLevel] && (
                <div className="space-y-2">
                  <Label htmlFor="formLevel">Form/Grade</Label>
                  <select
                    id="formLevel"
                    value={form.formLevel}
                    onChange={(e) => updateField('formLevel', e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                    required
                  >
                    {formsByLevel[form.academicLevel].map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Parent Details */}
            <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
              <h3 className="text-sm font-medium text-foreground">Parent/Guardian Details</h3>

              <div className="space-y-2">
                <Label htmlFor="parentDisplayName">Parent Name</Label>
                <Input
                  id="parentDisplayName"
                  value={form.parentDisplayName}
                  onChange={(e) => updateField('parentDisplayName', e.target.value)}
                  placeholder="Jane Doe"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="parentEmail">Parent Email</Label>
                <Input
                  id="parentEmail"
                  type="email"
                  value={form.parentEmail}
                  onChange={(e) => updateField('parentEmail', e.target.value)}
                  placeholder="parent@example.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="parentPassword">Parent Password</Label>
                <Input
                  id="parentPassword"
                  type="password"
                  value={form.parentPassword}
                  onChange={(e) => updateField('parentPassword', e.target.value)}
                  placeholder="••••••••"
                  minLength={8}
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating Account...' : 'Create Account'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="text-primary hover:underline">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
