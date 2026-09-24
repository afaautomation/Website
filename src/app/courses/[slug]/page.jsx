'use client';

import React, { useState, use } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { courses, getCourseBySlug } from '@/data/courses';
import { useAuth } from '@/context/AuthContext';
import { 
  Clock, Briefcase, Star, CheckCircle2, ChevronDown, 
  ArrowRight, ShieldCheck, Download, Award, Laptop, Users
} from 'lucide-react';

export default function CourseDetailPage({ params }) {
  const resolvedParams = use(params);
  const course = getCourseBySlug(resolvedParams.slug);
  const { openPaymentModal } = useAuth();
  const [activeModule, setActiveModule] = useState(0);

  if (!course) {
    notFound();
  }

  return (
    <div style={{ background: '#FFFFFF' }}>
      {/* Course Hero */}
      <section 
        style={{ 
          padding: '64px 0 56px', 
          background: 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)',
          borderBottom: '1px solid rgba(10, 21, 48, 0.08)' 
        }}
      >
        <div className="wrap">
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748B', marginBottom: '20px' }}>
            <Link href="/" style={{ color: '#64748B' }}>Home</Link>
            <span>/</span>
            <Link href="/courses" style={{ color: '#64748B' }}>Courses</Link>
            <span>/</span>
            <span style={{ color: '#0E2EC9', fontWeight: 600 }}>{course.title}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '48px', alignItems: 'center' }}>
            <div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '16px' }}>
                <span className="badge badge-blue">{course.schoolName}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 700, color: '#F59E0B' }}>
                  <Star size={14} fill="#F59E0B" /> {course.rating} ({course.students})
                </span>
              </div>

              <h1 style={{ fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 800, color: '#02050E', lineHeight: '1.15', marginBottom: '20px', letterSpacing: '-0.03em' }}>
                {course.title}
              </h1>

              <p style={{ fontSize: '18px', color: '#474F66', lineHeight: '1.6', marginBottom: '28px' }}>
                {course.subtitle}
              </p>

              {/* Key Meta */}
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '36px' }}>
                <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', padding: '10px 18px', borderRadius: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>DURATION</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#02050E' }}>{course.duration}</div>
                </div>
                <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', padding: '10px 18px', borderRadius: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>STARTING CTC</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#10B981' }}>{course.startingSalary}</div>
                </div>
                <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', padding: '10px 18px', borderRadius: '12px' }}>
                  <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>MODE</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#02050E' }}>{course.mode}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => openPaymentModal({
                    title: course.title,
                    amount: 25000,
                    courseSlug: course.slug
                  })}
                  className="btn-primary"
                  style={{ padding: '14px 32px', fontSize: '16px' }}
                >
                  <span>Enroll in Program</span>
                  <ArrowRight size={18} />
                </button>
                <Link
                  href="/career-consulting"
                  className="btn-outline"
                  style={{ padding: '14px 28px', fontSize: '16px' }}
                >
                  Book 1-on-1 Consultation
                </Link>
              </div>
            </div>

            {/* Course Preview Card */}
            <div 
              style={{ 
                background: '#FFFFFF', 
                borderRadius: '24px', 
                border: '1px solid rgba(10, 21, 48, 0.1)', 
                overflow: 'hidden', 
                boxShadow: '0 20px 40px rgba(2, 5, 14, 0.08)' 
              }}
            >
              <img 
                src={course.heroImage} 
                alt={course.title} 
                style={{ width: '100%', height: '240px', objectFit: 'cover' }}
              />
              <div style={{ padding: '32px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#02050E', marginBottom: '16px' }}>
                  What You'll Achieve:
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {course.highlights.slice(0, 4).map((h, i) => (
                    <div key={i} style={{ display: 'flex', gap: '10px', fontSize: '14px', color: '#334155' }}>
                      <CheckCircle2 size={18} color="#0E2EC9" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span>{h}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Curriculum & Details */}
      <section style={{ padding: '80px 0' }}>
        <div className="wrap">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '64px' }}>
            
            {/* Left: Curriculum Modules */}
            <div>
              <div style={{ marginBottom: '32px' }}>
                <span className="section-tag">Syllabus Breakdown</span>
                <h2 style={{ fontSize: '32px', fontWeight: 800, color: '#02050E', marginTop: '10px' }}>
                  Detailed Curriculum Architecture
                </h2>
                <p style={{ color: '#64748B', fontSize: '16px', marginTop: '8px' }}>
                  Carefully engineered from foundational principles to complex production deployments.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {course.curriculum.map((item, idx) => {
                  const isOpen = activeModule === idx;
                  return (
                    <div
                      key={idx}
                      style={{
                        background: '#FFFFFF',
                        border: `1px solid ${isOpen ? 'rgba(14, 46, 201, 0.3)' : '#E2E8F0'}`,
                        borderRadius: '16px',
                        overflow: 'hidden',
                        transition: 'all 0.2s'
                      }}
                    >
                      <button
                        onClick={() => setActiveModule(isOpen ? null : idx)}
                        style={{
                          width: '100%',
                          padding: '20px 24px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          textAlign: 'left',
                          cursor: 'pointer'
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#0E2EC9', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            {item.module}
                          </div>
                          <div style={{ fontSize: '17px', fontWeight: 700, color: '#02050E', marginTop: '4px' }}>
                            {item.title}
                          </div>
                        </div>
                        <ChevronDown 
                          size={20} 
                          style={{ 
                            transform: isOpen ? 'rotate(180deg)' : 'none', 
                            transition: 'transform 0.25s',
                            color: isOpen ? '#0E2EC9' : '#94A3B8'
                          }} 
                        />
                      </button>

                      {isOpen && (
                        <div style={{ padding: '0 24px 20px', borderTop: '1px solid #F1F5F9' }}>
                          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '14px' }}>
                            {item.topics.map((t, tIdx) => (
                              <li key={tIdx} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#474F66' }}>
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#0E2EC9' }} />
                                <span>{t}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Tools & Career Roles */}
            <div>
              {/* Tools & Tech Stack */}
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '24px', padding: '32px', marginBottom: '32px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#02050E', marginBottom: '16px' }}>
                  Tools & Technologies Mastered
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {course.tools.map((tool, i) => (
                    <span 
                      key={i} 
                      style={{ 
                        background: '#FFFFFF', 
                        border: '1px solid #CBD5E1', 
                        padding: '6px 14px', 
                        borderRadius: '8px', 
                        fontSize: '13px', 
                        fontWeight: 600, 
                        color: '#1E293B' 
                      }}
                    >
                      {tool}
                    </span>
                  ))}
                </div>
              </div>

              {/* Career Opportunities */}
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '24px', padding: '32px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#02050E', marginBottom: '16px' }}>
                  Eligible Job Roles
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {course.careerRoles.map((role, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#334155', fontWeight: 600 }}>
                      <CheckCircle2 size={16} color="#10B981" />
                      <span>{role}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>
    </div>
  );
}
