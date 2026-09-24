import React from 'react';
import Link from 'next/link';
import HeroSection from '@/components/home/HeroSection';
import MarqueeTicker from '@/components/home/MarqueeTicker';
import SchoolCards from '@/components/home/SchoolCards';
import CourseGrid from '@/components/home/CourseGrid';
import PlacementWall from '@/components/home/PlacementWall';
import WhyUs from '@/components/home/WhyUs';
import FaqAccordion from '@/components/home/FaqAccordion';
import { ArrowRight, PhoneCall, Sparkles } from 'lucide-react';

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <MarqueeTicker />
      <SchoolCards />
      <CourseGrid />
      <PlacementWall />
      <WhyUs />
      <FaqAccordion />

      {/* Bottom CTA Banner */}
      <section 
        style={{ 
          padding: '80px 0', 
          background: 'linear-gradient(135deg, #0E2EC9 0%, #081B7E 100%)', 
          color: '#FFFFFF',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div className="wrap" style={{ position: 'relative', zIndex: 1, maxWidth: '800px' }}>
          <div 
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '8px', 
              background: 'rgba(255, 255, 255, 0.15)', 
              padding: '6px 18px', 
              borderRadius: '99px', 
              fontSize: '13px', 
              fontWeight: 700,
              marginBottom: '20px' 
            }}
          >
            <Sparkles size={16} /> Fast-Track Your Future
          </div>
          <h2 style={{ fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 800, color: '#FFFFFF', marginBottom: '16px', letterSpacing: '-0.03em' }}>
            Ready to Land Your Dream Job in 2026?
          </h2>
          <p style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: '18px', lineHeight: '1.6', marginBottom: '36px' }}>
            Book a free 30-minute career diagnostic session with our senior mentors. We review your resume, assess your skills, and map out your placement pathway.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <Link 
              href="/career-consulting" 
              className="btn-primary" 
              style={{ background: '#FFFFFF', color: '#0E2EC9', padding: '14px 32px', fontSize: '16px' }}
            >
              <span>Book Free Consultation</span>
              <ArrowRight size={18} />
            </Link>
            <Link 
              href="/courses" 
              className="btn-outline" 
              style={{ background: 'transparent', borderColor: 'rgba(255, 255, 255, 0.3)', color: '#FFFFFF', padding: '14px 28px', fontSize: '16px' }}
            >
              <span>View All Courses</span>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
