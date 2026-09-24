'use client';

import React, { useState } from 'react';
import { Trophy, Award, Gift, Sparkles, CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export default function TalentHuntPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    college: '',
    stream: 'Computer Science / IT',
    year: '2026 Passout'
  });
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (supabase) {
        await supabase
          .from('leads')
          .insert([
            {
              name: formData.name,
              email: formData.email,
              phone: formData.phone,
              interest: `Talent Hunt 2026 - ${formData.college} (${formData.stream}, ${formData.year})`,
              notes: 'Talent Hunt Scholarship Applicant'
            }
          ])
          .select()
          .catch(() => {});
      }
      setRegistered(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: '#02050E', color: '#FFFFFF', minHeight: '100vh', padding: '64px 0 96px' }}>
      <div className="wrap">
        
        {/* Hero */}
        <div style={{ maxWidth: '840px', margin: '0 auto 64px', textAlign: 'center' }}>
          <div 
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '8px', 
              background: 'rgba(236, 72, 153, 0.15)', 
              color: '#F472B6', 
              padding: '6px 18px', 
              borderRadius: '99px', 
              fontSize: '13px', 
              fontWeight: 700, 
              marginBottom: '20px' 
            }}
          >
            <Trophy size={16} /> Annual State-Level Scholarship Challenge
          </div>
          <h1 style={{ fontSize: 'clamp(36px, 5.5vw, 64px)', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.03em', marginBottom: '20px', lineHeight: '1.1' }}>
            Kompetenzen Talent Hunt 2026
          </h1>
          <p style={{ color: '#94A3B8', fontSize: '18px', lineHeight: '1.6' }}>
            Compete in logic, problem solving, and aptitude. Win 100% full-tuition career scholarships and guaranteed direct MNC interview fast-tracks.
          </p>
        </div>

        {/* Perks Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '64px' }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '20px', padding: '32px', textAlign: 'center' }}>
            <Award size={36} color="#EC4899" style={{ margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#FFFFFF', marginBottom: '8px' }}>100% Scholarship</h3>
            <p style={{ color: '#94A3B8', fontSize: '14px' }}>Top 10 rankers receive complete tuition waiver for any Tech or B-School track.</p>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '20px', padding: '32px', textAlign: 'center' }}>
            <Gift size={36} color="#38BDF8" style={{ margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#FFFFFF', marginBottom: '8px' }}>₹1,00,000 Prize Pool</h3>
            <p style={{ color: '#94A3B8', fontSize: '14px' }}>Cash awards, laptops, and developer gear for top regional performers.</p>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '20px', padding: '32px', textAlign: 'center' }}>
            <Sparkles size={36} color="#10B981" style={{ margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#FFFFFF', marginBottom: '8px' }}>MNC Interview Passes</h3>
            <p style={{ color: '#94A3B8', fontSize: '14px' }}>Direct entry into technical interview rounds at our 250+ partner companies.</p>
          </div>
        </div>

        {/* Registration Form Card */}
        <div style={{ maxWidth: '640px', margin: '0 auto', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '24px', padding: '40px', backdropFilter: 'blur(16px)' }}>
          {registered ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <CheckCircle2 size={48} color="#10B981" style={{ margin: '0 auto 16px' }} />
              <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#FFFFFF', marginBottom: '8px' }}>
                Registration Confirmed!
              </h2>
              <p style={{ color: '#94A3B8', fontSize: '15px' }}>
                Your hall ticket and online examination link will be sent to {formData.email} and WhatsApp.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#FFFFFF', marginBottom: '6px' }}>
                  Register for Talent Hunt 2026
                </h2>
                <p style={{ color: '#94A3B8', fontSize: '14px' }}>
                  Open to all final-year and pre-final year college students in Kerala. Free registration.
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#94A3B8', marginBottom: '6px' }}>Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Rahul Raj"
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.12)', color: '#FFFFFF', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#94A3B8', marginBottom: '6px' }}>Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="rahul@gmail.com"
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.12)', color: '#FFFFFF', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#94A3B8', marginBottom: '6px' }}>WhatsApp Number *</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91 9876543210"
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.12)', color: '#FFFFFF', outline: 'none' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#94A3B8', marginBottom: '6px' }}>College / University Name *</label>
                <input
                  type="text"
                  required
                  value={formData.college}
                  onChange={(e) => setFormData({ ...formData, college: e.target.value })}
                  placeholder="e.g. Model Engineering College, CUSAT, CET"
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.12)', color: '#FFFFFF', outline: 'none' }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
                style={{ width: '100%', padding: '14px', borderRadius: '12px', fontSize: '15px', justifyContent: 'center', marginTop: '10px' }}
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : 'Confirm Free Registration'}
              </button>
            </form>
          )}
        </div>

      </div>
    </div>
  );
}
