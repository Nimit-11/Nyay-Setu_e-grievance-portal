import React, { useState, useEffect, useRef } from 'react';
import { submitComplaint } from '../api/api.js';

const tabs = [
  { key: 'text', label: 'Text Mode', icon: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  )},
  { key: 'voice', label: 'Voice Mode', icon: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  )},
  { key: 'document', label: 'Upload Document', icon: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
  )},
];

const phases = [
  'Initializing Sensory Pipeline...',
  'Extracting Sensory Data...',
  'Running Gemini Cognitive Analysis...',
  'Structuring Output...',
];

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function CitizenIntake() {
  const [activeTab, setActiveTab] = useState('text');
  const [textInput, setTextInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingPhase, setProcessingPhase] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  // Document upload state
  const fileInputRef = useRef(null);
  const [selectedFileName, setSelectedFileName] = useState(null);

  useEffect(() => {
    let interval;
    if (isProcessing) {
      setProcessingPhase(0);
      interval = setInterval(() => {
        setProcessingPhase((prev) => {
          if (prev < phases.length - 1) return prev + 1;
          return prev;
        });
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [isProcessing]);

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const handleSubmitText = async () => {
    if (textInput.trim().length < 10) return;
    setIsProcessing(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('input_mode', 'text');
      formData.append('text', textInput);
      const response = await submitComplaint(formData);
      setResult(response);
    } catch (err) {
      setError(err.message || 'An error occurred during submission.');
    } finally {
      setIsProcessing(false);
    }
  };

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/mp4';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = '';
          }
        }
      }

      const options = mimeType ? { mimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const blobType = mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: blobType });
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        await handleSubmitAudio(blob, `recording.${ext}`);
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setError('Microphone access denied. Please allow microphone access in your browser settings to record audio.');
      } else {
        setError('Could not access microphone: ' + err.message);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleSubmitAudio = async (audioBlob, filename) => {
    setIsProcessing(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('input_mode', 'voice');
      formData.append('audio_file', audioBlob, filename);
      const response = await submitComplaint(formData);
      setResult(response);
    } catch (err) {
      setError(err.message || 'Failed to process audio recording.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFileName(file.name);
    setIsProcessing(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('input_mode', 'document');
      formData.append('document_file', file);
      const response = await submitComplaint(formData);
      setResult(response);
    } catch (err) {
      setError(err.message || 'Failed to process document.');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    setSelectedFileName(file.name);
    setIsProcessing(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('input_mode', 'document');
      formData.append('document_file', file);
      const response = await submitComplaint(formData);
      setResult(response);
    } catch (err) {
      setError(err.message || 'Failed to process document.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleCopy = () => {
    if (result?.id) {
      navigator.clipboard.writeText(result.id).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
    setTextInput('');
    setProcessingPhase(0);
    setSelectedFileName(null);
    setRecordingTime(0);
  };

  if (isProcessing) {
    return (
      <section className="animate-fade-in">
        <div className="max-w-lg mx-auto mt-16">
          <div className="card-elevated p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 mb-6">
              <svg className="w-8 h-8 text-blue-600 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Processing Your Grievance</h3>
            <p className="text-blue-600 font-semibold text-sm mb-6">{phases[processingPhase]}</p>
            <div className="flex gap-1.5 justify-center">
              {phases.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    i <= processingPhase ? 'w-8 bg-blue-600' : 'w-4 bg-slate-200'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (result) {
    return (
      <section className="animate-fade-in">
        <div className="max-w-lg mx-auto mt-16">
          <div className="card-elevated p-10 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50 mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Grievance Submitted Successfully</h3>
            <p className="text-slate-500 text-sm mb-6">Your grievance has been registered and is being processed by our team.</p>
            <div className="bg-slate-50 rounded-xl p-4 mb-6 border border-slate-200">
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Your Tracking ID</p>
              <p className="text-2xl font-bold text-slate-900 tracking-wider">{result.id}</p>
            </div>
            <div className="flex gap-3 justify-center">
              <button onClick={handleCopy} className="btn-secondary flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                {copied ? 'Copied!' : 'Copy ID'}
              </button>
              <button onClick={handleReset} className="btn-primary">
                File Another
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="animate-fade-in">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-3">File Your Grievance</h2>
          <p className="text-slate-500 text-base max-w-md mx-auto">
            Share your concern in any way that's comfortable. Our AI system will handle the rest — no forms, no categories, no bureaucracy.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        <div className="card-elevated overflow-hidden">
          <div className="flex border-b border-slate-200">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 ${
                  activeTab === tab.key
                    ? 'text-blue-700 bg-blue-50 border-b-2 border-blue-600'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="p-6 sm:p-8">
            {activeTab === 'text' && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="grievance-text" className="block text-sm font-semibold text-slate-700 mb-2">
                    Describe your grievance
                  </label>
                  <textarea
                    id="grievance-text"
                    rows={7}
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    className="input-field resize-none"
                    placeholder="Describe your grievance in your own words. You can write in English, Hindi, or any Indian language. Include any relevant details such as what happened, when, where, and who was involved..."
                  />
                  <div className="flex justify-between mt-2">
                    <p className="text-xs text-slate-400">Supports all Indian languages</p>
                    <p className={`text-xs ${textInput.length > 2000 ? 'text-red-500' : 'text-slate-400'}`}>
                      {textInput.length} / 2000
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleSubmitText}
                  disabled={textInput.trim().length < 10}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Submit Grievance
                </button>
              </div>
            )}

            {activeTab === 'voice' && (
              <div className="text-center py-8">
                {!isRecording ? (
                  <button
                    onClick={startRecording}
                    className="group inline-flex flex-col items-center gap-4 focus:outline-none"
                  >
                    <div className="w-28 h-28 rounded-full bg-blue-50 border-2 border-blue-200 flex items-center justify-center group-hover:bg-blue-100 group-hover:border-blue-400 transition-all duration-300 animate-pulse-ring group-focus:ring-4 group-focus:ring-blue-500">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    </div>
                    <span className="text-sm font-semibold text-slate-700">Click to Start Recording</span>
                    <span className="text-xs text-slate-400">Supports Hindi & all Indian languages</span>
                  </button>
                ) : (
                  <div className="inline-flex flex-col items-center gap-4">
                    <div className="w-28 h-28 rounded-full bg-red-50 border-2 border-red-300 flex items-center justify-center animate-pulse">
                      <div className="w-6 h-6 rounded-sm bg-red-500"></div>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-slate-900 font-mono">{formatTime(recordingTime)}</p>
                      <p className="text-xs text-red-500 font-semibold mt-1 flex items-center justify-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                        Recording...
                      </p>
                    </div>
                    <button
                      onClick={stopRecording}
                      className="btn-primary flex items-center gap-2 bg-red-600 hover:bg-red-700 active:bg-red-800"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                      </svg>
                      Stop & Submit
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'document' && (
              <div className="py-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="document-upload"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  className="w-full group focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-2xl"
                >
                  <div className="border-2 border-dashed border-slate-300 rounded-2xl p-12 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-all duration-300 cursor-pointer">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4 group-hover:bg-blue-100 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-slate-400 group-hover:text-blue-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-slate-700 mb-1">Click to Upload or Drag & Drop</p>
                    <p className="text-xs text-slate-400">JPG, PNG, or PDF</p>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
