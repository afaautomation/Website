import React from 'react';
import Link from 'next/link';
import { Sparkles, Briefcase, GraduationCap, Compass, ArrowRight, Check } from 'lucide-react';

const schools = [
  {
    title: "Tech School",
    tag: "Engineering & AI",
    badgeColor: "#E8ECFF",
    textColor: "#0E2EC9",
    icon: Sparkles,
    href: "/tech-school",
    image: "/tech.png",
    desc: "Transform into a production-ready software engineer or data specialist. Master modern Python, Java, Data Analytics, and enterprise Generative AI.",
    bullets: [
      "Full Stack Python + AI Architecture",
      "Full Stack Java 21 + Spring Boot Microservices",
      "Data Analytics & GenAI Business Intelligence",
      "100% Guaranteed Project-Driven Portfolio"
    ]
  },
  {
    title: "B-School",
    tag: "Management & Sales",
    badgeColor: "#FEF3C7",
    textColor: "#D97706",
    icon: Briefcase,
    href: "/b-school",
    image: "/bschool.png",
    desc: "Accelerate your career in modern human resource operations, corporate talent acquisition, or lucrative high-ticket technical SaaS sales.",
    bullets: [
      "PG Diploma in HR Management & Payroll Analytics",
      "Enterprise Tech & SaaS Sales Engineering",
      "Labour Law, POSH & Statutory Compliance",
      "High Incentive Global Career Opportunities"
    ]
  },
  {
    title: "Finishing School",
    tag: "Corporate Readiness",
    badgeColor: "#ECFDF5",
    textColor: "#059669",
    icon: GraduationCap,
    href: "/finishing-school",
    image: "/finishing.png",
    desc: "Polish your corporate demeanor, public speaking, executive communication, and negotiation skills to stand out during high-stakes interviews.",
    bullets: [
      "Executive Presence & Corporate Etiquette",
      "High-Impact Client Pitching & Presentation",
      "Behavioral & Case Interview Mastery",
      "Personality Transformation & Confidence"
    ]
  },
  {
    title: "Career Consulting",
    tag: "1-on-1 Strategy",
    badgeColor: "#F3E8FF",
    textColor: "#9333EA",
    icon: Compass,
    href: "/career-consulting",
    image: "/student_python.jpg",
    desc: "Unsure which career domain fits your background? Get direct 1-on-1 strategic roadmap consultation with senior corporate leaders.",
    bullets: [
      "Comprehensive Skill Gap & Profile Assessment",
      "Resume & LinkedIn ATS Optimization",
      "Tailored Career Transition Roadmap",
      "Direct Executive Mentorship"
    ]
  }
];

export default function SchoolCards() {
  return (
    <section style={{ padding: '96px 0', background: '#FFFFFF' }}>
      <div className="wrap">
        <div className="section-header">
          <span className="section-tag">Academic Architecture</span>
          <h2 className="section-title">
            Four Specialized Pillars Built for Maximum Career Success
          </h2>
          <p className="section-desc">
            Whether you want to build cutting-edge software, lead corporate talent, or master executive business communication, our dedicated schools provide the specialized edge you need.
          </p>
        </div>

        <div 
          style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', 
            gap: '32px' 
          }}
        >
          {schools.map((school, i) => {
            const Icon = school.icon;
            return (
              <div
                key={i}
                style={{
                  background: '#FFFFFF',
                  borderRadius: '24px',
                  border: '1px solid rgba(10, 21, 48, 0.08)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                  boxShadow: '0 4px 20px rgba(2, 5, 14, 0.03)'
                }}
                className="school-card"
              >
                {/* Image Header */}
                <div style={{ height: '180px', overflow: 'hidden', position: 'relative', background: '#F1F5F9' }}>
                  <img 
                    src={school.image} 
                    alt={school.title} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s ease' }}
                    className="school-card-img"
                  />
                  <div 
                    style={{ 
                      position: 'absolute', 
                      top: '16px', 
                      left: '16px', 
                      background: school.badgeColor, 
                      color: school.textColor, 
                      padding: '4px 12px', 
                      borderRadius: '99px', 
                      fontSize: '12px', 
                      fontWeight: 700 
                    }}
                  >
                    {school.tag}
                  </div>
                </div>

                {/* Content */}
                <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                    <div style={{ background: school.badgeColor, color: school.textColor, padding: '8px', borderRadius: '10px' }}>
                      <Icon size={20} />
                    </div>
                    <h3 style={{ fontSize: '22px', fontWeight: 800, color: '#02050E' }}>
                      {school.title}
                    </h3>
                  </div>

                  <p style={{ color: '#474F66', fontSize: '14px', lineHeight: '1.6', marginBottom: '20px' }}>
                    {school.desc}
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px', marginTop: 'auto' }}>
                    {school.bullets.map((bullet, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#1E293B', fontWeight: 500 }}>
                        <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Check size={12} color="#0E2EC9" />
                        </div>
                        <span>{bullet}</span>
                      </div>
                    ))}
                  </div>

                  <Link 
                    href={school.href} 
                    className="btn-outline"
                    style={{ width: '100%', justifyContent: 'space-between', padding: '12px 20px', borderRadius: '12px' }}
                  >
                    <span>Explore {school.title}</span>
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </section>
  );
}
