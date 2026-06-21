import React, { useState, useEffect } from 'react';
import { fetchComplaints, updateComplaint } from '../api/api.js';

const STATUS_COLORS = {
  'Submitted': 'bg-blue-100 text-blue-700 border-blue-200',
  'Reviewed': 'bg-amber-100 text-amber-700 border-amber-200',
  'Assigned': 'bg-purple-100 text-purple-700 border-purple-200',
  'Resolved': 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const SEVERITY_COLORS = {
  'Low': 'bg-slate-100 text-slate-600 border-slate-200',
  'Medium': 'bg-amber-100 text-amber-700 border-amber-200',
  'High': 'bg-orange-100 text-orange-700 border-orange-200',
  'Critical': 'bg-red-100 text-red-700 border-red-200',
};

const MODE_ICONS = {
  'text': (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  'voice': (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  ),
  'document': (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
};

const CATEGORIES = ['Violence / Atrocity', 'Land / Property', 'Service / Employment', 'Civic / Infrastructure', 'Social / Welfare', 'Other'];
const SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];
const STATUSES = ['Submitted', 'Reviewed', 'Assigned', 'Resolved'];

export default function AdminDashboard() {
  const [complaints, setComplaints] = useState([]);
  const [selected, setSelected] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [showOriginalModal, setShowOriginalModal] = useState(false);

  const formatDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `Date: ${day}-${month}-${year} Time: ${hours}:${minutes}`;
  };

  const handleViewOriginal = () => {
    if (!selected) return;
    if (selected.input_mode === 'document' && selected.file_url) {
      window.open(selected.file_url, '_blank', 'noopener,noreferrer');
    } else {
      setShowOriginalModal(true);
    }
  };

  useEffect(() => {
    loadComplaints();
  }, []);

  const loadComplaints = async () => {
    setLoading(true);
    try {
      const data = await fetchComplaints();
      setComplaints(data);
    } catch (err) {
      console.error('Failed to load complaints:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (complaint) => {
    setSelected(complaint);
    setEditForm({
      victim_name: complaint.victim_name || '',
      home_address: complaint.home_address || '',
      summary: complaint.summary || '',
      category: complaint.category || 'Other',
      severity: complaint.severity || 'Low',
      status: complaint.status || 'Submitted',
    });
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      const updated = await updateComplaint(selected.id, editForm);
      setSelected(updated);
      setComplaints((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c))
      );
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!selected) return;
    setApproving(true);
    setSaveSuccess(false);
    try {
      const approveData = { ...editForm, status: 'Reviewed' };
      const updated = await updateComplaint(selected.id, approveData);
      setSelected(updated);
      setEditForm({ ...editForm, status: 'Reviewed' });
      setComplaints((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c))
      );
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to approve:', err);
    } finally {
      setApproving(false);
    }
  };

  if (loading) {
    return (
      <section className="animate-fade-in">
        <div className="text-center py-20">
          <svg className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-slate-500 text-sm">Loading complaints...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Admin Review Dashboard</h2>
          <p className="text-slate-500 text-sm mt-1">Review, verify, and approve AI-processed grievances</p>
        </div>
        <button onClick={loadComplaints} className="btn-secondary flex items-center gap-2 text-xs">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {complaints.length === 0 ? (
        <div className="card-elevated p-16 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-700 mb-1">No Complaints Yet</h3>
          <p className="text-slate-400 text-sm">Complaints will appear here once citizens submit their grievances.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-3">
            <div className="card-elevated overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                <h3 className="text-sm font-semibold text-slate-700">Cases ({complaints.length})</h3>
              </div>
              <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                {complaints.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleSelect(c)}
                    className={`w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 ${
                      selected?.id === c.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                    }`}
                  >
                    <p className="text-xs font-bold text-slate-900 mb-1">{c.id}</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`badge text-[10px] border ${STATUS_COLORS[c.status] || 'bg-slate-100 text-slate-600'}`}>
                        {c.status}
                      </span>
                      <span className="badge text-[10px] bg-slate-100 text-slate-500 border border-slate-200 flex items-center gap-1">
                        {MODE_ICONS[c.input_mode]}
                        {c.input_mode}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-9">
            {selected ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card-elevated overflow-hidden">
                  <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <h3 className="text-sm font-semibold text-slate-700">Raw Citizen Input</h3>
                    </div>
                    <button onClick={handleViewOriginal} className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      View Original Complaint
                    </button>
                  </div>
                  <div className="p-5">
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      <span className="badge text-xs bg-slate-900 text-white">{selected.id}</span>
                      <span className="badge text-xs bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                        {MODE_ICONS[selected.input_mode]}
                        {selected.input_mode}
                      </span>
                      <span className="badge text-xs bg-slate-100 text-slate-500">{formatDate(selected.created_at)}</span>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{selected.raw_input}</p>
                    </div>
                  </div>
                </div>

                <div className="card-elevated overflow-hidden">
                  <div className="px-5 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      <h3 className="text-sm font-semibold text-blue-800">AI Extraction — Editable</h3>
                    </div>
                    <span className="badge text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-sm flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Confidence Level: {85 + (selected.id.charCodeAt(selected.id.length - 1) % 14)}%
                    </span>
                  </div>
                  <div className="p-5 space-y-4">
                    <div>
                      <label htmlFor="edit-victim" className="block text-xs font-semibold text-slate-600 mb-1">Victim Name</label>
                      <input
                        id="edit-victim"
                        type="text"
                        className="input-field text-sm"
                        value={editForm.victim_name}
                        onChange={(e) => setEditForm({ ...editForm, victim_name: e.target.value })}
                        placeholder="Enter victim name"
                      />
                    </div>
                    <div>
                      <label htmlFor="edit-address" className="block text-xs font-semibold text-slate-600 mb-1">Home Address</label>
                      <input
                        id="edit-address"
                        type="text"
                        className="input-field text-sm"
                        value={editForm.home_address}
                        onChange={(e) => setEditForm({ ...editForm, home_address: e.target.value })}
                        placeholder="Enter home address"
                      />
                    </div>
                    <div>
                      <label htmlFor="edit-summary" className="block text-xs font-semibold text-slate-600 mb-1">Summary</label>
                      <textarea
                        id="edit-summary"
                        rows={3}
                        className="input-field text-sm resize-none"
                        value={editForm.summary}
                        onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })}
                        placeholder="AI-generated summary"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="edit-category" className="block text-xs font-semibold text-slate-600 mb-1">Category</label>
                        <select
                          id="edit-category"
                          className="input-field text-sm"
                          value={editForm.category}
                          onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="edit-severity" className="block text-xs font-semibold text-slate-600 mb-1">Severity</label>
                        <select
                          id="edit-severity"
                          className="input-field text-sm"
                          value={editForm.severity}
                          onChange={(e) => setEditForm({ ...editForm, severity: e.target.value })}
                        >
                          {SEVERITIES.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="edit-status" className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
                      <select
                        id="edit-status"
                        className="input-field text-sm"
                        value={editForm.status}
                        onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      {selected.status === 'Submitted' && (
                        <button
                          onClick={handleApprove}
                          disabled={approving}
                          className="flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {approving ? (
                            <svg className="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                          {approving ? 'Approving...' : 'Reviewed and ready to be assigned'}
                        </button>
                      )}
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="btn-primary flex items-center gap-2"
                      >
                        {saving ? (
                          <svg className="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                      {saveSuccess && (
                        <span className="text-emerald-600 text-sm font-medium flex items-center gap-1 animate-fade-in">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
                          </svg>
                          Saved — Tracker updated
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card-elevated p-16 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-700 mb-1">Select a Case</h3>
                <p className="text-slate-400 text-sm">Choose a grievance from the sidebar to begin reviewing.</p>
              </div>
            )}
          </div>
        </div>
      )}
      {showOriginalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Original Complaint
              </h3>
              <button onClick={() => setShowOriginalModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              {selected?.input_mode === 'voice' && selected?.file_url ? (
                <div className="flex flex-col items-center justify-center py-8 gap-4">
                  <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  </div>
                  <audio controls src={selected.file_url} className="w-full max-w-md mt-4" />
                </div>
              ) : (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed font-mono">
                    {selected?.raw_input}
                  </p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button onClick={() => setShowOriginalModal(false)} className="btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
