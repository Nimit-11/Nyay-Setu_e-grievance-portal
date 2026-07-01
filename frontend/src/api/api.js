const BASE_URL = '/api/v1/complaints';

export async function submitComplaint(formData) {
  const response = await fetch(`${BASE_URL}/submit`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to submit complaint');
  }
  return response.json();
}

export async function getGroupedComplaints() {
  const response = await fetch(`${BASE_URL}/grouped`);
  if (!response.ok) throw new Error('Failed to fetch grouped complaints');
  return response.json();
}

export async function submitNudge(complaintId) {
  const response = await fetch(`${BASE_URL}/${complaintId}/nudge`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to submit nudge');
  return response.json();
}

export async function getCitizenProfile(aadhaar) {
  const response = await fetch(`${BASE_URL}/citizen/${aadhaar}`);
  if (!response.ok) throw new Error('Failed to fetch citizen profile');
  return response.json();
}

export async function fetchComplaints() {
  const response = await fetch(`${BASE_URL}/`);
  if (!response.ok) throw new Error('Failed to fetch complaints');
  return response.json();
}

export async function updateComplaint(id, data) {
  const response = await fetch(`${BASE_URL}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to update complaint');
  }
  return response.json();
}

export async function trackComplaint(id) {
  const response = await fetch(`${BASE_URL}/${id}/status`);
  if (!response.ok) {
    if (response.status === 404) throw new Error('Complaint not found');
    throw new Error('Failed to track complaint');
  }
  return response.json();
}
