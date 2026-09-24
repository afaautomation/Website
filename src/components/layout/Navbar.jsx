'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { 
  Menu, X, ChevronDown, User, LogOut, Briefcase, GraduationCap, 
  Sparkles, Award, Compass, BookOpen, Trophy 
} from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const { user, openAuthModal, logout } = useAuth();
  
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [schoolsOpen, setSchoolsOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close menus on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setSchoolsOpen(false);
    setUserDropdownOpen(false);
  }, [pathname]);

  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        height: '72px',
        background: scrolled ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'saturate(140%) blur(16px)',
        WebkitBackdropFilter: 'saturate(140%) blur(16px)',
        borderBottom: `1px solid ${scrolled ? 'rgba(10, 21, 48, 0.1)' : 'rgba(10, 21, 48, 0.05)'}`,
        transition: 'all 0.3s ease'
      }}
    >
      <div
        className="wrap"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '100%'
        }}
      >
        {/* Brand */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img
            src="/icon.png"
            alt="Kompetenzen"
            style={{ height: '36px', width: 'auto' }}
          />
          <span style={{ fontWeight: 800, fontSize: '20px', letterSpacing: '-0.03em', color: '#02050E' }}>
            Kompetenzen<span style={{ color: '#0E2EC9' }}>.</span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav
          style={{
            display: 'none',
            alignItems: 'center',
            gap: '28px',
          }}
          className="desktop-nav"
        >
          <Link
            href="/career-consulting"
            style={{
              fontSize: '14px',
              fontWeight: pathname === '/career-consulting' ? 700 : 500,
              color: pathname === '/career-consulting' ? '#0E2EC9' : '#02050E',
              transition: 'color 0.2s'
            }}
          >
            Consulting
          </Link>

          {/* Schools Dropdown */}
          <div
            style={{ position: 'relative' }}
            onMouseEnter={() => setSchoolsOpen(true)}
            onMouseLeave={() => setSchoolsOpen(false)}
          >
            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '14px',
                fontWeight: pathname.includes('school') ? 700 : 500,
                color: pathname.includes('school') ? '#0E2EC9' : '#02050E',
                cursor: 'pointer'
              }}
            >
              Schools <ChevronDown size={14} style={{ transform: schoolsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>

            {schoolsOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: '-20px',
                  width: '280px',
                  background: '#FFFFFF',
                  borderRadius: '16px',
                  padding: '12px',
                  boxShadow: '0 16px 36px rgba(2, 5, 14, 0.12)',
                  border: '1px solid rgba(10, 21, 48, 0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  animation: 'fadeIn 0.2s ease'
                }}
              >
                <Link
                  href="/tech-school"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    color: '#02050E',
                    fontSize: '14px',
                    fontWeight: 600,
                    transition: 'background 0.2s'
                  }}
                  className="dropdown-item"
                >
                  <div style={{ background: '#E8ECFF', padding: '8px', borderRadius: '8px', color: '#0E2EC9' }}>
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <div>Tech School</div>
                    <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 400 }}>AI, Full Stack, Data Science</div>
                  </div>
                </Link>

                <Link
                  href="/b-school"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    color: '#02050E',
                    fontSize: '14px',
                    fontWeight: 600,
                    transition: 'background 0.2s'
                  }}
                  className="dropdown-item"
                >
                  <div style={{ background: '#FEF3C7', padding: '8px', borderRadius: '8px', color: '#D97706' }}>
                    <Briefcase size={16} />
                  </div>
                  <div>
                    <div>B-School</div>
                    <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 400 }}>HR Management, Sales Eng.</div>
                  </div>
                </Link>

                <Link
                  href="/finishing-school"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    color: '#02050E',
                    fontSize: '14px',
                    fontWeight: 600,
                    transition: 'background 0.2s'
                  }}
                  className="dropdown-item"
                >
                  <div style={{ background: '#ECFDF5', padding: '8px', borderRadius: '8px', color: '#059669' }}>
                    <GraduationCap size={16} />
                  </div>
                  <div>
                    <div>Finishing School</div>
                    <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 400 }}>Executive Presence & Readiness</div>
                  </div>
                </Link>
              </div>
            )}
          </div>

          <Link
            href="/courses"
            style={{
              fontSize: '14px',
              fontWeight: pathname.startsWith('/courses') ? 700 : 500,
              color: pathname.startsWith('/courses') ? '#0E2EC9' : '#02050E'
            }}
          >
            Programs
          </Link>

          <Link
            href="/jobs"
            style={{
              fontSize: '14px',
              fontWeight: pathname.startsWith('/jobs') ? 700 : 500,
              color: pathname.startsWith('/jobs') ? '#0E2EC9' : '#02050E'
            }}
          >
            Job Portal
          </Link>

          <Link
            href="/placements"
            style={{
              fontSize: '14px',
              fontWeight: pathname === '/placements' ? 700 : 500,
              color: pathname === '/placements' ? '#0E2EC9' : '#02050E'
            }}
          >
            Placements
          </Link>

          <Link
            href="/our-story"
            style={{
              fontSize: '14px',
              fontWeight: pathname === '/our-story' ? 700 : 500,
              color: pathname === '/our-story' ? '#0E2EC9' : '#02050E'
            }}
          >
            Our Story
          </Link>
        </nav>

        {/* Right CTA / Auth Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {user ? (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#F1F5F9',
                  padding: '8px 14px',
                  borderRadius: '99px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#02050E'
                }}
              >
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#0E2EC9', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px' }}>
                  {user.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <span>{user.name?.split(' ')[0] || 'Account'}</span>
                <ChevronDown size={14} />
              </button>

              {userDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '115%',
                    right: 0,
                    width: '200px',
                    background: '#FFFFFF',
                    borderRadius: '14px',
                    padding: '8px',
                    boxShadow: '0 10px 25px rgba(2, 5, 14, 0.1)',
                    border: '1px solid rgba(10, 21, 48, 0.08)',
                    zIndex: 100
                  }}
                >
                  <div style={{ padding: '8px 12px', borderBottom: '1px solid #F1F5F9' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#02050E' }}>{user.name}</div>
                    <div style={{ fontSize: '11px', color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</div>
                  </div>
                  <Link
                    href="/create-profile"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 12px',
                      fontSize: '13px',
                      color: '#02050E',
                      borderRadius: '8px'
                    }}
                  >
                    <User size={14} /> My Profile
                  </Link>
                  <button
                    onClick={logout}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 12px',
                      fontSize: '13px',
                      color: '#EF4444',
                      borderRadius: '8px',
                      textAlign: 'left'
                    }}
                  >
                    <LogOut size={14} /> Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => openAuthModal('login')}
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: '#02050E',
                padding: '8px 16px',
                borderRadius: '99px',
                background: 'transparent'
              }}
            >
              Sign In
            </button>
          )}

          <Link href="/courses" className="btn-primary" style={{ display: 'none' }} id="nav-cta-btn">
            Explore Courses
          </Link>

          {/* Mobile Hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{
              display: 'flex',
              padding: '8px',
              borderRadius: '8px',
              color: '#02050E'
            }}
            className="mobile-toggle"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div
          style={{
            position: 'fixed',
            top: '72px',
            left: 0,
            right: 0,
            bottom: 0,
            background: '#FFFFFF',
            zIndex: 999,
            padding: '24px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            overflowY: 'auto'
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Navigation
          </div>

          <Link
            href="/career-consulting"
            style={{ fontSize: '17px', fontWeight: 600, color: '#02050E', display: 'flex', alignItems: 'center', gap: '12px' }}
          >
            <Compass size={20} color="#0E2EC9" /> Career Consulting
          </Link>

          <Link
            href="/tech-school"
            style={{ fontSize: '17px', fontWeight: 600, color: '#02050E', display: 'flex', alignItems: 'center', gap: '12px' }}
          >
            <Sparkles size={20} color="#0E2EC9" /> Tech School
          </Link>

          <Link
            href="/b-school"
            style={{ fontSize: '17px', fontWeight: 600, color: '#02050E', display: 'flex', alignItems: 'center', gap: '12px' }}
          >
            <Briefcase size={20} color="#D97706" /> B-School
          </Link>

          <Link
            href="/finishing-school"
            style={{ fontSize: '17px', fontWeight: 600, color: '#02050E', display: 'flex', alignItems: 'center', gap: '12px' }}
          >
            <GraduationCap size={20} color="#059669" /> Finishing School
          </Link>

          <Link
            href="/courses"
            style={{ fontSize: '17px', fontWeight: 600, color: '#02050E', display: 'flex', alignItems: 'center', gap: '12px' }}
          >
            <BookOpen size={20} color="#0E2EC9" /> All Courses
          </Link>

          <Link
            href="/jobs"
            style={{ fontSize: '17px', fontWeight: 600, color: '#02050E', display: 'flex', alignItems: 'center', gap: '12px' }}
          >
            <Briefcase size={20} color="#6366F1" /> Job Portal
          </Link>

          <Link
            href="/placements"
            style={{ fontSize: '17px', fontWeight: 600, color: '#02050E', display: 'flex', alignItems: 'center', gap: '12px' }}
          >
            <Award size={20} color="#F59E0B" /> Wall of Fame (Placements)
          </Link>

          <Link
            href="/talent-hunt"
            style={{ fontSize: '17px', fontWeight: 600, color: '#02050E', display: 'flex', alignItems: 'center', gap: '12px' }}
          >
            <Trophy size={20} color="#EC4899" /> Talent Hunt 2026
          </Link>

          <Link
            href="/our-story"
            style={{ fontSize: '17px', fontWeight: 600, color: '#02050E', display: 'flex', alignItems: 'center', gap: '12px' }}
          >
            <Sparkles size={20} color="#14B8A6" /> Our Story
          </Link>

          <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {!user ? (
              <button
                onClick={() => { setMobileMenuOpen(false); openAuthModal('login'); }}
                className="btn-outline"
                style={{ width: '100%' }}
              >
                Sign In
              </button>
            ) : (
              <button
                onClick={logout}
                className="btn-outline"
                style={{ width: '100%', color: '#EF4444' }}
              >
                Sign Out ({user.name})
              </button>
            )}
            <Link
              href="/courses"
              className="btn-primary"
              style={{ width: '100%', textAlign: 'center' }}
            >
              Explore Courses
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
