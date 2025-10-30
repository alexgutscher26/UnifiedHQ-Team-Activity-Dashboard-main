import { Metadata } from 'next';
import { MemoryLeakDashboard } from '@/components/memory-leak-dashboard';

export const metadata: Metadata = {
  title: 'Memory Leak Dashboard | UnifiedHQ',
  description: 'Monitor and analyze memory leaks in your application',
};

export default function MemoryLeakDashboardPage() {
  return (
    <div className='container mx-auto py-6'>
      <MemoryLeakDashboard />
    </div>
  );
}
