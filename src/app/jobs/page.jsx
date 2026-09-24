'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { initialJobs } from '@/data/jobs';
import { 
  Search, MapPin, Briefcase, Clock, Building, 
  ArrowRight, Filter, ChevronRight, CheckCircle2 
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function JobsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const { user, openAuthModal } = useAuth();

  const filteredJobs = initialJobs.filter(job => {
    const matchesSearch = 
      job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.skills.some(s => s.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesType = selectedType === 'All' || job.type === selectedType;

    return matchesSearch && matchesType;
  });

  return (
    <div style={{ background: '#080A11', minHeight: '100vh', color: '#FFFFFF', padding: '64px 0 96px' }}>
      <div className="wrap">
        {/* Header */}
        <div style={{ maxWidth: '800px', margin: '0 auto 48px', textAlign: 'center' }}>
          <span 
            style={{ 
              display: 'inline-block', 
              fontSize: '12px', 
              fontWeight: 700, 
              textTransform: 'uppercase', 
              letterSpacing: '1px', 
              color: '#60A5FA', 
              background: 'rgba(59, 130, 246, 0.15)', 
              padding: '6px 16px', 
              borderRadius: '99px', 
              marginBottom: '16px' 
            }}
          >
            Verified Hiring Portal
          </span>
          <h1 style={{ fontSize: 'clamp(32px, 4.5vw, 52px)', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.03em', marginBottom: '16px' }}>
            Exclusive Career Openings
          </h1>
          <p style={{ color: '#94A3B8', fontSize: '18px', lineHeight: '1.6' }}>
            Direct referrals and placement drives with Kerala's top tech parks and national enterprise employers.
          </p>
        </div>

        {/* Search & Filter Bar */}
        <div 
          style={{ 
            maxWidth: '920px', 
            margin: '0 auto 48px', 
            background: 'rgba(255, 255, 255, 0.05)', 
            border: '1px solid rgba(255, 255, 255, 0.1)', 
            borderRadius: '20px', 
            padding: '12px',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ flex: 1, minWidth: '260px', position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '16px', top: '15px', color: '#94A3B8' }} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by role, company, or skills (Python, SQL, HR)..."
              style={{
                width: '100%',
                padding: '12px 16px 12px 46px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                color: '#FFFFFF',
                fontSize: '14px',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {['All', 'Full Time'].map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: 600,
                  background: selectedType === type ? '#2563EB' : 'rgba(255, 255, 255, 0.08)',
                  color: '#FFFFFF',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Jobs Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
          {filteredJobs.map((job) => (
            <div
              key={job.id}
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '20px',
                padding: '28px',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.3s ease',
                position: 'relative'
              }}
              className="job-card-dark"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                <span 
                  style={{ 
                    fontSize: '11px', 
                    fontWeight: 700, 
                    color: '#34D399', 
                    background: 'rgba(16, 185, 129, 0.12)', 
                    border: '1px solid rgba(16, 185, 129, 0.3)', 
                    padding: '4px 10px', 
                    borderRadius: '99px' 
                  }}
                >
                  {job.type}
                </span>
                <span style={{ fontSize: '12px', color: '#64748B' }}>{job.posted}</span>
              </div>

              <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#FFFFFF', marginBottom: '8px', lineHeight: '1.3' }}>
                {job.title}
              </h2>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#93C5FD', fontWeight: 600, marginBottom: '14px' }}>
                <Building size={16} />
                <span>{job.company}</span>
              </div>

              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', color: '#94A3B8', fontSize: '13px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={14} color="#60A5FA" />
                  <span>{job.location}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Briefcase size={14} color="#10B981" />
                  <span>{job.salary}</span>
                </div>
              </div>

              {/* Skills */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '24px', marginTop: 'auto' }}>
                {job.skills.map((skill, sIdx) => (
                  <span
                    key={sIdx}
                    style={{
                      fontSize: '12px',
                      color: '#E2E8F0',
                      background: 'rgba(255, 255, 255, 0.06)',
                      padding: '4px 10px',
                      borderRadius: '6px'
                    }}
                  >
                    {skill}
                  </span>
                ))}
              </div>

              <Link
                href={`/jobs/${job.id}`}
                className="btn-primary"
                style={{
                  width: '100%',
                  background: '#2563EB',
                  justifyContent: 'center',
                  padding: '12px',
                  borderRadius: '12px',
                  fontSize: '14px'
                }}
              >
                <span>View Full Details & Apply</span>
                <ArrowRight size={16} />
              </Link>
            </div>
          ))}
        </div>

        {filteredJobs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '64px 20px', color: '#94A3B8' }}>
            No matching openings found. Try adjusting your search keywords.
          </div>
        )}
      </div>
    </div>
  );
}
