import React from 'react';
import Link from 'next/link';
import { courses } from '@/data/courses';
import { Briefcase, TrendingUp, Users, CheckCircle2, ArrowRight } from 'lucide-react';

export const metadata = {
  title: "B-School | Kompetenzen Business & Management Academy",
  description: "Accelerate your corporate career with our PG Diploma in HR Management & Operations and Sales Engineering programs.",
};

export default function BSchoolPage() {
  const bSchoolCourses = courses.filter(c => c.school === 'b-school');

  return (
    <div style={{ background: '#FFFFFF' }}>
      {/* Hero */}
      <section 
        style={{ 
          padding: '80px 0 64px', 
          background: 'linear-gradient(180deg, #18181B 0%, #09090B 100%)', 
          color: '#FFFFFF' 
        }}
      >
        <div className="wrap">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '48px', alignItems: 'center' }}>
            <div>
              <div 
                style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  background: 'rgba(217, 119, 6, 0.2)', 
                  padding: '6px 16px', 
                  borderRadius: '99px', 
                  fontSize: '13px', 
                  fontWeight: 700, 
                  color: '#FBBF24',
                  marginBottom: '20px' 
                }}
              >
                <Briefcase size={16} /> Kompetenzen B-School
              </div>

              <h1 style={{ fontSize: 'clamp(36px, 5vw, 60px)', fontWeight: 800, color: '#FFFFFF', lineHeight: '1.1', marginBottom: '20px', letterSpacing: '-0.03em' }}>
                Corporate HR Leadership & Revenue Strategy
              </h1>

              <p style={{ color: '#A1A1AA', fontSize: '18px', lineHeight: '1.6', marginBottom: '32px' }}>
                Master strategic talent acquisition, payroll analytics, labour compliance, and enterprise B2B sales. Step directly into managerial and high-incentive positions.
              </p>

              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <a href="#b-courses" className="btn-primary" style={{ padding: '14px 32px' }}>
                  <span>View Management Programs</span>
                  <ArrowRight size={18} />
                </a>
                <Link href="/career-consulting" className="btn-outline" style={{ background: 'transparent', color: '#FFFFFF', borderColor: 'rgba(255,255,255,0.2)' }}>
                  Talk to Admissions
                </Link>
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <img 
                src="/bschool.png" 
                alt="B-School Showcase" 
                style={{ borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', width: '100%', maxHeight: '420px', objectFit: 'cover' }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Course Offerings */}
      <section id="b-courses" style={{ padding: '96px 0', background: '#F8FAFC' }}>
        <div className="wrap">
          <div className="section-header">
            <span className="section-tag">Management Programs</span>
            <h2 className="section-title">
              High-Impact Corporate Certifications
            </h2>
            <p className="section-desc">
              Master practical, software-backed management operations with live HRMS platforms and enterprise CRM suites.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '32px' }}>
            {bSchoolCourses.map((c) => (
              <div 
                key={c.slug} 
                style={{ 
                  background: '#FFFFFF', 
                  borderRadius: '24px', 
                  border: '1px solid rgba(10, 21, 48, 0.08)', 
                  padding: '32px',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 4px 20px rgba(2, 5, 14, 0.03)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <span className="badge badge-blue">{c.tag}</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#10B981' }}>{c.placement}</span>
                </div>

                <h3 style={{ fontSize: '22px', fontWeight: 800, color: '#02050E', marginBottom: '12px' }}>
                  {c.title}
                </h3>
                <p style={{ color: '#474F66', fontSize: '14px', lineHeight: '1.6', marginBottom: '24px' }}>
                  {c.subtitle}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px', marginTop: 'auto' }}>
                  {c.highlights.slice(0, 3).map((h, i) => (
                    <div key={i} style={{ display: 'flex', gap: '10px', fontSize: '13px', color: '#1E293B' }}>
                      <CheckCircle2 size={16} color="#D97706" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span>{h}</span>
                    </div>
                  ))}
                </div>

                <Link href={`/courses/${c.slug}`} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                  <span>Explore Curriculum</span>
                  <ArrowRight size={16} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
