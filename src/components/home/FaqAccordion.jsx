'use client';

import React, { useState } from 'react';
import { homeFaqs } from '@/data/faqs';
import { ChevronDown } from 'lucide-react';

export default function FaqAccordion() {
  const [openIdx, setOpenIdx] = useState(0);

  const toggle = (idx) => {
    setOpenIdx(openIdx === idx ? null : idx);
  };

  return (
    <section style={{ padding: '96px 0', background: '#F8FAFC', borderTop: '1px solid rgba(10, 21, 48, 0.06)' }}>
      <div className="wrap">
        <div className="section-header" style={{ marginBottom: '48px' }}>
          <span className="section-tag">Got Questions?</span>
          <h2 className="section-title">
            Frequently Asked Questions
          </h2>
          <p className="section-desc">
            Everything you need to know about our admissions, fee schedules, classroom training, and placement support.
          </p>
        </div>

        <div style={{ maxWidth: '820px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {homeFaqs.map((faq, i) => {
            const isOpen = openIdx === i;
            return (
              <div
                key={i}
                style={{
                  background: '#FFFFFF',
                  borderRadius: '16px',
                  border: `1px solid ${isOpen ? 'rgba(14, 46, 201, 0.25)' : 'rgba(10, 21, 48, 0.08)'}`,
                  overflow: 'hidden',
                  transition: 'all 0.2s ease',
                  boxShadow: isOpen ? '0 8px 24px rgba(2, 5, 14, 0.04)' : 'none'
                }}
              >
                <button
                  onClick={() => toggle(i)}
                  style={{
                    width: '100%',
                    padding: '20px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    textAlign: 'left',
                    gap: '16px',
                    cursor: 'pointer'
                  }}
                >
                  <span style={{ fontSize: '16px', fontWeight: 700, color: isOpen ? '#0E2EC9' : '#02050E' }}>
                    {faq.q}
                  </span>
                  <ChevronDown
                    size={20}
                    style={{
                      transform: isOpen ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.25s ease',
                      color: isOpen ? '#0E2EC9' : '#94A3B8',
                      flexShrink: 0
                    }}
                  />
                </button>

                {isOpen && (
                  <div
                    style={{
                      padding: '0 24px 22px',
                      color: '#474F66',
                      fontSize: '15px',
                      lineHeight: '1.7',
                      animation: 'fadeIn 0.25s ease'
                    }}
                  >
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
