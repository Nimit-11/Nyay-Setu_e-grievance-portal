import React, { useState, useRef, useEffect } from 'react';
import { submitComplaint, getCitizenProfile, submitNudge, getCitizenByPhone } from '../api/api.js';

export default function CitizenIntake() {
  // State Machine
  const [authState, setAuthState] = useState('input'); // 'input', 'scanning', 'authenticated', 'phone_input', 'otp_verification'
  const [authMethod, setAuthMethod] = useState('aadhaar'); // 'aadhaar', 'phone'
  const [viewMode, setViewMode] = useState(null); // 'choice_hub', 'intake_form'
  const [citizenProfile, setCitizenProfile] = useState(null);
  
  // Auth Inputs
  const [aadhaarInput, setAadhaarInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [scanText, setScanText] = useState('Accessing Face Camera...');
  const [mediaStream, setMediaStream] = useState(null);
  const [phoneInput, setPhoneInput] = useState('');
  const [otp, setOtp] = useState(['', '', '', '']);
  const [timer, setTimer] = useState(30);
  const otpRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];

  // Timer Effect
  useEffect(() => {
    let interval;
    if (authState === 'otp_verification' && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [authState, timer]);

  // Intake Form State
  const [activeTab, setActiveTab] = useState('text');
  const [textInput, setTextInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const [nudgeToast, setNudgeToast] = useState(false);
  const [copied, setCopied] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [mediaStream]);

  // Mock Authentication Flow
  const handleAuthenticate = async () => {
    if (!aadhaarInput.trim()) {
      setAuthError('Please enter an Aadhaar identification number.');
      return;
    }
    setAuthError('');
    setAuthState('scanning');
    setScanText('Accessing Face Camera...');
    
    let currentStream = null;
    try {
      currentStream = await navigator.mediaDevices.getUserMedia({ video: true });
      setMediaStream(currentStream);
    } catch (err) {
      console.warn("Camera access denied or unavailable", err);
    }
    
    // Scan Animation Logic
    setTimeout(() => setScanText('Matching biometric features with UIDAI registries...'), 1500);

    setTimeout(async () => {
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        setMediaStream(null);
      }
      try {
        const profile = await getCitizenProfile(aadhaarInput.trim());
        setCitizenProfile(profile);
        setAuthState('authenticated');
        
        // Relational Routing Evaluation
        if (!profile.complaints || profile.complaints.length === 0) {
          setViewMode('intake_form');
        } else {
          setViewMode('choice_hub');
        }
      } catch (err) {
        setAuthState('input');
        setAuthError('Identity verification failed or record not found.');
      }
    }, 4000);
  };

  const handlePhoneAuthenticate = () => {
    if (!phoneInput.trim() || phoneInput.trim().length < 10) {
      setAuthError('Please enter a valid 10-digit mobile number.');
      return;
    }
    setAuthError('');
    setAuthState('otp_verification');
    setTimer(30);
  };

  const handleOtpChange = (index, value) => {
    if (isNaN(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    // Auto-advance
    if (value !== '' && index < 3) {
      otpRefs[index + 1].current.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs[index - 1].current.focus();
    }
  };

  const handleOtpSubmit = async () => {
    const enteredOtp = otp.join('');
    if (enteredOtp !== '0000') {
      setAuthError('Invalid OTP. Please enter 0000.');
      return;
    }
    
    setAuthError('');
    setScanText('Verifying identity...');
    setAuthState('scanning'); // Optional: show loading state
    
    setTimeout(async () => {
      try {
        const profile = await getCitizenByPhone(phoneInput.trim());
        setCitizenProfile(profile);
        setAuthState('authenticated');
        
        if (!profile.complaints || profile.complaints.length === 0) {
          setViewMode('intake_form');
        } else {
          setViewMode('choice_hub');
        }
      } catch (err) {
        setAuthError('Identity verification failed or record not found.');
        setAuthState('phone_input');
      }
    }, 1500);
  };

  const handleNudge = async (complaintId) => {
    try {
      await submitNudge(complaintId);
      setNudgeToast(true);
      setTimeout(() => setNudgeToast(false), 3000);
    } catch (err) {
      console.error('Failed to send nudge:', err);
      alert('Failed to send nudge. Please try again later.');
    }
  };

  // --- Audio Recording Logic (Unchanged) ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Microphone access denied or not available.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  // --- Submit Intake Logic ---
  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitResult(null);

    const formData = new FormData();
    formData.append('input_mode', activeTab);
    formData.append('aadhaar_no', citizenProfile.aadhaar_no);

    if (activeTab === 'text') {
      if (!textInput.trim()) {
        setSubmitResult({ success: false, message: 'Please enter your grievance details.' });
        setSubmitting(false);
        return;
      }
      formData.append('text', textInput);
    } else if (activeTab === 'voice') {
      if (!audioBlob) {
        setSubmitResult({ success: false, message: 'Please record an audio message.' });
        setSubmitting(false);
        return;
      }
      formData.append('audio_file', audioBlob, 'recording.webm');
    } else if (activeTab === 'document') {
      if (!selectedFile) {
        setSubmitResult({ success: false, message: 'Please select a document or image.' });
        setSubmitting(false);
        return;
      }
      formData.append('document_file', selectedFile);
    }

    try {
      const data = await submitComplaint(formData);
      setSubmitResult({ success: true, message: `Success! Tracking ID: ${data.id}`, id: data.id });
      // Reset form
      setTextInput('');
      setAudioBlob(null);
      setAudioUrl('');
      setSelectedFile(null);
    } catch (err) {
      setSubmitResult({ success: false, message: err.message || 'Failed to submit grievance.' });
    } finally {
      setSubmitting(false);
    }
  };


  // --- Renderers ---

  if (authState === 'input' || authState === 'scanning' || authState === 'phone_input' || authState === 'otp_verification') {
    return (
      <section className="animate-fade-in max-w-lg mx-auto mt-12">
        <div className="card-elevated p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Citizen Authentication</h2>
          <p className="text-slate-500 mb-8 text-sm">
            {authState === 'otp_verification' 
              ? `Enter the OTP sent to ${phoneInput}`
              : "Please provide your identification to access or register your grievance portfolio."}
          </p>
          
          {authState === 'input' || authState === 'phone_input' ? (
            <div className="space-y-4">
              <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
                <button 
                  onClick={() => { setAuthMethod('aadhaar'); setAuthState('input'); setAuthError(''); }}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${authMethod === 'aadhaar' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Aadhaar ID
                </button>
                <button 
                  onClick={() => { setAuthMethod('phone'); setAuthState('phone_input'); setAuthError(''); }}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${authMethod === 'phone' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Phone Number
                </button>
              </div>

              {authMethod === 'aadhaar' ? (
                <>
                  <input 
                    type="text" 
                    value={aadhaarInput}
                    onChange={(e) => setAadhaarInput(e.target.value)}
                    placeholder="Enter Aadhaar Number" 
                    className="input-field text-center text-lg tracking-widest font-mono py-3"
                  />
                  {authError && <p className="text-red-500 text-sm font-semibold">{authError}</p>}
                  <button onClick={handleAuthenticate} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Verify Identity via Face RD Scanner
                  </button>
                </>
              ) : (
                <>
                  <input 
                    type="text" 
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter 10-digit Mobile Number" 
                    className="input-field text-center text-lg tracking-widest font-mono py-3"
                    maxLength={10}
                  />
                  {authError && <p className="text-red-500 text-sm font-semibold">{authError}</p>}
                  <button onClick={handlePhoneAuthenticate} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    Send OTP
                  </button>
                </>
              )}
            </div>
          ) : authState === 'otp_verification' ? (
            <div className="space-y-6 mt-4">
              <div className="flex justify-center gap-4">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={otpRefs[index]}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    className="w-14 h-16 text-center text-2xl font-bold font-mono bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/20 outline-none transition-all"
                  />
                ))}
              </div>
              {authError && <p className="text-red-500 text-sm font-semibold">{authError}</p>}
              <button onClick={handleOtpSubmit} className="btn-primary w-full py-3">
                Verify OTP
              </button>
              <button 
                onClick={() => {
                  if (timer === 0) {
                    setOtp(['', '', '', '']);
                    setTimer(30);
                  }
                }}
                disabled={timer > 0}
                className={`text-sm font-medium transition-colors mt-2 ${timer > 0 ? 'text-slate-400 cursor-not-allowed' : 'text-blue-600 hover:text-blue-800 underline underline-offset-2'}`}
              >
                {timer > 0 ? `Resend OTP in 00:${timer.toString().padStart(2, '0')}` : 'Resend OTP'}
              </button>
              <button 
                onClick={() => { setAuthState('phone_input'); setTimer(30); }}
                className="block mx-auto text-slate-400 text-xs hover:text-slate-600 transition-colors mt-4 underline underline-offset-2"
              >
                Change Phone Number
              </button>
            </div>
          ) : (
            <div className="py-8 flex flex-col items-center">
              <div className="relative w-40 h-40 mb-6 overflow-hidden rounded-full border-4 border-slate-100 shadow-lg">
                {mediaStream ? (
                  <video 
                    autoPlay 
                    playsInline 
                    muted 
                    ref={(video) => {
                      if (video && video.srcObject !== mediaStream) {
                        video.srcObject = mediaStream;
                      }
                    }}
                    className="w-full h-full object-cover transform -scale-x-100"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-blue-500 bg-slate-50">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
                
                <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"></div>
                <div className="absolute top-0 left-0 w-full h-full bg-blue-500/10 mix-blend-overlay"></div>
              </div>
              <p className="text-blue-600 font-semibold animate-pulse">{scanText}</p>
            </div>
          )}
        </div>
      </section>
    );
  }

  // Phase C: Returning Citizen Choice Hub Layout
  if (viewMode === 'choice_hub') {
    return (
      <section className="animate-fade-in max-w-4xl mx-auto">
        {nudgeToast && (
          <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium tracking-wide">Nudge logged successfully. Administration notified.</span>
          </div>
        )}
        
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-900">Welcome back, {citizenProfile.name}.</h2>
          <p className="text-slate-500 mt-2 text-lg">System records indicate you have ongoing files.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {citizenProfile.complaints.map(c => (
            <div key={c.id} className="card-elevated p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold font-mono bg-slate-100 text-slate-600 px-3 py-1 rounded-full">{c.id}</span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">{c.status}</span>
                </div>
                <p className="text-slate-700 text-sm line-clamp-2 mb-4">{c.summary || c.raw_input}</p>
              </div>
              
              {/* Option Element 1: The Nudge Action */}
              <div className="pt-4 border-t border-slate-100 mt-2">
                <p className="text-xs text-slate-500 mb-3">Do you have a question or an updates query regarding this active issue?</p>
                <button onClick={() => handleNudge(c.id)} className="w-full py-2 px-4 rounded-xl border-2 border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 font-semibold text-sm transition-colors flex items-center justify-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  Send Urgent Status Nudge
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="card-elevated bg-blue-50 border border-blue-100 p-8 text-center flex flex-col items-center">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">Need to report a new issue?</h3>
          <p className="text-blue-700 text-sm mb-6">You can register a completely new grievance to add to your profile.</p>
          <button onClick={() => setViewMode('intake_form')} className="btn-primary">
            Start New Grievance Filing
          </button>
        </div>
      </section>
    );
  }

  // Phase B (Clean Route) & Explicit New Filing Layout
  return (
    <section className="animate-fade-in max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => setAuthState('input')} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div>
          <h2 className="text-3xl font-bold text-slate-900">New Grievance</h2>
          <p className="text-slate-500 text-sm mt-1">Filing as: <span className="font-semibold text-slate-700">{citizenProfile.name}</span></p>
        </div>
      </div>

      <div className="card-elevated overflow-hidden mb-8">
        <div className="flex border-b border-slate-200">
          <button 
            className={`flex-1 py-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${activeTab === 'text' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-slate-500 hover:bg-slate-50'}`}
            onClick={() => setActiveTab('text')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Type
          </button>
          <button 
            className={`flex-1 py-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${activeTab === 'voice' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-slate-500 hover:bg-slate-50'}`}
            onClick={() => setActiveTab('voice')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            Speak
          </button>
          <button 
            className={`flex-1 py-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${activeTab === 'document' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-slate-500 hover:bg-slate-50'}`}
            onClick={() => setActiveTab('document')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Upload
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'text' && (
            <div className="animate-fade-in">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Describe your grievance in detail</label>
              <textarea 
                className="input-field min-h-[160px] resize-y" 
                placeholder="E.g., I have been facing harassment at my workplace..."
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
              />
            </div>
          )}

          {activeTab === 'voice' && (
            <div className="animate-fade-in flex flex-col items-center py-6 text-center">
              <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-6 relative">
                {isRecording && (
                  <span className="absolute inset-0 rounded-full bg-blue-400 opacity-30 animate-ping"></span>
                )}
                <svg xmlns="http://www.w3.org/2000/svg" className={`w-8 h-8 ${isRecording ? 'text-red-500 animate-pulse' : 'text-blue-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">
                {isRecording ? 'Listening...' : 'Record your grievance'}
              </h3>
              <p className="text-slate-500 text-sm mb-8 max-w-sm">
                Speak naturally in your preferred language. Our AI will transcribe and extract the key details.
              </p>
              
              <div className="flex gap-4">
                {!isRecording ? (
                  <button onClick={startRecording} className="btn-primary px-8">Start Recording</button>
                ) : (
                  <button onClick={stopRecording} className="bg-red-500 hover:bg-red-600 text-white px-8 py-2.5 rounded-xl font-semibold transition-all">Stop Recording</button>
                )}
              </div>

              {audioUrl && !isRecording && (
                <div className="mt-8 w-full max-w-md bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <p className="text-xs font-semibold text-slate-500 mb-2 text-left uppercase tracking-wider">Recording Preview</p>
                  <audio src={audioUrl} controls className="w-full h-10" />
                </div>
              )}
            </div>
          )}

          {activeTab === 'document' && (
            <div className="animate-fade-in">
              <div className="border-2 border-dashed border-slate-300 rounded-2xl p-10 flex flex-col items-center justify-center text-center hover:border-blue-500 hover:bg-blue-50/50 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-slate-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <h3 className="text-sm font-semibold text-slate-700 mb-1">Upload a Document or Image</h3>
                <p className="text-xs text-slate-500 mb-6">Supported formats: PDF, JPG, PNG (Max 10MB)</p>
                <input 
                  type="file" 
                  id="file-upload"
                  className="hidden" 
                  accept="image/*,application/pdf"
                  onChange={handleFileChange}
                />
                <label htmlFor="file-upload" className="btn-secondary cursor-pointer">
                  Browse Files
                </label>
                {selectedFile && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-emerald-600 font-medium bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {selectedFile.name}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button 
          className="btn-primary px-8 py-3 text-base flex items-center gap-2"
          onClick={handleSubmit}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Submit Grievance
        </button>
      </div>

      {/* Loading & Success Modal Overlay */}
      {(submitting || submitResult) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in pointer-events-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col p-8 text-center animate-scale-up relative">
            {submitting ? (
              <div className="flex flex-col items-center justify-center py-4">
                <div className="relative w-20 h-20 mb-6">
                  <div className="absolute inset-0 rounded-full border-4 border-slate-100"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center text-blue-600">
                    <svg className="w-8 h-8 animate-pulse" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Processing Grievance</h3>
                <p className="text-sm text-slate-500">Our AI is analyzing, structuring, and routing your submission securely...</p>
              </div>
            ) : submitResult.success ? (
              <div className="flex flex-col items-center justify-center py-4">
                <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mb-6">
                  <svg className="w-10 h-10 text-emerald-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Submission Successful!</h3>
                <p className="text-sm text-slate-500 mb-6">Your grievance has been successfully registered.</p>
                
                <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 relative group">
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Tracking ID</p>
                  <p className="text-xl font-mono font-bold text-slate-800">{submitResult.id}</p>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(submitResult.id);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="absolute top-1/2 -translate-y-1/2 right-4 p-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-200 transition-colors shadow-sm"
                    title="Copy Tracking ID"
                  >
                    {copied ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                </div>
                
                <button 
                  onClick={async () => {
                    setSubmitResult(null);
                    // Refresh citizen profile to include the new complaint and return to choice hub
                    try {
                      const profile = await getCitizenProfile(citizenProfile.aadhaar_no);
                      setCitizenProfile(profile);
                      setViewMode('choice_hub');
                    } catch(err) {
                      setAuthState('input');
                    }
                  }}
                  className="btn-primary w-full py-3"
                >
                  Return to Dashboard
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-4">
                <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mb-6">
                  <svg className="w-10 h-10 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Submission Failed</h3>
                <p className="text-sm text-slate-500 mb-6">{submitResult.message}</p>
                <button 
                  onClick={() => setSubmitResult(null)}
                  className="btn-secondary w-full py-3"
                >
                  Close & Try Again
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
