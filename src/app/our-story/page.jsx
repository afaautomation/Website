import React from 'react';
import Link from 'next/link';
import { Sparkles, Target, Compass, Award, Users, CheckCircle2, ArrowRight } from 'lucide-react';

export const metadata = {
  title: "Our Story & Vision | Kompetenzen Skill Development Academy",
  description: "Learn how Kompetenzen became Kerala's #1 outcome-driven career accelerator and corporate placement partner.",
};

const milestones = [
  {
    year: "2021",
    title: "The Genesis",
    desc: "Founded by senior corporate architects frustrated by the unemployability of rote-learning graduates in Kerala."
  },
  {
    year: "2022",
    title: "First 250 Placements",
    desc: "Achieved 100% placement rate for the inaugural cohorts in Full Stack Python and Java development."
  },
  {
    year: "2023",
    title: "Launch of B-School & Finishing School",
    desc: "Expanded into modern HR operations, sales engineering, and executive corporate readiness."
  },
  {
    year: "2024 - 2026",
    title: "2,000+ Alumni Across Global Tech",
    desc: "Partnered with 250+ active hiring partners across Technopark, Infopark, Bangalore, and GCC countries."
  }
];

export default function OurStoryPage() {
  return (
    <div style={{ background: '#FFFFFF', padding: '64px 0 96px' }}>
      <div className="wrap">
        
        {/* Story Hero */}
        <div style={{ maxWidth: '840px', margin: '0 auto 64px', textAlign: 'center' }}>
          <span className="section-tag">Our Founding Purpose</span>
          <h1 className="section-title">
            Transforming Kerala's Youth into Global Engineering & Business Leaders
          </h1>
          <p className="section-desc">
            We started with a single uncompromising hypothesis: any ambitious student, regardless of their college tier or GPA, can secure high-paying MNC offers if trained on production-level architectures under ruthless industry standards.
          </p>
        </div>

        {/* Mission & Vision Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '32px', marginBottom: '80px' }}>
          <div style={{ background: '#F8FAFC', border: '1px solid rgba(10, 21, 48, 0.08)', borderRadius: '24px', padding: '40px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#E8ECFF', color: '#0E2EC9', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
              <Target size={24} />
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#02050E', marginBottom: '12px' }}>
              Our Mission
            </h2>
            <p style={{ color: '#474F66', fontSize: '15px', lineHeight: '1.7' }}>
              To democratize world-class technical and business education, eradicate unemployability, and provide a verifiable springboard for every student who enters our campus.
            </p>
          </div>

          <div style={{ background: '#F8FAFC', border: '1px solid rgba(10, 21, 48, 0.08)', borderRadius: '24px', padding: '40px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
              <Compass size={24} />
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#02050E', marginBottom: '12px' }}>
              Our Philosophy
            </h2>
            <p style={{ color: '#474F66', fontSize: '15px', lineHeight: '1.7' }}>
              Zero theoretical exams. 100% production code, live client demonstrations, real HRMS platforms, and aggressive mock interview preparation.
            </p>
          </div>
        </div>

        {/* Milestones Timeline */}
        <div style={{ marginBottom: '80px' }}>
          <div className="section-header" style={{ marginBottom: '48px' }}>
            <span className="section-tag">Timeline</span>
            <h2 className="section-title">The Evolution of Kompetenzen</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px' }}>
            {milestones.map((m, i) => (
              <div 
                key={i} 
                style={{ 
                  background: '#FFFFFF', 
                  border: '1px solid rgba(10, 21, 48, 0.08)', 
                  borderRadius: '20px', 
                  padding: '32px',
                  boxShadow: '0 4px 16px rgba(2, 5, 14, 0.03)'
                }}
              >
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#0E2EC9', marginBottom: '12px' }}>
                  {m.year}
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#02050E', marginBottom: '8px' }}>
                  {m.title}
                </h3>
                <p style={{ color: '#474F66', fontSize: '14px', lineHeight: '1.6' }}>
                  {m.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Call to Action */}
        <div 
          style={{ 
            background: 'linear-gradient(135deg, #02050E 0%, #0D1630 100%)', 
            borderRadius: '24px', 
            padding: '56px 40px', 
            textAlign: 'center', 
            color: '#FFFFFF' 
          }}
        >
          <h2 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '16px' }}>
            Be Part of Our Next Success Story
          </h2>
          <p style={{ color: '#94A3B8', fontSize: '16px', maxWidth: '600px', margin: '0 auto 32px' }}>
            Visit our Kochi campus or talk with a senior counselor today to discover which program accelerates your goals.
          </p>
          <Link href="/career-consulting" className="btn-primary" style={{ padding: '14px 32px' }}>
            <span>Connect with Career Team</span>
            <ArrowRight size={18} />
          </Link>
        </div>

      </div>
    </div>
  );
}
