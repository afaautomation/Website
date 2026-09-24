'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { ArrowRight, Sparkles, CheckCircle2, ShieldCheck, Users, Trophy } from 'lucide-react';

export default function HeroSection() {
  const { openAuthModal } = useAuth();

  return (
    <section 
      style={{
        position: 'relative',
        padding: ' clamp(60px, 8vw, 110px) 0 clamp(40px, 6vw, 80px)',
        background: 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)',
        overflow: 'hidden',
        borderBottom: '1px solid rgba(10, 21, 48, 0.06)'
      }}
    >
      {/* Decorative Gradient Glows */}
      <div 
        style={{
          position: 'absolute',
          top: '-10%',
          right: '5%',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(14, 46, 201, 0.12) 0%, rgba(255,255,255,0) 70%)',
          pointerEvents: 'none',
          zIndex: 0
        }}
      />
      <div 
        style={{
          position: 'absolute',
          bottom: '5%',
          left: '-10%',
          width: '450px',
          height: '450px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, rgba(255,255,255,0) 70%)',
          pointerEvents: 'none',
          zIndex: 0
        }}
      />

      <div className="wrap" style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: '960px', margin: '0 auto', textAlign: 'center' }}>
          
          {/* Trust Badge */}
          <div 
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '8px', 
              background: '#FFFFFF', 
              padding: '6px 18px', 
              borderRadius: '99px', 
              border: '1px solid rgba(14, 46, 201, 0.16)', 
              boxShadow: '0 4px 12px rgba(2, 5, 14, 0.04)',
              marginBottom: '24px'
            }}
          >
            <span className="pulse-dot" />
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#0E2EC9', letterSpacing: '0.4px' }}>
              Admissions Open • Batch of 2026
            </span>
            <span style={{ color: '#CBD5E1' }}>|</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#474F66' }}>
              100% Placement Support
            </span>
          </div>

          {/* Main Headline */}
          <h1 
            style={{ 
              fontSize: 'clamp(38px, 6vw, 72px)', 
              fontWeight: 800, 
              lineHeight: 1.08, 
              letterSpacing: '-0.035em', 
              color: '#02050E', 
              marginBottom: '24px' 
            }}
          >
            Where Kerala's Top Ambition <br />
            Transforms into <span style={{ color: '#0E2EC9', position: 'relative' }}>
              Global Careers
            </span>
          </h1>

          {/* Subtitle */}
          <p 
            style={{ 
              fontSize: 'clamp(16px, 2vw, 20px)', 
              color: '#474F66', 
              lineHeight: 1.6, 
              maxWidth: '780px', 
              margin: '0 auto 36px',
              textWrap: 'balance'
            }}
          >
            Kerala's elite career consulting, engineering academy, and corporate finishing school. Master modern Generative AI, Full Stack Development, Data Analytics, and Corporate Leadership with guaranteed industry placement support.
          </p>

          {/* Action CTAs */}
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '16px', 
              flexWrap: 'wrap', 
              marginBottom: '48px' 
            }}
          >
            <Link 
              href="/career-consulting" 
              className="btn-primary" 
              style={{ fontSize: '16px', padding: '14px 32px' }}
            >
              Book 1-on-1 Career Consultation <ArrowRight size={18} />
            </Link>
            <Link 
              href="/courses" 
              className="btn-outline" 
              style={{ fontSize: '16px', padding: '14px 28px' }}
            >
              Explore All Programs
            </Link>
          </div>

          {/* Highlights checklist */}
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '28px', 
              flexWrap: 'wrap', 
              color: '#474F66', 
              fontSize: '14px', 
              fontWeight: 600,
              paddingTop: '20px',
              borderTop: '1px solid rgba(10, 21, 48, 0.08)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={18} color="#10B981" />
              <span>Zero-Prerequisite Tracks</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={18} color="#10B981" />
              <span>Live Enterprise Capstones</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={18} color="#10B981" />
              <span>Direct MNC Interview Referrals</span>
            </div>
          </div>
        </div>

        {/* Stats Grid Banner */}
        <div 
          style={{ 
            marginTop: '64px', 
            background: '#FFFFFF', 
            borderRadius: '24px', 
            border: '1px solid rgba(10, 21, 48, 0.08)', 
            padding: '32px 40px', 
            boxShadow: '0 20px 40px -10px rgba(2, 5, 14, 0.06)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '32px',
            textAlign: 'center'
          }}
        >
          <div>
            <div style={{ fontSize: 'clamp(32px, 3.5vw, 44px)', fontWeight: 800, color: '#0E2EC9', letterSpacing: '-0.03em' }}>
              2,000+
            </div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#474F66', marginTop: '4px' }}>
              Successful Placements
            </div>
          </div>

          <div style={{ borderLeft: '1px solid rgba(10, 21, 48, 0.08)' }}>
            <div style={{ fontSize: 'clamp(32px, 3.5vw, 44px)', fontWeight: 800, color: '#02050E', letterSpacing: '-0.03em' }}>
              ₹15 LPA
            </div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#474F66', marginTop: '4px' }}>
              Highest Package Offered
            </div>
          </div>

          <div style={{ borderLeft: '1px solid rgba(10, 21, 48, 0.08)' }}>
            <div style={{ fontSize: 'clamp(32px, 3.5vw, 44px)', fontWeight: 800, color: '#0E2EC9', letterSpacing: '-0.03em' }}>
              250+
            </div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#474F66', marginTop: '4px' }}>
              Active Hiring Partners
            </div>
          </div>

          <div style={{ borderLeft: '1px solid rgba(10, 21, 48, 0.08)' }}>
            <div style={{ fontSize: 'clamp(32px, 3.5vw, 44px)', fontWeight: 800, color: '#10B981', letterSpacing: '-0.03em' }}>
              100%
            </div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#474F66', marginTop: '4px' }}>
              Placement Assistance
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
