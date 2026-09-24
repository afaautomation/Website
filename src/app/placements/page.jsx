'use client';

import React, { useState } from 'react';
import { placements } from '@/data/placements';
import { Search, Building, Award, CheckCircle2, TrendingUp } from 'lucide-react';
import Link from 'next/link';

export default function PlacementsPage() {
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = placements.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.course.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ background: '#02050E', color: '#FFFFFF', minHeight: '100vh', padding: '64px 0 96px' }}>
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
            Alumni Success Record
          </span>
          <h1 style={{ fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.03em', marginBottom: '16px' }}>
            Wall of Fame — Verified Placements
          </h1>
          <p style={{ color: '#94A3B8', fontSize: '18px', lineHeight: '1.6' }}>
            Over 2,000+ ambitious individuals trained at Kompetenzen and successfully placed in leading technology and corporate firms.
          </p>
        </div>

        {/* Search */}
        <div style={{ maxWidth: '500px', margin: '0 auto 48px', position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '16px', top: '15px', color: '#94A3B8' }} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by student, company (TCS, ISRO...), or course..."
            style={{
              width: '100%',
              padding: '12px 16px 12px 46px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '99px',
              color: '#FFFFFF',
              fontSize: '14px',
              outline: 'none'
            }}
          />
        </div>

        {/* Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px' }}>
          {filtered.map((alumni) => (
            <div
              key={alumni.id}
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '20px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                backdropFilter: 'blur(10px)',
                transition: 'all 0.3s ease'
              }}
              className="alumni-card"
            >
              <div 
                style={{ 
                  width: '96px', 
                  height: '96px', 
                  borderRadius: '50%', 
                  overflow: 'hidden', 
                  border: '3px solid #0E2EC9', 
                  marginBottom: '16px',
                  background: '#1E293B',
                  boxShadow: '0 8px 24px rgba(14, 46, 201, 0.3)'
                }}
              >
                <img 
                  src={alumni.image} 
                  alt={alumni.name} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>

              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#FFFFFF', marginBottom: '4px' }}>
                {alumni.name}
              </h2>
              <div style={{ fontSize: '13px', color: '#94A3B8', marginBottom: '8px' }}>
                {alumni.role}
              </div>
              <div style={{ fontSize: '12px', color: '#60A5FA', fontWeight: 600, marginBottom: '16px' }}>
                {alumni.course}
              </div>

              <div 
                style={{ 
                  width: '100%', 
                  background: 'rgba(255, 255, 255, 0.06)', 
                  borderRadius: '12px', 
                  padding: '10px 14px', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginTop: 'auto'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#E2E8F0' }}>
                  <Building size={14} color="#60A5FA" />
                  <span>{alumni.company}</span>
                </div>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#10B981' }}>
                  {alumni.package}
                </span>
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '64px 20px', color: '#94A3B8' }}>
            No alumni records match "{searchTerm}".
          </div>
        )}
      </div>
    </div>
  );
}
