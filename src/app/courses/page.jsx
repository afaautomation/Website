import React from 'react';
import Link from 'next/link';
import { courses } from '@/data/courses';
import { Clock, Briefcase, Star, ArrowRight } from 'lucide-react';

export const metadata = {
  title: "Industry Certification Programs | Kompetenzen Academy",
  description: "Explore our job-ready programs in Full Stack Python, Full Stack Java, Data Analytics, Generative AI, HR Operations, and Sales Engineering.",
};

export default function CoursesPage() {
  return (
    <div style={{ padding: '64px 0 96px', background: '#F8FAFC' }}>
      <div className="wrap">
        <div className="section-header" style={{ marginBottom: '56px' }}>
          <span className="section-tag">All Programs</span>
          <h1 className="section-title">
            Industry Certification Programs
          </h1>
          <p className="section-desc">
            Outcome-focused curricula built for immediate corporate placement. Zero filler, 100% production skills.
          </p>
        </div>

        <div 
          style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', 
            gap: '32px' 
          }}
        >
          {courses.map((c) => (
            <div
              key={c.slug}
              style={{
                background: '#FFFFFF',
                borderRadius: '24px',
                border: '1px solid rgba(10, 21, 48, 0.08)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 4px 20px rgba(2, 5, 14, 0.03)'
              }}
            >
              <div style={{ height: '180px', overflow: 'hidden', position: 'relative' }}>
                <img 
                  src={c.heroImage} 
                  alt={c.title} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <span 
                  style={{ 
                    position: 'absolute', 
                    top: '16px', 
                    left: '16px', 
                    background: '#0E2EC9', 
                    color: '#FFFFFF', 
                    fontSize: '12px', 
                    fontWeight: 700, 
                    padding: '4px 12px', 
                    borderRadius: '99px' 
                  }}
                >
                  {c.schoolName}
                </span>
              </div>

              <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: '#F59E0B', marginBottom: '8px' }}>
                  <Star size={14} fill="#F59E0B" />
                  <span>{c.rating} • {c.students}</span>
                </div>

                <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#02050E', lineHeight: '1.3', marginBottom: '10px' }}>
                  {c.title}
                </h2>
                <p style={{ color: '#474F66', fontSize: '14px', lineHeight: '1.6', marginBottom: '20px' }}>
                  {c.subtitle}
                </p>

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

                <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #F1F5F9' }}>
                  <Link
                    href={`/courses/${c.slug}`}
                    className="btn-primary"
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    <span>View Curriculum & Details</span>
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
