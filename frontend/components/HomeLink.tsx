import Link from 'next/link';
import { Home } from 'lucide-react';

export function HomeLink() {
  return (
    <Link 
      href="/" 
      className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-800 text-sm transition-colors"
    >
      <Home size={16} />
      <span>ホーム</span>
    </Link>
  );
}
