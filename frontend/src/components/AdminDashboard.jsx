import React, { useState, useEffect } from 'react';
import { getGroupedComplaints, updateComplaint } from '../api/api.js';

const STATUS_COLORS = {
  'Submitted': 'bg-blue-100 text-blue-700 border-blue-200',
  'Reviewed': 'bg-amber-100 text-amber-700 border-amber-200',
  'Assigned': 'bg-purple-100 text-purple-700 border-purple-200',
  'Resolved': 'bg-emerald-100 text-emerald-700 border-emerald-200',
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

const INTERNAL_STATUSES = [
  { key: 'Submitted', label: 'Ingested & AI Structured' },
  { key: 'Desk_Reviewed', label: 'NCSC Desk Review' },
  { key: 'Jurisdiction_Routed', label: 'Regional Jurisdiction Routing' },
  { key: 'Police_Dispatched', label: 'Dispatched to Local Police Desk' },
  { key: 'Field_Investigating', label: 'Active Field Investigation' },
  { key: 'Resolved', label: 'Final Resolution & Audit Closure' }
];

const INTERNAL_STATUS_LABELS = {
  'Submitted': 'Submitted',
  'Desk_Reviewed': 'Desk Reviewed',
  'Jurisdiction_Routed': 'Jurisdiction Routed',
  'Police_Dispatched': 'Police Dispatched',
  'Field_Investigating': 'Field Investigation Active',
  'Resolved': 'Resolved'
};

const STATUSES = ['Submitted', 'Desk_Reviewed', 'Jurisdiction_Routed', 'Police_Dispatched', 'Field_Investigating', 'Resolved'];

const VerticalTracker = ({ complaint }) => {
  const currentStatusIndex = INTERNAL_STATUSES.findIndex(s => s.key === complaint.internal_status);
  
  const timelineDates = {};
  let currentKnown = complaint.created_at;
  
  if (currentStatusIndex >= 0) {
    currentKnown = complaint.status_timestamps && complaint.status_timestamps[INTERNAL_STATUSES[currentStatusIndex].key] 
      ? complaint.status_timestamps[INTERNAL_STATUSES[currentStatusIndex].key]
      : complaint.created_at;
      
    for (let i = currentStatusIndex; i >= 0; i--) {
      const statusKey = INTERNAL_STATUSES[i].key;
      if (complaint.status_timestamps && complaint.status_timestamps[statusKey]) {
        timelineDates[statusKey] = complaint.status_timestamps[statusKey];
        currentKnown = complaint.status_timestamps[statusKey];
      } else {
        timelineDates[statusKey] = currentKnown;
      }
    }
  }

  return (
    <div className="relative pl-2 py-2 space-y-6">
      {INTERNAL_STATUSES.map((status, idx) => {
        const isCompleted = idx < currentStatusIndex;
        const isActive = idx === currentStatusIndex;
        const isUpcoming = idx > currentStatusIndex;
        
        let nodeColor = 'bg-slate-200 border-slate-300';
        let lineColor = 'border-slate-200';
        let dateText = '';

        if (!isUpcoming) {
          const stepDateStr = timelineDates[status.key];
          const prevDateStr = idx === 0 ? complaint.created_at : timelineDates[INTERNAL_STATUSES[idx-1].key];
          
          const stepDate = new Date(stepDateStr);
          const prevDate = new Date(prevDateStr);
          
          const diffTime = Math.abs(stepDate - prevDate);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          const formattedDate = `${String(stepDate.getDate()).padStart(2, '0')}/${String(stepDate.getMonth() + 1).padStart(2, '0')}/${stepDate.getFullYear()}`;
          dateText = `Completed on: ${formattedDate}`;

          if (diffDays <= 2) {
            nodeColor = 'bg-emerald-500 border-emerald-600';
            lineColor = 'border-emerald-500';
          } else if (diffDays <= 6) {
            nodeColor = 'bg-amber-500 border-amber-600';
            lineColor = 'border-amber-500';
          } else {
            nodeColor = 'bg-red-600 border-red-700';
            lineColor = 'border-red-600';
          }
        }

        return (
          <div key={status.key} className="relative">
            {idx < INTERNAL_STATUSES.length - 1 && (
              <div className={`absolute left-2.5 top-6 bottom-[-24px] w-0.5 border-l-2 ${lineColor}`}></div>
            )}
            <div className="flex items-start gap-3">
              <div className={`relative z-10 w-5 h-5 rounded-full border-2 ${nodeColor} mt-0.5 shadow-sm flex-shrink-0 flex items-center justify-center`}>
                {!isUpcoming && (
                  <svg className="w-3 h-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div>
                <h4 className={`text-sm font-semibold ${isUpcoming ? 'text-slate-400' : 'text-slate-900'}`}>
                  {status.label}
                </h4>
                {!isUpcoming && (
                  <p className="text-xs text-slate-500 mt-1">{dateText}</p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default function AdminDashboard() {
  const [citizens, setCitizens] = useState([]);
  const [expandedAadhaar, setExpandedAadhaar] = useState(null);
  const [selected, setSelected] = useState(null);
  const [activeCitizen, setActiveCitizen] = useState(null);
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
    return `${day}/${month}/${year} | ${hours}:${minutes}`;
  };

  const maskAadhaar = (aadhaar) => {
    if (!aadhaar) return '';
    if (aadhaar.length <= 4) return aadhaar;
    return `XXXX-XXXX-${aadhaar.slice(-4)}`;
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
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getGroupedComplaints();
      
      // Filter out citizens with no complaints
      let activeCitizens = data.filter(cit => cit.complaints && cit.complaints.length > 0);
      
      // Sort each citizen's complaints so the most recent is at the top
      activeCitizens.forEach(cit => {
        cit.complaints.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      });

      // Sort citizens based on their most recent complaint (newest first)
      activeCitizens.sort((a, b) => {
        const latestA = new Date(a.complaints[0].created_at).getTime();
        const latestB = new Date(b.complaints[0].created_at).getTime();
        return latestB - latestA;
      });

      setCitizens(activeCitizens);
      return activeCitizens;
    } catch (err) {
      console.error('Failed to load grouped complaints:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleAccordion = (aadhaar) => {
    if (expandedAadhaar === aadhaar) {
      setExpandedAadhaar(null);
    } else {
      setExpandedAadhaar(aadhaar);
    }
  };

  const handleSelect = (complaint, citizen) => {
    setSelected(complaint);
    setActiveCitizen(citizen);
    setEditForm({
      victim_name: complaint.victim_name || citizen.name || '',
      phone_number: citizen.mobile_number || '',
      home_address: complaint.home_address || citizen.home_address || '',
      summary: complaint.summary || '',
      category: complaint.category || 'Other',
      severity: complaint.severity || 'Low',
      internal_status: complaint.internal_status || 'Submitted',
    });
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      await updateComplaint(selected.id, editForm);
      // Because we modified citizen phone and complaint info, reloading is safest
      const updatedCitizens = await loadData();
      
      if (updatedCitizens) {
        let found = false;
        for (const cit of updatedCitizens) {
          const comp = cit.complaints.find(c => c.id === selected.id);
          if (comp) {
            setSelected(comp);
            setActiveCitizen(cit);
            found = true;
            break;
          }
        }
        if (!found) {
          setSelected((prev) => ({ ...prev, ...editForm }));
          setActiveCitizen((prev) => ({ ...prev, mobile_number: editForm.phone_number }));
        }
      }
      
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
      const approveData = { ...editForm, internal_status: 'Desk_Reviewed' };
      await updateComplaint(selected.id, approveData);
      
      const updatedCitizens = await loadData();
      
      if (updatedCitizens) {
        let found = false;
        for (const cit of updatedCitizens) {
          const comp = cit.complaints.find(c => c.id === selected.id);
          if (comp) {
            setSelected(comp);
            setActiveCitizen(cit);
            setEditForm({ ...editForm, internal_status: 'Desk_Reviewed' });
            found = true;
            break;
          }
        }
        if (!found) {
          setSelected((prev) => ({ ...prev, ...approveData }));
          setEditForm({ ...editForm, internal_status: 'Desk_Reviewed' });
        }
      }
      
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
          <p className="text-slate-500 text-sm">Loading citizen directory...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Admin Identity Directory</h2>
          <p className="text-slate-500 text-sm mt-1">Review, verify, and approve AI-processed grievances by Citizen Profile</p>
        </div>
        <button onClick={loadData} className="btn-secondary flex items-center gap-2 text-xs">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {citizens.filter(c => c.complaints && c.complaints.length > 0).length === 0 ? (
        <div className="card-elevated p-16 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-700 mb-1">No Citizen Records Yet</h3>
          <p className="text-slate-400 text-sm">Citizen profiles and their grievances will appear here once submitted.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* PANE 1: Left Sidebar (Identity Directory) */}
          <div className="lg:col-span-3">
            <div className="card-elevated overflow-hidden bg-white">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                <h3 className="text-sm font-semibold text-slate-700">Citizen Directory</h3>
              </div>
              <div className="divide-y divide-slate-100 max-h-[700px] overflow-y-auto">
                {citizens.filter(c => c.complaints && c.complaints.length > 0).map((cit) => (
                  <div key={cit.aadhaar_no} className="w-full">
                    <button 
                      onClick={() => toggleAccordion(cit.aadhaar_no)}
                      className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-center justify-between focus:outline-none ${expandedAadhaar === cit.aadhaar_no ? 'bg-slate-50' : ''}`}
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-900">{cit.name}</p>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">{maskAadhaar(cit.aadhaar_no)}</p>
                      </div>
                      <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 text-slate-400 transition-transform ${expandedAadhaar === cit.aadhaar_no ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {expandedAadhaar === cit.aadhaar_no && (
                      <div className="bg-slate-50/50 pb-2">
                        {cit.complaints.length === 0 ? (
                          <p className="text-xs text-slate-400 px-4 py-2 italic">No complaints registered.</p>
                        ) : (
                          <div className="space-y-1">
                            {cit.complaints.map((c) => (
                              <button
                                key={c.id}
                                onClick={() => handleSelect(c, cit)}
                                className={`w-full text-left pl-6 pr-4 py-2.5 hover:bg-blue-50 transition-colors duration-150 focus:outline-none flex flex-col gap-1.5 ${
                                  selected?.id === c.id ? 'bg-blue-50 border-l-4 border-blue-600' : 'border-l-4 border-transparent'
                                }`}
                              >
                                <p className="text-xs font-bold text-slate-800">{c.id}</p>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`badge text-[10px] border ${STATUS_COLORS[c.status] || 'bg-slate-100 text-slate-600'}`}>
                                    {c.status}
                                  </span>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* PANES 2 & 3: Workspace & Fields */}
          <div className="lg:col-span-9">
            {selected ? (
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                
                {/* PANE 2: Center Workspace (Trackers & Nudges) */}
                <div className="card-elevated overflow-hidden xl:col-span-7 flex flex-col">
                  <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <span className="badge text-xs bg-slate-900 text-white font-mono">{selected.id}</span>
                      <span className="badge text-xs bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                        {MODE_ICONS[selected.input_mode]}
                        {selected.input_mode}
                      </span>
                      <span className="badge text-xs bg-slate-100 text-slate-500 font-mono hidden sm:inline-flex">{formatDate(selected.created_at)}</span>
                    </div>
                    <button onClick={handleViewOriginal} className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Original
                    </button>
                  </div>
                  
                  <div className="p-0 flex-1 flex flex-col">
                    <div className="flex flex-col md:flex-row flex-1">
                      <div className="w-full md:w-[45%] p-5 border-b md:border-b-0 md:border-r border-slate-200 bg-slate-50/50">
                        <VerticalTracker complaint={selected} />
                      </div>
                      <div className="w-full md:w-[55%] p-5">
                        <div className="flex items-center gap-2 mb-3">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <h3 className="text-sm font-semibold text-slate-700">Raw Citizen Input</h3>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 max-h-[300px] overflow-y-auto">
                          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{selected.raw_input}</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Historic Update Request Log Card */}
                    <div className="p-5 border-t border-slate-200 bg-blue-50/30">
                      <h4 className="font-semibold text-slate-800 flex items-center gap-2 mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                        Historic Update Request Log
                      </h4>
                      {(!selected.nudge_timestamps || selected.nudge_timestamps.length === 0) ? (
                        <p className="text-xs text-slate-500 italic">No update requests received from the citizen.</p>
                      ) : (
                        <ul className="space-y-2 max-h-[120px] overflow-y-auto pl-1">
                          {selected.nudge_timestamps.map((nudge_str, idx) => {
                            let date = nudge_str;
                            let state = "";
                            if (nudge_str.includes('|')) {
                              [date, state] = nudge_str.split('|');
                            }
                            return (
                              <li key={idx} className="text-xs text-slate-700 font-medium flex items-center flex-wrap gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 block shrink-0"></span>
                                <span>Update request received on: <span className="font-bold text-slate-900">{date}</span></span>
                                {state && (
                                  <>
                                    <span className="text-slate-300">|</span>
                                    <span>State: <span className="font-bold text-slate-900">{state}</span></span>
                                  </>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>

                {/* PANE 3: Right Sidebar (AI Form & Contact Fields) */}
                <div className="card-elevated overflow-hidden xl:col-span-5 flex flex-col h-fit">
                  <div className="px-5 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      <h3 className="text-sm font-semibold text-blue-800">AI Extraction — Editable</h3>
                    </div>
                  </div>
                  <div className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
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
                        <label htmlFor="edit-phone" className="block text-xs font-semibold text-slate-600 mb-1">Phone Number</label>
                        <input
                          id="edit-phone"
                          type="text"
                          className="input-field text-sm font-mono"
                          value={editForm.phone_number}
                          onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })}
                          placeholder="Contact number"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                        <label htmlFor="edit-aadhaar" className="block text-xs font-semibold text-slate-600 mb-1">Aadhaar Number</label>
                        <input
                          id="edit-aadhaar"
                          type="text"
                          className="input-field text-sm font-mono bg-slate-100/70 text-slate-500 cursor-not-allowed"
                          value={activeCitizen?.aadhaar_no || ''}
                          readOnly
                        />
                      </div>
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
                      <label htmlFor="edit-status" className="block text-xs font-semibold text-slate-600 mb-1">Status Route</label>
                      <select
                        id="edit-status"
                        className="input-field text-sm"
                        value={editForm.internal_status}
                        onChange={(e) => setEditForm({ ...editForm, internal_status: e.target.value })}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>{INTERNAL_STATUS_LABELS[s]}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      {selected.internal_status === 'Submitted' && (
                        <button
                          onClick={handleApprove}
                          disabled={approving}
                          className="flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {approving ? 'Approving...' : 'Reviewed and ready'}
                        </button>
                      )}
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="btn-primary flex items-center gap-2"
                      >
                        {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                      {saveSuccess && (
                        <span className="text-emerald-600 text-sm font-medium flex items-center gap-1 animate-fade-in">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
                          </svg>
                          Saved
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card-elevated p-16 text-center h-full flex flex-col justify-center items-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-700 mb-1">Select a Case</h3>
                <p className="text-slate-400 text-sm max-w-sm">Choose a grievance from the citizen directory on the left to begin reviewing their file.</p>
              </div>
            )}
          </div>
        </div>
      )}
      
      {showOriginalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in pointer-events-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
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
