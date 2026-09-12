'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CalendarClock, CheckCircle2, ClipboardList, Loader2 } from 'lucide-react';

interface HomeworkItem {
  id: string;
  title: string;
  subjectName: string | null;
  topicName: string | null;
  dueAt: string | null;
}

interface ChildHomework {
  studentId: string;
  studentName: string;
  overdue: HomeworkItem[];
  dueSoon: HomeworkItem[];
  later: HomeworkItem[];
  counts: { overdue: number; dueSoon: number; later: number };
  total: number;
}

function formatDue(dueAt: string | null): string {
  if (!dueAt) return 'No deadline';
  return new Date(dueAt).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function ParentHomeworkPage() {
  const router = useRouter();
  const [children, setChildren] = useState<ChildHomework[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHomework = useCallback(async () => {
    try {
      const response = await fetch('/api/academic/children/homework');
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      const data = await response.json();
      if (data.success) {
        setChildren(data.children);
      }
    } catch {
      console.error('Failed to fetch children homework');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchHomework();
  }, [fetchHomework]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const sections: { key: 'overdue' | 'dueSoon' | 'later'; label: string; tone: string }[] = [
    { key: 'overdue', label: 'Overdue', tone: 'text-red-600 dark:text-red-400' },
    { key: 'dueSoon', label: 'Due in the next 7 days', tone: 'text-amber-600 dark:text-amber-400' },
    { key: 'later', label: 'Later', tone: 'text-muted-foreground' },
  ];

  const totalPending = children.reduce((sum, child) => sum + child.total, 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <header className="bg-white dark:bg-slate-900 border-b border-border/60 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Homework</h1>
              <p className="text-sm text-muted-foreground">
                What your children still owe
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => router.push('/parent')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        {totalPending === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 border border-border/60 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <p className="text-muted-foreground">
              Nothing outstanding. Everything set has been handed in.
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {children.map((child) => (
              <section key={child.studentId}>
                <div className="flex items-baseline justify-between mb-4">
                  <h2 className="text-base font-semibold text-foreground">
                    {child.studentName}
                  </h2>
                  <span className="text-sm text-muted-foreground">
                    {child.total} outstanding
                    {child.counts.overdue > 0 ? ` · ${child.counts.overdue} overdue` : ''}
                  </span>
                </div>

                <div className="space-y-6">
                  {sections.map(({ key, label, tone }) => {
                    const items = child[key];
                    if (items.length === 0) return null;
                    return (
                      <div key={key}>
                        <h3 className={`text-sm font-medium mb-2 ${tone}`}>
                          {label} · {items.length}
                        </h3>
                        <div className="space-y-2">
                          {items.map((item) => (
                            <div
                              key={item.id}
                              className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-border/60"
                            >
                              <div className="font-medium text-foreground">{item.title}</div>
                              {item.subjectName && (
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {item.subjectName}
                                  {item.topicName ? ` · ${item.topicName}` : ''}
                                </div>
                              )}
                              <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                                <CalendarClock className="w-3.5 h-3.5" />
                                Due {formatDue(item.dueAt)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
