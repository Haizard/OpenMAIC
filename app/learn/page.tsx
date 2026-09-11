'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { GraduationCap, LogOut, BookOpen, FileQuestion, Compass } from 'lucide-react';

interface StudentInfo {
  display_name: string;
  academic_level: string;
}

export default function LearnDashboard() {
  const router = useRouter();
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStudentInfo();
  }, []);

  const fetchStudentInfo = async () => {
    try {
      const response = await fetch('/api/academic/me');
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      const data = await response.json();
      if (data.success) {
        setStudent(data.student);
      }
    } catch {
      console.error('Failed to fetch student info');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/academic/logout', { method: 'POST' });
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-border/60 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Learn</h1>
              <p className="text-sm text-muted-foreground">
                Welcome, {student?.display_name || 'Student'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push('/learn/curriculum')}>
              <Compass className="w-4 h-4 mr-2" />
              Curriculum
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.push('/learn/quizzes')}>
              <FileQuestion className="w-4 h-4 mr-2" />
              Quizzes
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto p-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-border/60">
          <div className="text-center">
            <BookOpen className="w-16 h-16 text-blue-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">Your Learning Hub</h2>
            <p className="text-muted-foreground mb-6">
              Start creating interactive courses with AI-powered learning experiences.
            </p>

            {student?.academic_level && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-full text-sm text-muted-foreground mb-6">
                Academic Level:{' '}
                {student.academic_level.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
              </div>
            )}

            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Button size="lg" onClick={() => router.push('/learn/curriculum')}>
                <Compass className="w-5 h-5 mr-2" />
                Browse Curriculum
              </Button>
              <Button size="lg" variant="outline" onClick={() => router.push('/')}>
                <BookOpen className="w-5 h-5 mr-2" />
                Start Learning
              </Button>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-border/60">
            <div className="text-2xl font-bold text-foreground">0</div>
            <div className="text-sm text-muted-foreground">Courses Completed</div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-border/60">
            <div className="text-2xl font-bold text-foreground">0</div>
            <div className="text-sm text-muted-foreground">Hours Learned</div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-border/60">
            <div className="text-2xl font-bold text-foreground">0</div>
            <div className="text-sm text-muted-foreground">Assignments Due</div>
          </div>
        </div>
      </main>
    </div>
  );
}
