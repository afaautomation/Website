'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, supabaseGetSessionUser, supabaseSignOut } from '@/lib/supabaseClient';

const AuthContext = createContext({
  user: null,
  loading: true,
  isAuthModalOpen: false,
  authModalMode: 'login',
  openAuthModal: () => {},
  closeAuthModal: () => {},
  logout: async () => {},
  isPaymentModalOpen: false,
  paymentData: null,
  openPaymentModal: () => {},
  closePaymentModal: () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('login');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentData, setPaymentData] = useState(null);

  useEffect(() => {
    async function loadUser() {
      try {
        const currentUser = await supabaseGetSessionUser();
        setUser(currentUser);
      } catch (err) {
        console.error("Auth state fetch error:", err);
      } finally {
        setLoading(false);
      }
    }

    loadUser();

    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          const meta = session.user.user_metadata || {};
          setUser({
            id: session.user.id,
            name: meta.name || meta.full_name || session.user.email,
            email: session.user.email,
            phone: meta.phone || '',
            authType: session.user.app_metadata?.provider === 'google' ? 'Google Auth' : 'Direct Login'
          });
        } else {
          setUser(null);
        }
        setLoading(false);
      });

      return () => {
        subscription?.unsubscribe();
      };
    }
  }, []);

  const openAuthModal = (mode = 'login') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  const logout = async () => {
    await supabaseSignOut();
    setUser(null);
  };

  const openPaymentModal = (data) => {
    setPaymentData(data);
    setIsPaymentModalOpen(true);
  };

  const closePaymentModal = () => {
    setIsPaymentModalOpen(false);
    setPaymentData(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthModalOpen,
        authModalMode,
        openAuthModal,
        closeAuthModal,
        logout,
        isPaymentModalOpen,
        paymentData,
        openPaymentModal,
        closePaymentModal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
