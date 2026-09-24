import React from 'react';
import { ShieldCheck, Laptop, Rocket, Award, Headphones, TrendingUp } from 'lucide-react';

const features = [
  {
    icon: ShieldCheck,
    title: "100% Placement Assurance",
    desc: "Dedicated internal referral cell with 250+ active hiring partners across Technopark, Infopark, Bangalore, and GCC."
  },
  {
    icon: Laptop,
    title: "Production-Grade Capstones",
    desc: "Build real enterprise microservices, generative AI agents, and live financial analytics dashboards that hiring managers value."
  },
  {
    icon: Headphones,
    title: "1-on-1 Senior Mentorship",
    desc: "Learn directly from tech leads and corporate directors who review your code and conduct rigorous mock interviews."
  },
  {
    icon: Rocket,
    title: "Finishing School Edge",
    desc: "Complimentary executive communication, corporate presence, and salary negotiation masterclasses."
  },
  {
    icon: TrendingUp,
    title: "Zero-Risk Career Roadmap",
    desc: "Custom personalized skill assessment tailored to your background before you enroll in any track."
  },
  {
    icon: Award,
    title: "Recognized Certification",
    desc: "Digital verifiable credentials, GitHub portfolio proof-of-work, and formal executive recommendation letters."
  }
];

export default function WhyUs() {
  return (
    <section style={{ padding: '96px 0', background: '#FFFFFF' }}>
      <div className="wrap">
        <div className="section-header">
          <span className="section-tag">The Kompetenzen Edge</span>
          <h2 className="section-title">
            Why Kerala's Most Ambitious Candidates Choose Us
          </h2>
          <p className="section-desc">
            We don't teach passive theory. We build high-conviction, enterprise-ready professionals through deliberate practice and elite corporate networks.
          </p>
        </div>

        <div 
          style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', 
            gap: '32px' 
          }}
        >
          {features.map((item, i) => {
            const Icon = item.icon;
            return (
              <div
                key={i}
                style={{
                  background: '#F8FAFC',
                  border: '1px solid rgba(10, 21, 48, 0.06)',
                  borderRadius: '20px',
                  padding: '32px',
                  transition: 'all 0.3s ease'
                }}
                className="feature-card"
              >
                <div 
                  style={{ 
                    width: '48px', 
                    height: '48px', 
                    borderRadius: '12px', 
                    background: '#E8ECFF', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    color: '#0E2EC9',
                    marginBottom: '20px'
                  }}
                >
                  <Icon size={24} />
                </div>
                <h3 style={{ fontSize: '19px', fontWeight: 700, color: '#02050E', marginBottom: '10px' }}>
                  {item.title}
                </h3>
                <p style={{ color: '#474F66', fontSize: '14px', lineHeight: '1.6' }}>
                  {item.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>

    </section>
  );
}
