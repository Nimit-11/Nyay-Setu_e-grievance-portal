import React, { useState } from 'react';
import CitizenIntake from './components/CitizenIntake.jsx';
import AdminDashboard from './components/AdminDashboard.jsx';
import PublicTracker from './components/PublicTracker.jsx';

const views = [
  { key: 'citizen', label: 'Citizen View', icon: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  )},
  { key: 'admin', label: 'Admin Dashboard', icon: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  )},
  { key: 'tracker', label: 'Public Tracker', icon: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )},
];

export default function App() {
  const [activeView, setActiveView] = useState('citizen');

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-slate-900 border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 overflow-hidden rounded-lg bg-white">
                <img src="/logo.jpg" alt="NCSC Logo" className="w-full h-full object-cover" />
              </div>
              <div>
                <h1 className="text-white font-bold text-lg leading-tight">NCSC</h1>
                <p className="text-slate-400 text-xs">e-Grievance Portal</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {views.map((view) => (
                <button
                  key={view.key}
                  onClick={() => setActiveView(view.key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    activeView === view.key
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {view.icon}
                  <span className="hidden sm:inline">{view.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="h-0.5 bg-gradient-to-r from-blue-600 via-blue-400 to-blue-600"></div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeView === 'citizen' && <CitizenIntake />}
        {activeView === 'admin' && <AdminDashboard />}
        {activeView === 'tracker' && <PublicTracker />}
      </main>

      <footer className="border-t border-slate-200 bg-white mt-12 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-slate-400 text-xs uppercase tracking-wider font-medium">powered by GEMA INDIA</p>
        </div>
      </footer>
    </div>
  );
}
