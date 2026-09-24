'use client';

import React, { useState } from 'react';
import { Compass, CheckCircle2, ShieldCheck, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export default function CareerConsultingPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    status: 'Final Year Student',
    domain: 'Tech School (Python / Java / AI / Data)',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      if (supabase) {
        // Attempt to insert lead to Supabase if table exists
        await supabase
          .from('leads')
          .insert([
            {
              name: formData.name,
              email: formData.email,
              phone: formData.phone,
              interest: `${formData.status} - ${formData.domain}`,
              notes: formData.notes
            }
          ])
          .select()
          .catch(() => {});
      }
      setSubmitted(true);
    } catch (err) {
      setErrorMsg('Failed to submit request. Please reach out via phone or email directly.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: '#FFFFFF', padding: '64px 0 96px' }}>
      <div className="wrap">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '64px', alignItems: 'center' }}>
          
          {/* Left Column: Context & Value Proposition */}
          <div>
            <div 
              style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '8px', 
                background: '#F3E8FF', 
                color: '#9333EA', 
                padding: '6px 16px', 
                borderRadius: '99px', 
                fontSize: '13px', 
                fontWeight: 700, 
                marginBottom: '20px' 
              }}
            >
              <Compass size={16} /> 1-on-1 Strategic Advisory
            </div>

            <h1 style={{ fontSize: 'clamp(36px, 4.5vw, 54px)', fontWeight: 800, color: '#02050E', lineHeight: '1.15', marginBottom: '20px', letterSpacing: '-0.03em' }}>
              Free 1-on-1 Career Diagnostic Session
            </h1>

            <p style={{ fontSize: '18px', color: '#474F66', lineHeight: '1.6', marginBottom: '36px' }}>
              Stop guessing which tech stack or career domain aligns with your aptitudes. Spend 30 minutes with an industry director to map your personalized roadmap to high-paying offers.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '36px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <CheckCircle2 size={20} color="#0E2EC9" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#02050E' }}>Complete Profile Audit</h4>
                  <p style={{ fontSize: '14px', color: '#64748B', marginTop: '2px' }}>We review your degree, academic gaps, previous experience, and current skill set.</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <CheckCircle2 size={20} color="#0E2EC9" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#02050E' }}>Salary & Market Demand Benchmarking</h4>
                  <p style={{ fontSize: '14px', color: '#64748B', marginTop: '2px' }}>Understand real placement salaries for freshers vs experienced lateral shifts in Kochi, Bangalore & GCC.</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <CheckCircle2 size={20} color="#0E2EC9" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#02050E' }}>Zero High-Pressure Sales</h4>
                  <p style={{ fontSize: '14px', color: '#64748B', marginTop: '2px' }}>Pure strategic guidance. If our academy isn't the right fit, we will candidly tell you.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Booking Card */}
          <div 
            style={{ 
              background: '#FFFFFF', 
              borderRadius: '24px', 
              border: '1px solid rgba(10, 21, 48, 0.1)', 
              padding: '40px', 
              boxShadow: '0 20px 50px rgba(2, 5, 14, 0.08)' 
            }}
          >
            {submitted ? (
              <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                  <CheckCircle2 size={36} />
                </div>
                <h3 style={{ fontSize: '24px', fontWeight: 800, color: '#02050E', marginBottom: '10px' }}>
                  Consultation Request Received!
                </h3>
                <p style={{ color: '#64748B', fontSize: '15px', lineHeight: '1.6', marginBottom: '24px' }}>
                  Our senior career counselor will review your profile and connect with you on WhatsApp/Phone within 4 business hours to lock in your appointment time.
                </p>
                <button
                  onClick={() => setSubmitted(false)}
                  className="btn-outline"
                >
                  Submit Another Request
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div>
                  <h3 style={{ fontSize: '22px', fontWeight: 800, color: '#02050E', marginBottom: '6px' }}>
                    Schedule Your Free Session
                  </h3>
                  <p style={{ fontSize: '14px', color: '#64748B' }}>
                    Available in-person at our Kochi campus or via Google Meet.
                  </p>
                </div>

                {errorMsg && (
                  <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', padding: '10px 14px', borderRadius: '8px', fontSize: '13px' }}>
                    {errorMsg}
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Rahul Nair"
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '14px', outline: 'none' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="rahul@example.com"
                      style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '14px', outline: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                      Phone / WhatsApp *
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+91 9876543210"
                      style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '14px', outline: 'none' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Current Background
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '14px', outline: 'none', background: '#FFFFFF' }}
                  >
                    <option value="Final Year Student">Final Year College Student</option>
                    <option value="Recent Graduate">Recent Graduate (Looking for 1st Job)</option>
                    <option value="Working Professional (Tech)">Working Professional (In Tech)</option>
                    <option value="Non-Tech Career Switch">Non-Tech Seeking Career Switch</option>
                    <option value="Career Break">Career Break / Returning</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Interested Domain
                  </label>
                  <select
                    value={formData.domain}
                    onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '14px', outline: 'none', background: '#FFFFFF' }}
                  >
                    <option value="Tech School (Python / Java / AI / Data)">Tech School (Python / Java / AI / Data Analytics)</option>
                    <option value="B-School (HR Operations & Management)">B-School (HR Operations & Management)</option>
                    <option value="B-School (Sales Engineering)">B-School (Enterprise Sales Engineering)</option>
                    <option value="Finishing School (Corporate Etiquette & Poise)">Finishing School (Corporate Etiquette & Poise)</option>
                    <option value="Not Sure - Need Guidance">Not Sure - Need Guidance</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                  style={{ width: '100%', padding: '14px', fontSize: '15px', borderRadius: '12px', marginTop: '8px' }}
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : 'Confirm Consultation Booking'}
                </button>
              </form>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
