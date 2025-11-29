import Link from 'next/link';
import { Camera, LayoutDashboard, Settings } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold mb-12">KJ Toilet Checker</h1>

      <div className="grid gap-6 w-full max-w-md">
        <Link href="/capture" className="bg-blue-600 p-6 rounded-xl flex items-center gap-4 hover:bg-blue-500 transition-colors">
          <div className="bg-blue-500 p-3 rounded-full">
            <Camera size={32} />
          </div>
          <div>
            <div className="text-xl font-bold">Check / Record</div>
            <div className="text-blue-200">For Staff</div>
          </div>
        </Link>

        <Link href="/dashboard" className="bg-gray-800 p-6 rounded-xl flex items-center gap-4 hover:bg-gray-700 transition-colors">
          <div className="bg-gray-700 p-3 rounded-full">
            <LayoutDashboard size={32} />
          </div>
          <div>
            <div className="text-xl font-bold">Dashboard</div>
            <div className="text-gray-400">View Status</div>
          </div>
        </Link>

        <Link href="/admin" className="bg-gray-800 p-6 rounded-xl flex items-center gap-4 hover:bg-gray-700 transition-colors">
          <div className="bg-gray-700 p-3 rounded-full">
            <Settings size={32} />
          </div>
          <div>
            <div className="text-xl font-bold">Admin</div>
            <div className="text-gray-400">Settings</div>
          </div>
        </Link>
      </div>
    </div>
  );
}
