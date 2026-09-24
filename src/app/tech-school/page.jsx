import React from 'react';
import Link from 'next/link';
import { courses } from '@/data/courses';
import { Sparkles, Terminal, Code2, Cpu, CheckCircle2, ArrowRight } from 'lucide-react';

export const metadata = {
  title: "Tech School | Kompetenzen Engineering Academy",
  description: "Become an elite software engineer. Master Full Stack Python, Spring Boot Java, and Data Analytics + GenAI with guaranteed placement support.",
};

export default function TechSchoolPage() {
  const techCourses = courses.filter(c => c.school === 'tech-school');

  return (
    <div style={{ background: '#FFFFFF' }}>
      {/* Hero */}
      <section 
        style={{ 
          padding: '80px 0 64px', 
          background: 'linear-gradient(180deg, #02050E 0%, #0D1630 100%)', 
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
                  background: 'rgba(25, 71, 255, 0.2)', 
                  padding: '6px 16px', 
                  borderRadius: '99px', 
                  fontSize: '13px', 
                  fontWeight: 700, 
                  color: '#60A5FA',
                  marginBottom: '20px' 
                }}
              >
                <Terminal size={16} /> Kompetenzen Tech School
              </div>

              <h1 style={{ fontSize: 'clamp(36px, 5vw, 60px)', fontWeight: 800, color: '#FFFFFF', lineHeight: '1.1', marginBottom: '20px', letterSpacing: '-0.03em' }}>
                Engineering Modern Software & AI Systems
              </h1>

              <p style={{ color: '#94A3B8', fontSize: '18px', lineHeight: '1.6', marginBottom: '32px' }}>
                Kerala's premier developer launchpad. Move beyond textbook exercises into production architectures: microservices, distributed caching, LangChain AI pipelines, and cloud deployment.
              </p>

              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <a href="#tech-courses" className="btn-primary" style={{ padding: '14px 32px' }}>
                  <span>View Tech Programs</span>
                  <ArrowRight size={18} />
                </a>
                <Link href="/career-consulting" className="btn-outline" style={{ background: 'transparent', color: '#FFFFFF', borderColor: 'rgba(255,255,255,0.2)' }}>
                  Talk to Tech Advisor
                </Link>
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <img 
                src="/tech.png" 
                alt="Tech School Showcase" 
                style={{ borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', width: '100%', maxHeight: '420px', objectFit: 'cover' }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Course Offerings */}
      <section id="tech-courses" style={{ padding: '96px 0', background: '#F8FAFC' }}>
        <div className="wrap">
          <div className="section-header">
            <span className="section-tag">Tech Catalog</span>
            <h2 className="section-title">
              Job-Guaranteed Tech Programs
            </h2>
            <p className="section-desc">
              Structured for beginners to advanced engineers. Built in consultation with hiring directors from top tech firms.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '32px' }}>
            {techCourses.map((c) => (
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
                      <CheckCircle2 size={16} color="#0E2EC9" style={{ flexShrink: 0, marginTop: '2px' }} />
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
