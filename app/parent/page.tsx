'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ACADEMIC_LEVELS } from '@/lib/academic/types';
import { GraduationCap, Plus, LogOut, User, FileQuestion } from 'lucide-react';

interface Child {
  id: string;
  display_name: string;
  academic_level: string;
  email: string;
}

export default function ParentDashboard() {
  const router = useRouter();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddChild, setShowAddChild] = useState(false);
  const [addChildLoading, setAddChildLoading] = useState(false);
  const [addChildError, setAddChildError] = useState('');
  const [newChild, setNewChild] = useState({
    studentEmail: '',
    studentPassword: '',
    studentDisplayName: '',
    academicLevel: 'primary',
  });

  useEffect(() => {
    fetchChildren();
  }, []);

  const fetchChildren = async () => {
    try {
      const response = await fetch('/api/academic/children');
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      const data = await response.json();
      if (data.success) {
        setChildren(data.children);
      }
    } catch {
      console.error('Failed to fetch children');
    } finally {
      setLoading(false);
    }
  };

  const handleAddChild = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddChildError('');
    setAddChildLoading(true);

    try {
      const response = await fetch('/api/academic/children', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newChild),
      });

      const data = await response.json();

      if (!response.ok) {
        setAddChildError(data.error || 'Failed to add child');
        return;
      }

      setShowAddChild(false);
      setNewChild({
        studentEmail: '',
        studentPassword: '',
        studentDisplayName: '',
        academicLevel: 'primary',
      });
      await fetchChildren();
    } catch {
      setAddChildError('An error occurred. Please try again.');
    } finally {
      setAddChildLoading(false);
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
            <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <User className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Parent Dashboard</h1>
              <p className="text-sm text-muted-foreground">Monitor your children&apos;s learning</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push('/parent/quizzes')}>
              <FileQuestion className="w-4 h-4 mr-2" />
              Quiz Results
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
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-foreground">My Children</h2>
          <Button onClick={() => setShowAddChild(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Child
          </Button>
        </div>

        {children.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-border/60">
            <GraduationCap className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No children yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add your first child to start monitoring their learning progress.
            </p>
            <Button onClick={() => setShowAddChild(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Child
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {children.map((child) => (
              <div
                key={child.id}
                className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-border/60 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <GraduationCap className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground">{child.display_name}</h3>
                    <p className="text-sm text-muted-foreground">{child.email}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Level: {child.academic_level.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Progress</div>
                    <div className="text-lg font-semibold text-foreground">--</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Child Modal */}
        {showAddChild && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-6 w-full max-w-md border border-border/60">
              <h3 className="text-lg font-semibold text-foreground mb-4">Add New Child</h3>
              
              <form onSubmit={handleAddChild} className="space-y-4">
                {addChildError && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <p className="text-sm text-destructive">{addChildError}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="childName">Child&apos;s Name</Label>
                  <Input
                    id="childName"
                    value={newChild.studentDisplayName}
                    onChange={(e) => setNewChild((prev) => ({ ...prev, studentDisplayName: e.target.value }))}
                    placeholder="John Doe"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="childEmail">Child&apos;s Email</Label>
                  <Input
                    id="childEmail"
                    type="email"
                    value={newChild.studentEmail}
                    onChange={(e) => setNewChild((prev) => ({ ...prev, studentEmail: e.target.value }))}
                    placeholder="student@example.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="childPassword">Password</Label>
                  <Input
                    id="childPassword"
                    type="password"
                    value={newChild.studentPassword}
                    onChange={(e) => setNewChild((prev) => ({ ...prev, studentPassword: e.target.value }))}
                    placeholder="••••••••"
                    minLength={8}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="childLevel">Academic Level</Label>
                  <select
                    id="childLevel"
                    value={newChild.academicLevel}
                    onChange={(e) => setNewChild((prev) => ({ ...prev, academicLevel: e.target.value }))}
                    className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                    required
                  >
                    {ACADEMIC_LEVELS.map((level) => (
                      <option key={level} value={level}>
                        {level.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-3">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setShowAddChild(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1" disabled={addChildLoading}>
                    {addChildLoading ? 'Adding...' : 'Add Child'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
