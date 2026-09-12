'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  GraduationCap,
  LogOut,
  BookOpen,
  FileQuestion,
  Compass,
  BookMarked,
  ClipboardList,
  PartyPopper,
  ArrowRight,
  Sparkles,
  Dumbbell,
} from 'lucide-react';

interface StudentInfo {
  display_name: string;
  academic_level: string;
}

interface PlanStep {
  kind: string;
  title: string;
  detail: string;
  reason: string;
  minutes: number;
  href: string;
}

interface PlanSummary {
  submitted: number;
  outstanding: number;
  overdue: number;
  readingsRead: number;
  readingsTotal: number;
  untouchedTopics: number;
}

const REASON_LABEL: Record<string, string> = {
  overdue: 'Overdue',
  due_soon: 'Due soon',
  missing_recording: 'Needs recording',
  in_progress: 'Started',
  untouched: 'Not started',
  no_recent_practice: 'Stay sharp',
};

export default function LearnDashboard() {
  const router = useRouter();
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [nextStep, setNextStep] = useState<PlanStep | null>(null);
  const [summary, setSummary] = useState<PlanSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStudentInfo = useCallback(async () => {
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

      // The plan is fetched alongside the profile so the dashboard can answer "what now?"
      // before the student goes looking for it.
      const planResponse = await fetch('/api/academic/plan');
      if (planResponse.ok) {
        const plan = await planResponse.json();
        if (plan.success) {
          setNextStep(plan.steps?.[0] ?? null);
          setSummary(plan.summary ?? null);
        }
      }
    } catch {
      console.error('Failed to fetch student info');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchStudentInfo();
  }, [fetchStudentInfo]);

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
            <Button variant="outline" size="sm" onClick={() => router.push('/learn/homework')}>
              <ClipboardList className="w-4 h-4 mr-2" />
              Homework
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.push('/learn/read')}>
              <BookMarked className="w-4 h-4 mr-2" />
              Read
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.push('/learn/practice')}>
              <Dumbbell className="w-4 h-4 mr-2" />
              Practice
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.push('/learn/plan')}>
              <Sparkles className="w-4 h-4 mr-2" />
              Plan
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.push('/learn/holiday')}>
              <PartyPopper className="w-4 h-4 mr-2" />
              Holiday
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

        {/* Guidance — the answer to "what should I do now?" */}
        {nextStep ? (
          <button
            type="button"
            onClick={() => router.push(nextStep.href)}
            className="w-full text-left mt-6 bg-white dark:bg-slate-900 rounded-2xl p-6 border border-border/60 hover:border-border transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <span className="text-sm font-medium text-foreground">Up next</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                {REASON_LABEL[nextStep.reason] ?? nextStep.reason}
              </span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="font-medium text-foreground">{nextStep.title}</div>
                <div className="text-sm text-muted-foreground mt-0.5">{nextStep.detail}</div>
                <div className="text-xs text-muted-foreground mt-1">{nextStep.minutes} min</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm text-muted-foreground">Start</span>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          </button>
        ) : null}

        <div className="flex justify-center mt-4">
          <Button variant="outline" size="sm" onClick={() => router.push('/learn/plan')}>
            <Compass className="w-4 h-4 mr-2" />
            See the full plan
          </Button>
        </div>

        {/* Quick Stats — real numbers, not placeholders. */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-border/60">
            <div
              className={`text-2xl font-bold ${
                (summary?.overdue ?? 0) > 0
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-foreground'
              }`}
            >
              {summary?.overdue ?? 0}
            </div>
            <div className="text-sm text-muted-foreground">Overdue</div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-border/60">
            <div className="text-2xl font-bold text-foreground">
              {summary?.outstanding ?? 0}
            </div>
            <div className="text-sm text-muted-foreground">Still to hand in</div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-border/60">
            <div className="text-2xl font-bold text-foreground">
              {summary ? `${summary.readingsRead}/${summary.readingsTotal}` : '0'}
            </div>
            <div className="text-sm text-muted-foreground">Readings finished</div>
          </div>
        </div>
      </main>
    </div>
  );
}
