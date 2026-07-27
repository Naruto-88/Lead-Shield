import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import PublicReport from './pages/PublicReport';
import Feedback from './pages/Feedback';
import CosmicCanvasBackground from './components/layout/CosmicCanvasBackground';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#d5ecea] flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-12 w-12 border-4 border-[#096260] border-t-transparent rounded-full animate-spin mb-4"></div>
          <div className="text-[#082b36] font-bold text-xl tracking-wider">LOADING SECURE PORTAL...</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <CosmicCanvasBackground />
      <Router>
        <Routes>
          <Route 
            path="/login" 
            element={!session ? <Login /> : <Navigate to="/" replace />} 
          />
          <Route 
            path="/signup" 
            element={!session ? <Signup /> : <Navigate to="/" replace />} 
          />
          <Route 
            path="/" 
            element={session ? <Dashboard /> : <Navigate to="/login" replace />} 
          />
          <Route 
            path="/report/:token" 
            element={<PublicReport />} 
          />
          <Route 
            path="/feedback" 
            element={<Feedback />} 
          />
        </Routes>
      </Router>
    </>
  );
}
