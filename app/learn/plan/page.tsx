'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookMarked,
  CheckCircle2,
  ClipboardList,
  Compass,
  FileQuestion,
  Loader2,
  Mic,
  PartyPopper,
} from 'lucide-react';

type PlanStepKind = 'homework' | 'assignment' | 'holiday' | 'reading' | 'practice';
type PlanReason =
  | 'overdue'
  | 'due_soon'
  | 'missing_recording'
  | 'in_progress'
  | 'untouched'
  | 'no_recent_practice';

interface PlanStep {
  kind: PlanStepKind;
  title: string;
  detail: string;
  topicId: string | null;
  topicName: string | null;
  subjectName: string | null;
  reason: PlanReason;
  priority: number;
  minutes: number;
  href: string;
}

interface ProgressSummary {
  submitted: number;
  outstanding: number;
  overdue: number;
  readingsRead: number;
  readingsTotal: number;
  untouchedTopics: number;
  daysSinceActivity: number | null;
}

interface StudyPlan {
  steps: PlanStep[];
  summary: ProgressSummary;
  reason: 'no_form' | null;
}

const KIND_ICON: Record<PlanStepKind, typeof ClipboardList> = {
  homework: ClipboardList,
  assignment: ClipboardList,
  holiday: PartyPopper,
  reading: BookMarked,
  practice: FileQuestion,
};

const REASON_LABEL: Record<PlanReason, string> = {
  overdue: 'Overdue',
  due_soon: 'Due soon',
  missing_recording: 'Needs recording',
  in_progress: 'Started',
  untouched: 'Not started',
  no_recent_practice: 'Stay sharp',
};

const REASON_TONE: Record<PlanReason, string> = {
  overdue: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
  due_soon: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  missing_recording:
    'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
  in_progress: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
  untouched: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  no_recent_practice: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
};

export default function PlanPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/academic/plan');
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      const data = await response.json();
      if (data.success) {
        setPlan({ steps: data.steps, summary: data.summary, reason: data.reason ?? null });
      }
    } catch {
      console.error('Failed to fetch plan');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalMinutes = plan?.steps.reduce((sum, step) => sum + step.minutes, 0) ?? 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <header className="bg-white dark:bg-slate-900 border-b border-border/60 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
              <Compass className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Your plan</h1>
              <p className="text-sm text-muted-foreground">
                {plan && plan.steps.length > 0
                  ? `About ${totalMinutes} minutes of work`
                  : 'Nothing outstanding'}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => router.push('/learn')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-6">
        {plan?.reason === 'no_form' ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 border border-border/60 text-center">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-foreground mb-2">
              We do not know your class yet
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Your plan is built from your syllabus, so we need to know which class you are in.
              Ask your parent to set your form or grade on your account.
            </p>
          </div>
        ) : (
          <>
            {plan && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Stat label="Outstanding" value={plan.summary.outstanding} tone="text-foreground" />
                <Stat
                  label="Overdue"
                  value={plan.summary.overdue}
                  tone={
                    plan.summary.overdue > 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-muted-foreground'
                  }
                />
                <Stat
                  label="Read"
                  value={`${plan.summary.readingsRead}/${plan.summary.readingsTotal}`}
                  tone="text-foreground"
                />
                <Stat
                  label="Not started"
                  value={plan.summary.untouchedTopics}
                  tone="text-muted-foreground"
                />
              </div>
            )}

            {plan && plan.steps.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 border border-border/60 text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <p className="text-muted-foreground">Nothing outstanding. Well done.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {plan?.steps.map((step, index) => {
                  const Icon = KIND_ICON[step.kind];
                  return (
                    <button
                      key={`${step.kind}-${step.topicId ?? index}-${index}`}
                      type="button"
                      onClick={() => router.push(step.href)}
                      className="w-full text-left bg-white dark:bg-slate-900 rounded-xl p-4 border border-border/60 hover:border-border transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 min-w-0">
                          <Icon className="w-5 h-5 mt-0.5 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <div className="font-medium text-foreground">{step.title}</div>
                            <div className="text-sm text-muted-foreground mt-0.5">
                              {step.detail}
                            </div>
                            {step.subjectName && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {step.subjectName}
                                {step.topicName ? ` · ${step.topicName}` : ''}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span
                            className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${REASON_TONE[step.reason]}`}
                          >
                            {step.reason === 'missing_recording' && (
                              <Mic className="w-3 h-3 inline mr-1" />
                            )}
                            {REASON_LABEL[step.reason]}
                          </span>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {step.minutes} min
                          </span>
                          <ArrowRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-border/60">
      <div className={`text-2xl font-bold ${tone}`}>{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}
