import React, { useState } from 'react';
import { trackComplaint } from '../api/api.js';

const STEPS = ['Submitted', 'Reviewed', 'Assigned', 'Resolved'];

export default function PublicTracker() {
  const [trackingId, setTrackingId] = useState('');
  const [trackResult, setTrackResult] = useState(null);
  const [error, setError] = useState(null);
  const [searching, setSearching] = useState(false);

  const formatDateSmall = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const handleTrack = async (e) => {
    e.preventDefault();
    if (!trackingId.trim()) return;
    setSearching(true);
    setError(null);
    setTrackResult(null);
    try {
      const data = await trackComplaint(trackingId.trim().toUpperCase());
      setTrackResult(data);
    } catch (err) {
      setError(err.message || 'Failed to find complaint');
    } finally {
      setSearching(false);
    }
  };

  const currentStepIndex = trackResult ? STEPS.indexOf(trackResult.status) : -1;

  return (
    <section className="animate-fade-in">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-50 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-slate-900 mb-3">Track Your Grievance</h2>
          <p className="text-slate-500 text-base">Enter your tracking ID to check the current status of your grievance.</p>
        </div>

        <form onSubmit={handleTrack} className="card-elevated p-6 mb-8">
          <div className="flex gap-3">
            <input
              type="text"
              value={trackingId}
              onChange={(e) => setTrackingId(e.target.value)}
              className="input-field flex-1 font-mono tracking-wider uppercase"
              placeholder="NCSC-XXXXXX"
              aria-label="Tracking ID"
            />
            <button
              type="submit"
              disabled={searching || !trackingId.trim()}
              className="btn-primary flex items-center gap-2 whitespace-nowrap"
            >
              {searching ? (
                <svg className="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )}
              Track
            </button>
          </div>
        </form>

        {error && (
          <div className="card-elevated p-8 text-center animate-fade-in">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-50 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">Not Found</h3>
            <p className="text-slate-500 text-sm">{error}</p>
          </div>
        )}

        {trackResult && (
          <div className="card-elevated p-8 animate-fade-in">
            <div className="flex items-center justify-between mb-8">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Tracking ID</p>
                <p className="text-lg font-bold text-slate-900 tracking-wider">{trackResult.id}</p>
              </div>
              <span className={`badge text-sm px-4 py-1.5 border ${
                currentStepIndex === 3
                  ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                  : 'bg-blue-100 text-blue-700 border-blue-200'
              }`}>
                {trackResult.status}
              </span>
            </div>

            <div className="relative mb-8">
              <div className="flex items-center justify-between">
                {STEPS.map((step, index) => {
                  const isCompleted = index <= currentStepIndex;
                  const isCurrent = index === currentStepIndex;
                  return (
                    <div key={step} className="flex flex-col items-center relative z-10" style={{ width: '25%' }}>
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-500 ${
                          isCompleted
                            ? isCurrent
                              ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/30 scale-110'
                              : 'bg-blue-600 border-blue-600 text-white'
                            : 'bg-white border-slate-300 text-slate-400'
                        }`}
                      >
                        {isCompleted ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          index + 1
                        )}
                      </div>
                      <p className={`text-xs font-semibold mt-3 text-center ${
                        isCompleted ? 'text-blue-700' : 'text-slate-400'
                      }`}>
                        {step}
                      </p>
                      {trackResult.status_timestamps && trackResult.status_timestamps[step] && (
                        <p className="text-[10px] text-slate-400 mt-0.5 font-mono text-center">
                          {formatDateSmall(trackResult.status_timestamps[step])}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="absolute top-5 left-[12.5%] right-[12.5%] h-0.5 bg-slate-200 -z-0">
                <div
                  className="h-full bg-blue-600 transition-all duration-700"
                  style={{ width: `${currentStepIndex === STEPS.length - 1 ? 100 : Math.max(0, ((currentStepIndex + 0.5) / (STEPS.length - 1)) * 100)}%` }}
                />
              </div>
            </div>

            <div className="bg-blue-50 rounded-xl p-5 border border-blue-100">
              <p className="text-xs text-blue-600 uppercase tracking-wider font-semibold mb-2">Case Summary</p>
              <p className="text-sm text-slate-700 leading-relaxed">{trackResult.summary}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
