import React from 'react';
import Link from 'next/link';
import { Mail, Phone, MapPin, Linkedin, Instagram, Youtube, ArrowUpRight } from 'lucide-react';

export default function Footer() {
  return (
    <footer style={{ background: '#02050E', color: '#FFFFFF', paddingTop: '80px', paddingBottom: '40px' }}>
      <div className="wrap">
        <div 
          style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
            gap: '48px', 
            marginBottom: '64px' 
          }}
        >
          {/* Brand Info */}
          <div style={{ maxWidth: '340px' }}>
            <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
              <img src="/icon.png" alt="Kompetenzen Logo" style={{ height: '36px', filter: 'brightness(0) invert(1)' }} />
              <span style={{ fontSize: '22px', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
                Kompetenzen<span style={{ color: '#1947FF' }}>.</span>
              </span>
            </Link>
            <p style={{ color: '#94A3B8', fontSize: '14px', lineHeight: '1.7', marginBottom: '24px' }}>
              Kerala's #1 outcome-driven career consulting and skill development academy. Bridging the gap between academic education and global corporate careers.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <a 
                href="https://linkedin.com" 
                target="_blank" 
                rel="noreferrer"
                style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', transition: 'background 0.2s' }}
                aria-label="LinkedIn"
              >
                <Linkedin size={18} />
              </a>
              <a 
                href="https://instagram.com" 
                target="_blank" 
                rel="noreferrer"
                style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', transition: 'background 0.2s' }}
                aria-label="Instagram"
              >
                <Instagram size={18} />
              </a>
              <a 
                href="https://youtube.com" 
                target="_blank" 
                rel="noreferrer"
                style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', transition: 'background 0.2s' }}
                aria-label="YouTube"
              >
                <Youtube size={18} />
              </a>
            </div>
          </div>

          {/* Schools */}
          <div>
            <h4 style={{ color: '#FFFFFF', fontSize: '15px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '20px' }}>
              Our Schools
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <li>
                <Link href="/tech-school" style={{ color: '#94A3B8', fontSize: '14px', transition: 'color 0.2s' }}>
                  Tech School
                </Link>
              </li>
              <li>
                <Link href="/b-school" style={{ color: '#94A3B8', fontSize: '14px', transition: 'color 0.2s' }}>
                  B-School
                </Link>
              </li>
              <li>
                <Link href="/finishing-school" style={{ color: '#94A3B8', fontSize: '14px', transition: 'color 0.2s' }}>
                  Finishing School
                </Link>
              </li>
              <li>
                <Link href="/career-consulting" style={{ color: '#94A3B8', fontSize: '14px', transition: 'color 0.2s' }}>
                  1-on-1 Career Consulting
                </Link>
              </li>
            </ul>
          </div>

          {/* Programs */}
          <div>
            <h4 style={{ color: '#FFFFFF', fontSize: '15px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '20px' }}>
              Top Certifications
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <li>
                <Link href="/courses/data-analytics" style={{ color: '#94A3B8', fontSize: '14px' }}>
                  Data Analytics + GenAI
                </Link>
              </li>
              <li>
                <Link href="/courses/python-ai" style={{ color: '#94A3B8', fontSize: '14px' }}>
                  Full Stack Python + AI
                </Link>
              </li>
              <li>
                <Link href="/courses/java-ai" style={{ color: '#94A3B8', fontSize: '14px' }}>
                  Full Stack Java + AI
                </Link>
              </li>
              <li>
                <Link href="/courses/hr-operations" style={{ color: '#94A3B8', fontSize: '14px' }}>
                  PG Diploma in HR & Ops
                </Link>
              </li>
              <li>
                <Link href="/courses/sales-engineering" style={{ color: '#94A3B8', fontSize: '14px' }}>
                  Sales Engineering
                </Link>
              </li>
            </ul>
          </div>

          {/* Quick Access */}
          <div>
            <h4 style={{ color: '#FFFFFF', fontSize: '15px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '20px' }}>
              Resources & Connect
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <li>
                <Link href="/jobs" style={{ color: '#94A3B8', fontSize: '14px' }}>
                  Job Portal & Vacancies
                </Link>
              </li>
              <li>
                <Link href="/placements" style={{ color: '#94A3B8', fontSize: '14px' }}>
                  Placements Wall of Fame
                </Link>
              </li>
              <li>
                <Link href="/talent-hunt" style={{ color: '#94A3B8', fontSize: '14px' }}>
                  Talent Hunt 2026
                </Link>
              </li>
              <li>
                <Link href="/our-story" style={{ color: '#94A3B8', fontSize: '14px' }}>
                  Our Mission & Story
                </Link>
              </li>
              <li>
                <Link href="/admin" style={{ color: '#64748B', fontSize: '13px' }}>
                  Internal Portal
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Details */}
          <div>
            <h4 style={{ color: '#FFFFFF', fontSize: '15px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '20px' }}>
              Kochi Campus
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', color: '#94A3B8', fontSize: '14px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <MapPin size={18} color="#1947FF" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>Kompetenzen Campus, Infopark Expressway, Kakkanad, Kochi, Kerala 682030</span>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <Phone size={18} color="#1947FF" style={{ flexShrink: 0 }} />
                <span>+91 94000 00000</span>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <Mail size={18} color="#1947FF" style={{ flexShrink: 0 }} />
                <span>admissions@kompetenzen.in</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div 
          style={{ 
            borderTop: '1px solid rgba(255, 255, 255, 0.1)', 
            paddingTop: '32px', 
            display: 'flex', 
            flexWrap: 'wrap', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            gap: '16px',
            fontSize: '13px',
            color: '#64748B'
          }}
        >
          <div>
            © {new Date().getFullYear()} Kompetenzen Skill Development Academy. All rights reserved.
          </div>
          <div style={{ display: 'flex', gap: '20px' }}>
            <a href="#" style={{ color: '#94A3B8' }}>Privacy Policy</a>
            <a href="#" style={{ color: '#94A3B8' }}>Terms of Service</a>
            <a href="#" style={{ color: '#94A3B8' }}>Refund Policy</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
