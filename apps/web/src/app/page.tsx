'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../stores/authStore';

export default function HomePage() {
  const router = useRouter();
  const { user, loadFromStorage } = useAuthStore();

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    if (user) {
      router.push('/workflows');
    } else {
      router.push('/auth/login');
    }
  }, [user, router]);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-slate-400 text-sm animate-pulse">Loading n8npro…</div>
    </div>
  );
}
