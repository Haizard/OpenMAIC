'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BellRing, CheckCircle2, Loader2 } from 'lucide-react';

interface ChildNudge {
  studentId: string;
  studentName: string;
  submitted: number;
  outstanding: number;
  overdue: number;
  readingsRead: number;
  readingsTotal: number;
  untouchedTopics: number;
  daysSinceActivity: number | null;
  nudges: string[];
}

/** Slice 6: practice activity, folded into the same mentor surface. */
interface ChildPractice {
  studentId: string;
  attempts: number;
  correct: number;
  accuracy: number;
  weakTopics: { topicId: string; topicName: string; accuracy: number }[];
}

/**
 * The parent mentor view of the guidance engine.
 *
 * A nudge is a sentence a mentor can act on, not a score. There is deliberately no ranking of
 * subjects and no grading here — rule 7: the parent mentors, they do not mark.
 */
export default function ParentNudgesPage() {
  const router = useRouter();
  const [children, setChildren] = useState<ChildNudge[] | null>(null);
  const [practice, setPractice] = useState<Map<string, ChildPractice>>(new Map());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [nudgeResponse, practiceResponse] = await Promise.all([
        fetch('/api/academic/children/nudges'),
        fetch('/api/academic/children/practice'),
      ]);
      if (nudgeResponse.status === 401) {
        router.push('/login');
        return;
      }
      const data = await nudgeResponse.json();
      if (data.success) setChildren(data.children);

      if (practiceResponse.ok) {
        const practiceData = await practiceResponse.json();
        if (practiceData.success) {
          setPractice(
            new Map(
              (practiceData.children as ChildPractice[]).map((entry) => [entry.studentId, entry]),
            ),
          );
        }
      }
    } catch {
      console.error('Failed to fetch nudges');
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <header className="bg-white dark:bg-slate-900 border-b border-border/60 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
              <BellRing className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Nudges</h1>
              <p className="text-sm text-muted-foreground">What to encourage next</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => router.push('/parent')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-4">
        {!children || children.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 border border-border/60 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-foreground mb-2">Nothing to nudge</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              No children on this account yet, or nothing outstanding for them.
            </p>
          </div>
        ) : (
          children.map((child) => (
            <section
              key={child.studentId}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-border/60 p-5"
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <h2 className="text-base font-semibold text-foreground">{child.studentName}</h2>
                <div className="text-xs text-muted-foreground">
                  {child.submitted} handed in · {child.readingsRead}/{child.readingsTotal} read
                </div>
              </div>

              {(() => {
                const drill = practice.get(child.studentId);
                if (!drill || drill.attempts === 0) return null;
                return (
                  <div className="mt-3 text-sm text-muted-foreground">
                    Practice: {drill.correct}/{drill.attempts} correct recently
                    {drill.weakTopics.length > 0 && (
                      <>
                        {' · finding '}
                        <span className="text-red-600 dark:text-red-400">
                          {drill.weakTopics.map((topic) => topic.topicName).join(', ')}
                        </span>{' '}
                        hard
                      </>
                    )}
                  </div>
                );
              })()}

              {child.nudges.length === 0 ? (
                <p className="text-sm text-muted-foreground mt-3">
                  Everything is up to date. No nudge needed.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {child.nudges.map((nudge) => (
                    <li
                      key={nudge}
                      className="flex items-start gap-2 text-sm text-foreground bg-slate-50 dark:bg-slate-800/60 rounded-lg p-3"
                    >
                      <BellRing className="w-4 h-4 mt-0.5 shrink-0 text-sky-600 dark:text-sky-400" />
                      {nudge}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))
        )}
      </main>
    </div>
  );
}
