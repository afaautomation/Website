'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { KOMPETENZEN_API_BASE, kompetenzenAuthHeaders } from '@/lib/supabaseClient';
import { X, ShieldCheck, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function PaymentModal() {
  const { isPaymentModalOpen, paymentData, closePaymentModal, openAuthModal, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);

  if (!isPaymentModalOpen || !paymentData) return null;

  const { title = "Program Enrollment", amount = 15000, courseSlug = "" } = paymentData;

  const handleCheckout = async () => {
    if (!user) {
      closePaymentModal();
      openAuthModal('login');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const headers = await kompetenzenAuthHeaders();
      const res = await fetch(`${KOMPETENZEN_API_BASE}/payments/create-order`, {
        method: 'POST',
        headers: headers || { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amount,
          course: courseSlug,
          title: title
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Payment initialization failed');
      }

      const orderData = await res.json();
      
      // Load Razorpay script if needed
      if (!window.Razorpay) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload = resolve;
          script.onerror = reject;
          document.body.appendChild(script);
        });
      }

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency || "INR",
        name: "Kompetenzen",
        description: title,
        image: "/icon.png",
        order_id: orderData.orderId,
        handler: async function (response) {
          try {
            const verifyRes = await fetch(`${KOMPETENZEN_API_BASE}/payments/verify`, {
              method: 'POST',
              headers: headers || { 'Content-Type': 'application/json' },
              body: JSON.stringify(response)
            });
            if (verifyRes.ok) {
              setSuccess(true);
            } else {
              setErrorMsg('Payment verification failed. Please contact support.');
            }
          } catch (e) {
            setErrorMsg('Network error verifying payment.');
          }
        },
        prefill: {
          name: user.name,
          email: user.email,
          contact: user.phone
        },
        theme: {
          color: "#0E2EC9"
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      setErrorMsg(err.message || "Failed to start payment checkout.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(2, 5, 14, 0.7)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={(e) => { if (e.target === e.currentTarget) closePaymentModal(); }}
    >
      <div 
        style={{
          background: '#FFFFFF',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '480px',
          padding: '36px',
          position: 'relative',
          boxShadow: '0 25px 50px -12px rgba(2, 5, 14, 0.25)'
        }}
      >
        <button
          onClick={closePaymentModal}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: '#F1F5F9',
            border: 'none',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#64748B'
          }}
        >
          <X size={18} />
        </button>

        {success ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <CheckCircle2 size={64} color="#10B981" style={{ margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#02050E', marginBottom: '8px' }}>
              Enrollment Confirmed!
            </h2>
            <p style={{ color: '#64748B', fontSize: '15px', marginBottom: '24px' }}>
              Welcome to Kompetenzen! Your receipt and onboarding details have been sent to your email.
            </p>
            <button
              onClick={closePaymentModal}
              className="btn-primary"
              style={{ width: '100%' }}
            >
              Go to Dashboard
            </button>
          </div>
        ) : (
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <span className="badge badge-blue">Secure Checkout</span>
            </div>

            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#02050E', marginBottom: '6px' }}>
              {title}
            </h2>
            <p style={{ fontSize: '14px', color: '#64748B', marginBottom: '24px' }}>
              Lock in your seat and receive lifetime LMS access, placement guidance, and mentorship.
            </p>

            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '20px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ color: '#64748B', fontSize: '14px' }}>Program Tuition</span>
                <span style={{ fontWeight: 700, color: '#02050E' }}>₹{amount.toLocaleString('en-IN')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ color: '#64748B', fontSize: '14px' }}>Career Consulting & Referrals</span>
                <span style={{ fontWeight: 700, color: '#10B981' }}>Included (FREE)</span>
              </div>
              <div style={{ height: '1px', background: '#E2E8F0', margin: '14px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: '#02050E', fontSize: '16px' }}>Total Amount</span>
                <span style={{ fontWeight: 800, color: '#0E2EC9', fontSize: '22px' }}>₹{amount.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {errorMsg && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px', display: 'flex', gap: '8px' }}>
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              onClick={handleCheckout}
              disabled={loading}
              className="btn-primary"
              style={{ width: '100%', padding: '14px', fontSize: '16px', borderRadius: '12px' }}
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : (user ? `Pay ₹${amount.toLocaleString('en-IN')}` : 'Sign In to Proceed')}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '16px', color: '#94A3B8', fontSize: '12px' }}>
              <ShieldCheck size={16} color="#10B981" />
              <span>256-bit Encrypted SSL • Razorpay Secured • Money Back Guarantee</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
