import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Shield, CheckCircle, XCircle, Clock, AlertTriangle, Send } from 'lucide-react';

export default function Feedback() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const initialStatus = searchParams.get('status'); // 'converted', 'not_converted', 'pending'

  const [status, setStatus] = useState<string>(initialStatus || '');
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // If they click the link, they want to submit that status immediately (with no comment)
    // or they can add a comment and submit. 
    // We will wait for them to click "Submit Feedback" to actually send it, allowing comments.
    if (!token) {
      setError("Invalid feedback link.");
    }
  }, [token]);

  const handleSubmit = async () => {
    if (!token || !status) return;
    setIsSubmitting(true);
    setError('');

    try {
      const apiUrl = import.meta.env.VITE_APP_URL ? `${import.meta.env.VITE_APP_URL}/api/feedback/submit` : '/api/feedback/submit';
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, status, comment })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to submit feedback.');
      
      setIsSuccess(true);
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (error && !token) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-lg text-center max-w-md w-full">
          <AlertTriangle className="mx-auto text-red-500 mb-4" size={48} />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Invalid Link</h2>
          <p className="text-sm text-gray-500">The feedback link appears to be missing or invalid.</p>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-lg text-center max-w-md w-full border border-emerald-100">
          <CheckCircle className="mx-auto text-emerald-500 mb-4" size={56} />
          <h2 className="text-2xl font-extrabold text-[#082b36] mb-2">Thank You!</h2>
          <p className="text-sm text-gray-500 mb-6">Your feedback has been successfully recorded. This helps us optimize your campaigns.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4 font-sans">
      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden max-w-lg w-full">
        
        {/* Header */}
        <div className="bg-[#082b36] p-6 text-center">
          <Shield className="mx-auto text-[#5fb4a9] mb-3" size={40} />
          <h1 className="text-xl font-extrabold text-white">Lead Feedback</h1>
          <p className="text-xs text-[#5fb4a9] mt-1 uppercase tracking-wider font-semibold">Help us improve your lead quality</p>
        </div>

        {/* Form Body */}
        <div className="p-8 space-y-6">
          {error && (
            <div className="bg-red-50 text-red-700 p-4 rounded-xl text-sm font-medium border border-red-100 flex items-start gap-2">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-3">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest">Lead Status</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={() => setStatus('converted')}
                className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                  status === 'converted' 
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm' 
                    : 'border-gray-100 hover:border-emerald-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                <CheckCircle size={24} className={status === 'converted' ? 'text-emerald-500 mb-2' : 'mb-2 opacity-50'} />
                <span className="text-xs font-bold">Converted</span>
              </button>
              
              <button
                onClick={() => setStatus('not_converted')}
                className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                  status === 'not_converted' 
                    ? 'border-rose-500 bg-rose-50 text-rose-700 shadow-sm' 
                    : 'border-gray-100 hover:border-rose-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                <XCircle size={24} className={status === 'not_converted' ? 'text-rose-500 mb-2' : 'mb-2 opacity-50'} />
                <span className="text-xs font-bold text-center">Not Converted</span>
              </button>
              
              <button
                onClick={() => setStatus('pending')}
                className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                  status === 'pending' 
                    ? 'border-amber-500 bg-amber-50 text-amber-700 shadow-sm' 
                    : 'border-gray-100 hover:border-amber-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                <Clock size={24} className={status === 'pending' ? 'text-amber-500 mb-2' : 'mb-2 opacity-50'} />
                <span className="text-xs font-bold">Pending</span>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest">Additional Comments (Optional)</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="E.g., Client didn't answer, quoted too high, wrong number..."
              className="w-full border-2 border-gray-100 rounded-2xl p-4 text-sm text-gray-700 focus:border-[#096260] focus:ring-0 outline-none resize-none h-28 transition-colors"
            ></textarea>
          </div>

          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !status}
            className="w-full bg-[#082b36] hover:bg-[#096260] text-white font-bold py-4 px-6 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span className="animate-pulse">Submitting...</span>
            ) : (
              <>
                <Send size={18} />
                <span>Submit Feedback</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
