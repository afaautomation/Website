'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Film, ArrowLeft, Plus, Trash2, Eye, ExternalLink } from 'lucide-react';

const initialReels = [
  { id: 1, title: "From Zero Coding to Cognizant Offer", student: "Aamina A.A", views: "14.2K", link: "https://instagram.com" },
  { id: 2, title: "How I Cracked TCS NQT in 60 Days", student: "Adithyanath", views: "28.5K", link: "https://instagram.com" },
  { id: 3, title: "Non-Tech to Data Analyst at Sioniq", student: "Aswin", views: "19.8K", link: "https://instagram.com" },
  { id: 4, title: "Campus Life & Tech Labs at Kochi", student: "Kompetenzen Team", views: "35.1K", link: "https://instagram.com" }
];

export default function AdminReelsPage() {
  const [reels, setReels] = useState(initialReels);
  const [newTitle, setNewTitle] = useState('');
  const [newStudent, setNewStudent] = useState('');
  const [newLink, setNewLink] = useState('');

  const handleAdd = (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setReels([
      { id: Date.now(), title: newTitle, student: newStudent || 'Alumni', views: '0', link: newLink || '#' },
      ...reels
    ]);
    setNewTitle('');
    setNewStudent('');
    setNewLink('');
  };

  const handleDelete = (id) => {
    setReels(reels.filter(r => r.id !== id));
  };

  return (
    <div style={{ background: '#F8FAFC', minHeight: '100vh', padding: '48px 0 96px' }}>
      <div className="wrap" style={{ maxWidth: '900px' }}>
        
        <Link href="/admin" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#64748B', fontSize: '14px', marginBottom: '28px' }}>
          <ArrowLeft size={16} /> Back to Admin Console
        </Link>

        <div style={{ marginBottom: '32px' }}>
          <span className="badge badge-blue">Media & Testimonials</span>
          <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#02050E', marginTop: '8px' }}>
            Manage Video Reels & Student Stories
          </h1>
          <p style={{ color: '#64748B', fontSize: '15px' }}>
            Add, update, or feature video reels across the homepage and testimonial carousels.
          </p>
        </div>

        {/* Add Reel Form */}
        <div style={{ background: '#FFFFFF', borderRadius: '20px', border: '1px solid #E2E8F0', padding: '28px', marginBottom: '36px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#02050E', marginBottom: '16px' }}>
            Add New Reel Link
          </h2>
          <form onSubmit={handleAdd} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
            <input
              type="text"
              placeholder="Reel Title / Story headline"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '14px', outline: 'none' }}
            />
            <input
              type="text"
              placeholder="Student Name"
              value={newStudent}
              onChange={(e) => setNewStudent(e.target.value)}
              style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '14px', outline: 'none' }}
            />
            <input
              type="url"
              placeholder="Instagram Reel or Video URL"
              value={newLink}
              onChange={(e) => setNewLink(e.target.value)}
              style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '14px', outline: 'none' }}
            />
            <button type="submit" className="btn-primary" style={{ padding: '10px 20px', borderRadius: '10px', fontSize: '14px', justifyContent: 'center' }}>
              <Plus size={16} /> Add Reel
            </button>
          </form>
        </div>

        {/* Existing Reels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {reels.map((reel) => (
            <div 
              key={reel.id}
              style={{
                background: '#FFFFFF',
                borderRadius: '14px',
                border: '1px solid #E2E8F0',
                padding: '18px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#F1F5F9', color: '#0E2EC9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Film size={20} />
                </div>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#02050E' }}>{reel.title}</div>
                  <div style={{ fontSize: '13px', color: '#64748B' }}>{reel.student} • {reel.views} views</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <a 
                  href={reel.link} 
                  target="_blank" 
                  rel="noreferrer" 
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#0E2EC9', fontWeight: 600 }}
                >
                  <Eye size={14} /> Preview <ExternalLink size={12} />
                </a>
                <button
                  onClick={() => handleDelete(reel.id)}
                  style={{ color: '#EF4444', padding: '6px', cursor: 'pointer' }}
                  title="Remove reel"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
