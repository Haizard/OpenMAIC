'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { GraduationCap, Users, Building2 } from 'lucide-react';

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground">Create Your Account</h1>
          <p className="text-muted-foreground mt-2">Choose how you want to join OpenMAIC</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Student Registration */}
          <Link href="/register/student" className="block">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-6 border border-border/60 hover:shadow-xl hover:border-primary/30 transition-all cursor-pointer h-full">
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                  <GraduationCap className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">Student</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  Learn with AI-powered interactive classrooms
                </p>
                <Button variant="outline" className="mt-4 w-full">
                  Register as Student
                </Button>
              </div>
            </div>
          </Link>

          {/* Parent Registration */}
          <Link href="/register/parent" className="block">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-6 border border-border/60 hover:shadow-xl hover:border-primary/30 transition-all cursor-pointer h-full">
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
                  <Users className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">Parent</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  Monitor your child&apos;s progress and learning
                </p>
                <Button variant="outline" className="mt-4 w-full">
                  Register as Parent
                </Button>
              </div>
            </div>
          </Link>

          {/* School Registration */}
          <Link href="/register/school" className="block">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-6 border border-border/60 hover:shadow-xl hover:border-primary/30 transition-all cursor-pointer h-full">
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-4">
                  <Building2 className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">School</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  Compete in debate tournaments
                </p>
                <Button variant="outline" className="mt-4 w-full">
                  Register as School
                </Button>
              </div>
            </div>
          </Link>
        </div>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="text-primary hover:underline">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
