import React from 'react';
import Link from 'next/link';
import { placements } from '@/data/placements';
import { Award, ArrowRight, Building, CheckCircle2 } from 'lucide-react';

export default function PlacementWall() {
  return (
    <section id="placements" style={{ padding: '96px 0', background: '#02050E', color: '#FFFFFF' }}>
      <div className="wrap">
        <div className="section-header" style={{ marginBottom: '64px' }}>
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
              marginBottom: '14px' 
            }}
          >
            Proof of Excellence
          </span>
          <h2 style={{ fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.03em', marginBottom: '16px' }}>
            Wall of Fame — 2,000+ Students Placed
          </h2>
          <p style={{ color: '#94A3B8', fontSize: '18px', maxWidth: '740px', margin: '0 auto', lineHeight: '1.6' }}>
            From colleges across Kerala to leading engineering teams worldwide. Meet our recent graduates who landed their dream offers.
          </p>
        </div>

        {/* Alumni Cards Grid */}
        <div 
          style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', 
            gap: '24px',
            marginBottom: '48px'
          }}
        >
          {placements.slice(0, 8).map((alumni) => (
            <div
              key={alumni.id}
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '20px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                backdropFilter: 'blur(10px)'
              }}
              className="alumni-card"
            >
              {/* Photo */}
              <div 
                style={{ 
                  width: '90px', 
                  height: '90px', 
                  borderRadius: '50%', 
                  overflow: 'hidden', 
                  border: '3px solid #0E2EC9', 
                  marginBottom: '16px',
                  background: '#1E293B',
                  boxShadow: '0 8px 20px rgba(14, 46, 201, 0.3)'
                }}
              >
                <img 
                  src={alumni.image} 
                  alt={alumni.name} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>

              {/* Name & Role */}
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#FFFFFF', marginBottom: '4px' }}>
                {alumni.name}
              </h3>
              <p style={{ fontSize: '13px', color: '#94A3B8', marginBottom: '14px' }}>
                {alumni.role}
              </p>

              {/* Company & Package Tag */}
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

        {/* View All Placements CTA */}
        <div style={{ textAlign: 'center' }}>
          <Link 
            href="/placements" 
            className="btn-primary"
            style={{ 
              background: '#0E2EC9', 
              color: '#FFFFFF', 
              padding: '14px 32px', 
              fontSize: '15px' 
            }}
          >
            <span>Explore All 2000+ Placements & Records</span>
            <ArrowRight size={18} />
          </Link>
        </div>
      </div>

    </section>
  );
}
