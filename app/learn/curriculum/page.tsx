'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  ChevronDown,
  GraduationCap,
  School,
  Sparkles,
} from 'lucide-react';

interface Topic {
  id: string;
  name: string;
  slug: string;
  description: string;
  sort_order: number;
}

interface Subject {
  id: string;
  name: string;
  slug: string;
  description: string;
  sort_order: number;
  topics: Topic[];
}

interface Form {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  subjects: Subject[];
}

interface Level {
  id: string;
  name: string;
  slug: string;
  description: string;
  sort_order: number;
  forms: Form[];
}

export default function CurriculumBrowser() {
  const router = useRouter();
  const [curriculum, setCurriculum] = useState<Level[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [selectedForm, setSelectedForm] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);

  useEffect(() => {
    fetchCurriculum();
  }, []);

  const fetchCurriculum = async () => {
    try {
      const res = await fetch('/api/academic/curriculum');
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      const data = await res.json();
      if (data.success) {
        setCurriculum(data.curriculum);
        // Auto-select student's level
        if (data.studentLevel) {
          const matchingLevel = data.curriculum.find(
            (l: Level) => l.slug === data.studentLevel || l.id === data.studentLevel,
          );
          if (matchingLevel) setSelectedLevel(matchingLevel.id);
        }
      }
    } catch {
      console.error('Failed to fetch curriculum');
    } finally {
      setLoading(false);
    }
  };

  const handleLearnTopic = (topic: Topic, subject: Subject, form: Form, level: Level) => {
    // Store selection and navigate to generation
    const selection = {
      level: level.name,
      form: form.name,
      subject: subject.name,
      topic: topic.name,
      description: topic.description,
    };
    sessionStorage.setItem('curriculumSelection', JSON.stringify(selection));
    router.push('/');
  };

  const getLevelIcon = (slug: string) => {
    switch (slug) {
      case 'primary':
        return <BookOpen className="w-6 h-6" />;
      case 'secondary':
        return <GraduationCap className="w-6 h-6" />;
      case 'a-level':
        return <School className="w-6 h-6" />;
      default:
        return <BookOpen className="w-6 h-6" />;
    }
  };

  const getLevelColor = (slug: string) => {
    switch (slug) {
      case 'primary':
        return 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400';
      case 'secondary':
        return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400';
      case 'a-level':
        return 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400';
      default:
        return 'bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading curriculum...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-border/60 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.push('/learn')}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Curriculum</h1>
              <p className="text-sm text-muted-foreground">
                Browse subjects and topics by education level
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6">
        {/* Level Selection */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-4">Education Level</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {curriculum.map((level) => (
              <button
                key={level.id}
                onClick={() => {
                  setSelectedLevel(level.id);
                  setSelectedForm(null);
                  setSelectedSubject(null);
                }}
                className={`p-6 rounded-xl border-2 text-left transition-all ${
                  selectedLevel === level.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border/60 hover:border-border hover:bg-muted/30'
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${getLevelColor(level.slug)}`}
                >
                  {getLevelIcon(level.slug)}
                </div>
                <h3 className="font-semibold text-foreground mb-1">{level.name}</h3>
                <p className="text-sm text-muted-foreground">{level.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Form Selection */}
        {selectedLevel && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">Select Form/Grade</h2>
            <div className="flex flex-wrap gap-3">
              {curriculum
                .find((l) => l.id === selectedLevel)
                ?.forms.map((form) => (
                  <button
                    key={form.id}
                    onClick={() => {
                      setSelectedForm(form.id);
                      setSelectedSubject(null);
                    }}
                    className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                      selectedForm === form.id
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border/60 hover:border-border hover:bg-muted/30'
                    }`}
                  >
                    {form.name}
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* Subject Selection */}
        {selectedForm && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">Select Subject</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {curriculum
                .find((l) => l.id === selectedLevel)
                ?.forms.find((f) => f.id === selectedForm)
                ?.subjects.map((subject) => (
                  <button
                    key={subject.id}
                    onClick={() => setSelectedSubject(subject.id)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      selectedSubject === subject.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border/60 hover:border-border hover:bg-muted/30'
                    }`}
                  >
                    <h3 className="font-medium text-foreground">{subject.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{subject.description}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {subject.topics.length} topics
                    </p>
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* Topic List */}
        {selectedSubject && (
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-4">Topics</h2>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-border/60 divide-y divide-border/60">
              {curriculum
                .find((l) => l.id === selectedLevel)
                ?.forms.find((f) => f.id === selectedForm)
                ?.subjects.find((s) => s.id === selectedSubject)
                ?.topics.map((topic) => {
                  const level = curriculum.find((l) => l.id === selectedLevel)!;
                  const form = level.forms.find((f) => f.id === selectedForm)!;
                  const subject = form.subjects.find((s) => s.id === selectedSubject)!;

                  return (
                    <div key={topic.id} className="p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-foreground">{topic.name}</h3>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{topic.description}</p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleLearnTopic(topic, subject, form, level)}
                          className="ml-4"
                        >
                          <Sparkles className="w-4 h-4 mr-1" />
                          Learn
                        </Button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!selectedLevel && (
          <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-border/60">
            <GraduationCap className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Select Your Education Level
            </h3>
            <p className="text-sm text-muted-foreground">
              Choose your education level above to browse available subjects and topics.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
