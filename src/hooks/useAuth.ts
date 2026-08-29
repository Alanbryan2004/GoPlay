import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';
import type { Usuario } from '../types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [dbUser, setDbUser] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        syncDbUser(session.user);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          syncDbUser(session.user);
        } else {
          setDbUser(null);
          setLoading(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const syncDbUser = async (authUser: User) => {
    try {
      const email = authUser.email || '';
      const nome = authUser.user_metadata?.nome || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Jogador';
      const foto = authUser.user_metadata?.avatar_url || '';

      // Upsert to user table in public schema
      const { data, error } = await supabase
        .from('usuarios')
        .upsert(
          {
            email,
            nome,
            foto,
          },
          { onConflict: 'email' }
        )
        .select()
        .single();

      if (!error && data) {
        setDbUser(data as Usuario);
      } else {
        console.error('Error syncing user to database:', error);
      }
    } catch (e) {
      console.error('Failed to sync auth user to public table:', e);
    } finally {
      setLoading(false);
    }
  };

  return { user, dbUser, loading };
}
