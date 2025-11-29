import Link from 'next/link';
import { Camera, LayoutDashboard, Settings } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold mb-12 text-slate-700">KJ Toilet Checker</h1>

      <div className="grid gap-6 w-full max-w-md">
        <Link href="/capture" className="bg-teal-600 p-6 rounded-xl flex items-center gap-4 hover:bg-teal-500 transition-colors text-white shadow-md">
          <div className="bg-teal-500 p-3 rounded-full">
            <Camera size={32} />
          </div>
          <div>
            <div className="text-xl font-bold">Check / Record</div>
            <div className="text-teal-100">For Staff</div>
          </div>
        </Link>

        <Link href="/dashboard" className="bg-white p-6 rounded-xl flex items-center gap-4 hover:bg-slate-100 transition-colors shadow-sm border border-slate-200">
          <div className="bg-slate-100 p-3 rounded-full text-slate-600">
            <LayoutDashboard size={32} />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-800">Dashboard</div>
            <div className="text-slate-500">View Status</div>
          </div>
        </Link>

        <Link href="/admin" className="bg-white p-6 rounded-xl flex items-center gap-4 hover:bg-slate-100 transition-colors shadow-sm border border-slate-200">
          <div className="bg-slate-100 p-3 rounded-full text-slate-600">
            <Settings size={32} />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-800">Admin</div>
            <div className="text-slate-500">Settings</div>
          </div>
        </Link>
      </div>
    </div>
  );
}
