import React from 'react';
import Link from 'next/link';
import { GraduationCap, Award, CheckCircle2, ArrowRight, Mic, Users, Compass } from 'lucide-react';

export const metadata = {
  title: "Finishing School | Kompetenzen Corporate Readiness",
  description: "Master executive communication, corporate etiquette, personality transformation, and high-stakes interview mastery.",
};

const modules = [
  {
    icon: Mic,
    title: "Executive Business Communication",
    desc: "Speak with authority. Learn structured thinking (Pyramid Principle), corporate presentations, handling Q&A under pressure, and active listening."
  },
  {
    icon: Users,
    title: "Corporate Etiquette & Protocol",
    desc: "Master modern office diplomacy, client email etiquette, remote work professionalism, cross-cultural collaboration, and emotional intelligence."
  },
  {
    icon: Award,
    title: "High-Stakes Interview Mastery",
    desc: "Deconstruct behavioral, stress, and managerial interview formats. Learn the STAR storytelling framework and proven techniques to stand out."
  },
  {
    icon: Compass,
    title: "Negotiation & Career Acceleration",
    desc: "Learn how to counter-offer, negotiate compensation packages respectfully, and map your trajectory from entry-level to senior leadership."
  }
];

export default function FinishingSchoolPage() {
  return (
    <div style={{ background: '#FFFFFF' }}>
      {/* Hero */}
      <section 
        style={{ 
          padding: '80px 0 64px', 
          background: 'linear-gradient(180deg, #064E3B 0%, #022C22 100%)', 
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
                  background: 'rgba(16, 185, 129, 0.2)', 
                  padding: '6px 16px', 
                  borderRadius: '99px', 
                  fontSize: '13px', 
                  fontWeight: 700, 
                  color: '#6EE7B7',
                  marginBottom: '20px' 
                }}
              >
                <GraduationCap size={16} /> Kompetenzen Finishing School
              </div>

              <h1 style={{ fontSize: 'clamp(36px, 5vw, 60px)', fontWeight: 800, color: '#FFFFFF', lineHeight: '1.1', marginBottom: '20px', letterSpacing: '-0.03em' }}>
                Executive Presence & Corporate Readiness
              </h1>

              <p style={{ color: '#A7F3D0', fontSize: '18px', lineHeight: '1.6', marginBottom: '32px' }}>
                Knowledge gets you the interview. Executive poise, persuasive articulation, and behavioral mastery land you the job.
              </p>

              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <Link href="/career-consulting" className="btn-primary" style={{ background: '#10B981', padding: '14px 32px' }}>
                  <span>Apply for Next Cohort</span>
                  <ArrowRight size={18} />
                </Link>
                <a href="#curriculum" className="btn-outline" style={{ background: 'transparent', color: '#FFFFFF', borderColor: 'rgba(255,255,255,0.2)' }}>
                  Explore Modules
                </a>
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <img 
                src="/finishing.png" 
                alt="Finishing School" 
                style={{ borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', width: '100%', maxHeight: '420px', objectFit: 'cover' }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Modules */}
      <section id="curriculum" style={{ padding: '96px 0', background: '#F8FAFC' }}>
        <div className="wrap">
          <div className="section-header">
            <span className="section-tag">Program Architecture</span>
            <h2 className="section-title">
              What You Master in the Finishing School
            </h2>
            <p className="section-desc">
              Designed for final-year students, fresh graduates, and transitioning professionals who want to project undeniable confidence.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '32px' }}>
            {modules.map((m, i) => {
              const Icon = m.icon;
              return (
                <div 
                  key={i} 
                  style={{ 
                    background: '#FFFFFF', 
                    borderRadius: '20px', 
                    border: '1px solid rgba(10, 21, 48, 0.08)', 
                    padding: '32px',
                    boxShadow: '0 4px 16px rgba(2, 5, 14, 0.03)'
                  }}
                >
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                    <Icon size={24} />
                  </div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#02050E', marginBottom: '10px' }}>
                    {m.title}
                  </h3>
                  <p style={{ color: '#474F66', fontSize: '14px', lineHeight: '1.6' }}>
                    {m.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
