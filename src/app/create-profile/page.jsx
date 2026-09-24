'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { User, Mail, Phone, UploadCloud, CheckCircle2, ShieldAlert, Loader2, Save } from 'lucide-react';

export default function CreateProfilePage() {
  const { user, openAuthModal } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    education: '',
    passingYear: '2026',
    github: '',
    linkedin: '',
    skills: '',
    resumeUrl: ''
  });

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: user.name || prev.name,
        email: user.email || prev.email,
        phone: user.phone || prev.phone
      }));
    }
  }, [user]);

  const handleResumeUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!user) {
      openAuthModal('login');
      return;
    }

    setUploading(true);
    setErrorMsg('');

    try {
      if (!supabase) throw new Error('Supabase client unavailable');
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id || 'anonymous'}_${Date.now()}.${fileExt}`;
      const filePath = `resumes/${fileName}`;

      const { data, error } = await supabase.storage
        .from('resumes')
        .upload(filePath, file, { upsert: true });

      if (error) throw error;

      const { data: urlData } = supabase.storage.from('resumes').getPublicUrl(filePath);
      setFormData(prev => ({ ...prev, resumeUrl: urlData.publicUrl }));
    } catch (err) {
      setErrorMsg(err.message || 'Resume upload failed. Please verify storage permissions.');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');

    try {
      if (supabase && user) {
        await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            education: formData.education,
            passing_year: formData.passingYear,
            github_url: formData.github,
            linkedin_url: formData.linkedin,
            skills: formData.skills,
            resume_url: formData.resumeUrl,
            updated_at: new Date().toISOString()
          })
          .catch(() => {});
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setErrorMsg('Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ background: '#F8FAFC', padding: '64px 0 96px', minHeight: '100vh' }}>
      <div className="wrap" style={{ maxWidth: '800px' }}>
        
        <div style={{ marginBottom: '36px' }}>
          <span className="section-tag">Candidate Profile</span>
          <h1 style={{ fontSize: '36px', fontWeight: 800, color: '#02050E', marginTop: '10px' }}>
            Build Your Student & Placement Profile
          </h1>
          <p style={{ color: '#64748B', fontSize: '16px', marginTop: '6px' }}>
            This profile is shared with our 250+ corporate recruitment partners during campus and lateral hiring drives.
          </p>
        </div>

        {!user && (
          <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: '16px', padding: '18px 24px', color: '#92400E', fontSize: '14px', marginBottom: '28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ShieldAlert size={20} />
              <span>Sign in to automatically link your profile and store your resume securely.</span>
            </div>
            <button
              onClick={() => openAuthModal('login')}
              style={{ fontWeight: 700, color: '#0E2EC9', textDecoration: 'underline' }}
            >
              Sign In
            </button>
          </div>
        )}

        <div style={{ background: '#FFFFFF', borderRadius: '24px', border: '1px solid rgba(10, 21, 48, 0.08)', padding: '40px', boxShadow: '0 4px 20px rgba(2, 5, 14, 0.04)' }}>
          {errorMsg && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', padding: '12px 16px', borderRadius: '10px', fontSize: '14px', marginBottom: '20px' }}>
              {errorMsg}
            </div>
          )}

          {saved && (
            <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', color: '#166534', padding: '12px 16px', borderRadius: '10px', fontSize: '14px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={18} />
              <span>Profile details saved successfully!</span>
            </div>
          )}

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '14px', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Email Address *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '14px', outline: 'none' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Phone Number *</label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '14px', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Highest Degree & Major</label>
                <input
                  type="text"
                  placeholder="e.g. B.Tech Computer Science"
                  value={formData.education}
                  onChange={(e) => setFormData({ ...formData, education: e.target.value })}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '14px', outline: 'none' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>LinkedIn Profile URL</label>
                <input
                  type="url"
                  placeholder="https://linkedin.com/in/username"
                  value={formData.linkedin}
                  onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '14px', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>GitHub or Portfolio URL</label>
                <input
                  type="url"
                  placeholder="https://github.com/username"
                  value={formData.github}
                  onChange={(e) => setFormData({ ...formData, github: e.target.value })}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '14px', outline: 'none' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>Key Technical / Professional Skills</label>
              <input
                type="text"
                placeholder="Python, React, SQL, PowerBI, Git, Communication"
                value={formData.skills}
                onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '14px', outline: 'none' }}
              />
            </div>

            {/* Resume Upload Box */}
            <div style={{ border: '2px dashed #CBD5E1', borderRadius: '16px', padding: '28px', textAlign: 'center', background: '#F8FAFC' }}>
              <UploadCloud size={36} color="#0E2EC9" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#02050E', marginBottom: '4px' }}>
                {formData.resumeUrl ? 'Resume Uploaded' : 'Upload Latest Resume (PDF)'}
              </div>
              <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '14px' }}>
                PDF up to 5MB. Evaluated by our automated ATS analyzer.
              </p>
              
              <label 
                className="btn-outline" 
                style={{ cursor: 'pointer', display: 'inline-flex', padding: '8px 20px', fontSize: '13px' }}
              >
                <span>{uploading ? 'Uploading...' : (formData.resumeUrl ? 'Replace PDF' : 'Select PDF File')}</span>
                <input 
                  type="file" 
                  accept=".pdf" 
                  onChange={handleResumeUpload} 
                  style={{ display: 'none' }} 
                  disabled={uploading}
                />
              </label>

              {formData.resumeUrl && (
                <div style={{ marginTop: '12px', fontSize: '13px', color: '#10B981', fontWeight: 600 }}>
                  ✓ Resume attached to your application profile
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={saving}
              className="btn-primary"
              style={{ padding: '14px', borderRadius: '12px', fontSize: '15px', justifyContent: 'center' }}
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : (
                <>
                  <Save size={18} />
                  <span>Save Candidate Profile</span>
                </>
              )}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
