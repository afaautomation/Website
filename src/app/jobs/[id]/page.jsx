'use client';

import React, { useState, use } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getJobById } from '@/data/jobs';
import { useAuth } from '@/context/AuthContext';
import { 
  Building, MapPin, Briefcase, Clock, CheckCircle2, 
  ArrowLeft, Send, UploadCloud, ShieldAlert, Check, Loader2 
} from 'lucide-react';

export default function JobDetailPage({ params }) {
  const resolvedParams = use(params);
  const job = getJobById(resolvedParams.id);
  const { user, openAuthModal } = useAuth();

  const [applied, setApplied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [coverNote, setCoverNote] = useState('');

  if (!job) {
    notFound();
  }

  const handleApply = async (e) => {
    e.preventDefault();
    if (!user) {
      openAuthModal('login');
      return;
    }

    setSubmitting(true);
    // Simulate application processing
    setTimeout(() => {
      setSubmitting(false);
      setApplied(true);
    }, 1200);
  };

  return (
    <div style={{ background: '#080A11', minHeight: '100vh', color: '#FFFFFF', padding: '48px 0 96px' }}>
      <div className="wrap" style={{ maxWidth: '980px' }}>
        
        {/* Back Link */}
        <Link 
          href="/jobs" 
          style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '8px', 
            color: '#94A3B8', 
            fontSize: '14px', 
            marginBottom: '32px' 
          }}
        >
          <ArrowLeft size={16} /> Back to All Job Openings
        </Link>

        {/* Job Header Card */}
        <div 
          style={{ 
            background: 'rgba(255, 255, 255, 0.04)', 
            border: '1px solid rgba(255, 255, 255, 0.1)', 
            borderRadius: '24px', 
            padding: '40px',
            marginBottom: '32px',
            backdropFilter: 'blur(16px)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
            <div>
              <span 
                style={{ 
                  display: 'inline-block', 
                  fontSize: '11px', 
                  fontWeight: 800, 
                  color: '#34D399', 
                  background: 'rgba(16, 185, 129, 0.12)', 
                  border: '1px solid rgba(16, 185, 129, 0.3)', 
                  padding: '4px 12px', 
                  borderRadius: '99px',
                  marginBottom: '12px' 
                }}
              >
                {job.type}
              </span>
              <h1 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 800, color: '#FFFFFF', lineHeight: '1.2', marginBottom: '8px' }}>
                {job.title}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px', color: '#93C5FD', fontWeight: 600 }}>
                <Building size={20} />
                <span>{job.company}</span>
              </div>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '12px 24px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ fontSize: '12px', color: '#94A3B8' }}>COMPENSATION</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#10B981' }}>{job.salary}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', color: '#94A3B8', fontSize: '14px', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MapPin size={16} color="#60A5FA" />
              <span>{job.location}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={16} color="#F59E0B" />
              <span>Experience: {job.experience}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Briefcase size={16} color="#A78BFA" />
              <span>Posted {job.posted}</span>
            </div>
          </div>
        </div>

        {/* Content & Apply Section */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '32px' }}>
          
          {/* Left: Job Description & Requirements */}
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '24px', padding: '36px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#FFFFFF', marginBottom: '16px' }}>
              Role Overview
            </h2>
            <p style={{ color: '#94A3B8', fontSize: '15px', lineHeight: '1.7', marginBottom: '32px' }}>
              {job.description}
            </p>

            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#FFFFFF', marginBottom: '16px' }}>
              Key Requirements
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
              {job.requirements.map((req, i) => (
                <div key={i} style={{ display: 'flex', gap: '10px', fontSize: '14px', color: '#E2E8F0' }}>
                  <CheckCircle2 size={18} color="#60A5FA" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>{req}</span>
                </div>
              ))}
            </div>

            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#FFFFFF', marginBottom: '16px' }}>
              Required Stacks
            </h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {job.skills.map((s, i) => (
                <span 
                  key={i} 
                  style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#93C5FD', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '6px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>

          {/* Right: Apply Card */}
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '24px', padding: '36px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#FFFFFF', marginBottom: '8px' }}>
              Quick Apply
            </h2>
            <p style={{ color: '#94A3B8', fontSize: '14px', marginBottom: '24px' }}>
              Your profile and uploaded resume will be directly dispatched to the {job.company} hiring panel.
            </p>

            {applied ? (
              <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.2)', color: '#34D399', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <Check size={28} />
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#FFFFFF', marginBottom: '8px' }}>
                  Application Dispatched!
                </h3>
                <p style={{ color: '#94A3B8', fontSize: '14px' }}>
                  We'll notify you at {user?.email} as soon as the recruiting team reviews your application.
                </p>
              </div>
            ) : (
              <form onSubmit={handleApply} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {!user ? (
                  <div style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '12px', padding: '16px', color: '#FBBF24', fontSize: '13px', display: 'flex', gap: '10px' }}>
                    <ShieldAlert size={18} style={{ flexShrink: 0 }} />
                    <div>
                      <span>You must be signed in to submit job applications.</span>
                      <button
                        type="button"
                        onClick={() => openAuthModal('login')}
                        style={{ display: 'block', marginTop: '6px', fontWeight: 700, textDecoration: 'underline', color: '#FBBF24' }}
                      >
                        Sign in now
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: '12px', padding: '14px', fontSize: '13px', color: '#93C5FD' }}>
                    Applying as: <strong>{user.name}</strong> ({user.email})
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#94A3B8', marginBottom: '6px', fontWeight: 600 }}>
                    Short Note / Why you're a fit (Optional)
                  </label>
                  <textarea
                    rows={4}
                    value={coverNote}
                    onChange={(e) => setCoverNote(e.target.value)}
                    placeholder="Highlight your relevant project links, GitHub, or availability..."
                    style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.1)', color: '#FFFFFF', fontSize: '14px', outline: 'none' }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary"
                  style={{ width: '100%', background: '#2563EB', padding: '14px', borderRadius: '12px', fontSize: '15px', justifyContent: 'center' }}
                >
                  {submitting ? <Loader2 size={18} className="animate-spin" /> : (
                    <>
                      <span>Submit Application</span>
                      <Send size={16} />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
