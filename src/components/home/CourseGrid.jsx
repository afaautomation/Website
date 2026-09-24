'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { courses } from '@/data/courses';
import { Clock, Briefcase, Star, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function CourseGrid() {
  const [filter, setFilter] = useState('all');
  const { openPaymentModal } = useAuth();

  const filteredCourses = filter === 'all' 
    ? courses 
    : courses.filter(c => c.school === filter);

  return (
    <section style={{ padding: '96px 0', background: '#F8FAFC', borderTop: '1px solid rgba(10, 21, 48, 0.06)', borderBottom: '1px solid rgba(10, 21, 48, 0.06)' }}>
      <div className="wrap">
        <div className="section-header">
          <span className="section-tag">Industry Programs</span>
          <h2 className="section-title">
            Engineered for High-Paying Job Offers
          </h2>
          <p className="section-desc">
            Curated by tech leads and corporate directors. Real projects, direct company mock interviews, and zero fluff.
          </p>

          {/* Filter Pills */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '32px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setFilter('all')}
              style={{
                padding: '8px 20px',
                borderRadius: '99px',
                fontSize: '14px',
                fontWeight: 600,
                background: filter === 'all' ? '#0E2EC9' : '#FFFFFF',
                color: filter === 'all' ? '#FFFFFF' : '#474F66',
                border: `1px solid ${filter === 'all' ? '#0E2EC9' : 'rgba(10, 21, 48, 0.1)'}`,
                transition: 'all 0.2s',
                cursor: 'pointer'
              }}
            >
              All Programs
            </button>
            <button
              onClick={() => setFilter('tech-school')}
              style={{
                padding: '8px 20px',
                borderRadius: '99px',
                fontSize: '14px',
                fontWeight: 600,
                background: filter === 'tech-school' ? '#0E2EC9' : '#FFFFFF',
                color: filter === 'tech-school' ? '#FFFFFF' : '#474F66',
                border: `1px solid ${filter === 'tech-school' ? '#0E2EC9' : 'rgba(10, 21, 48, 0.1)'}`,
                transition: 'all 0.2s',
                cursor: 'pointer'
              }}
            >
              Tech & AI School
            </button>
            <button
              onClick={() => setFilter('b-school')}
              style={{
                padding: '8px 20px',
                borderRadius: '99px',
                fontSize: '14px',
                fontWeight: 600,
                background: filter === 'b-school' ? '#0E2EC9' : '#FFFFFF',
                color: filter === 'b-school' ? '#FFFFFF' : '#474F66',
                border: `1px solid ${filter === 'b-school' ? '#0E2EC9' : 'rgba(10, 21, 48, 0.1)'}`,
                transition: 'all 0.2s',
                cursor: 'pointer'
              }}
            >
              B-School & Management
            </button>
          </div>
        </div>

        {/* Courses Cards Grid */}
        <div 
          style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', 
            gap: '32px' 
          }}
        >
          {filteredCourses.map((c) => (
            <div
              key={c.slug}
              style={{
                background: '#FFFFFF',
                borderRadius: '24px',
                border: '1px solid rgba(10, 21, 48, 0.08)',
                padding: '32px',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 4px 16px rgba(2, 5, 14, 0.03)',
                transition: 'all 0.3s ease'
              }}
              className="course-card"
            >
              {/* Card Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <span className="badge badge-blue">
                  {c.schoolName}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 700, color: '#F59E0B' }}>
                  <Star size={14} fill="#F59E0B" />
                  <span>{c.rating}</span>
                </div>
              </div>

              {/* Title & Subtitle */}
              <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#02050E', lineHeight: '1.3', marginBottom: '10px' }}>
                {c.title}
              </h3>
              <p style={{ color: '#474F66', fontSize: '14px', lineHeight: '1.6', marginBottom: '20px' }}>
                {c.subtitle}
              </p>

              {/* Key Meta Badges */}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#1E293B', background: '#F1F5F9', padding: '6px 12px', borderRadius: '8px', fontWeight: 500 }}>
                  <Clock size={14} color="#0E2EC9" />
                  <span>{c.duration}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#1E293B', background: '#F1F5F9', padding: '6px 12px', borderRadius: '8px', fontWeight: 500 }}>
                  <Briefcase size={14} color="#10B981" />
                  <span>{c.startingSalary}</span>
                </div>
              </div>

              {/* Tools Tags */}
              <div style={{ marginBottom: '28px', marginTop: 'auto' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                  Core Tools & Stacks
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {c.tools.slice(0, 5).map((tool, idx) => (
                    <span 
                      key={idx}
                      style={{ fontSize: '12px', fontWeight: 600, color: '#334155', background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '3px 10px', borderRadius: '6px' }}
                    >
                      {tool}
                    </span>
                  ))}
                  {c.tools.length > 5 && (
                    <span style={{ fontSize: '12px', color: '#94A3B8', padding: '3px 6px' }}>+{c.tools.length - 5} more</span>
                  )}
                </div>
              </div>

              {/* Card Actions */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <Link
                  href={`/courses/${c.slug}`}
                  className="btn-outline"
                  style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', fontSize: '14px', textAlign: 'center' }}
                >
                  View Details
                </Link>
                <button
                  onClick={() => openPaymentModal({
                    title: c.title,
                    amount: 25000,
                    courseSlug: c.slug
                  })}
                  className="btn-primary"
                  style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', fontSize: '14px', textAlign: 'center' }}
                >
                  Enroll Now
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
