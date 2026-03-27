import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";

interface CustomerAuthContextValue {
  session: Session | null;
  user: User | null;
  customer: any;
  loading: boolean;
  customerLoading: boolean;
  authReady: boolean;
  signUp: (email: string, password: string, name: string, storeUserId: string) => Promise<any>;
  signIn: (email: string, password: string, storeUserId: string) => Promise<any>;
  signOut: () => Promise<void>;
  updateProfile: (updates: {
    name?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    cep?: string;
    cpf?: string;
  }) => Promise<any>;
  resetPassword: (email: string) => Promise<void>;
  getOrders: (storeUserId: string) => Promise<any[]>;
  refreshProfile: () => Promise<any>;
}

const CustomerAuthContext = createContext<CustomerAuthContextValue | null>(null);

function useCustomerAuthState(): CustomerAuthContextValue {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [customerLoading, setCustomerLoading] = useState(false);

  const loadCustomerProfile = useCallback(async (userId: string) => {
    setCustomerLoading(true);
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("auth_user_id", userId)
      .maybeSingle();

    if (error) throw error;

    setCustomer(data);
    setCustomerLoading(false);
    return data;
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load customer profile when user changes
  useEffect(() => {
    if (!user) {
      setCustomer(null);
      setCustomerLoading(false);
      return;
    }
    loadCustomerProfile(user.id).catch(() => {
      setCustomer(null);
      setCustomerLoading(false);
    });
  }, [loadCustomerProfile, user]);

  const signUp = async (email: string, password: string, name: string, storeUserId: string) => {
    // Check if email already exists as a customer for this store
    const { data: existingCustomer } = await supabase
      .from("customers")
      .select("id")
      .eq("email", email.toLowerCase().trim())
      .eq("store_user_id", storeUserId)
      .maybeSingle();
    if (existingCustomer) {
      throw new Error("Este e-mail já está cadastrado nesta loja. Faça login.");
    }

    // Try to sign up - if user already exists in auth, this will fail
    const { data, error } = await supabase.auth.signUp({
      email: email.toLowerCase().trim(),
      password,
      options: {
        data: { display_name: name, is_customer: true },
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      // If user already exists in auth system (from another store), try to sign in instead
      if (error.message.includes("already registered") || error.message.includes("User already registered")) {
        // Sign in with their credentials to get their user ID
        const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
          email: email.toLowerCase().trim(),
          password,
        });
        if (signInErr) {
          throw new Error("Este e-mail já possui conta. Use a senha correta para vincular a esta loja.");
        }
        // Create customer record for this store
        if (signInData.user) {
          const { error: customerErr } = await supabase.from("customers").insert({
            auth_user_id: signInData.user.id,
            store_user_id: storeUserId,
            name,
            email: email.toLowerCase().trim(),
          } as any);
          if (customerErr && !customerErr.message.includes("duplicate")) throw customerErr;
        }
        return signInData;
      }
      throw error;
    }

    // If signup returned a user with fake_signup (user exists but no error), handle it
    if (data.user && !data.session) {
      // Email confirmation required - create customer record via edge function later
      // For now, just inform the user
      throw new Error("Verifique seu e-mail para confirmar o cadastro antes de fazer login.");
    }

    if (data.user) {
      const { error: customerErr } = await supabase.from("customers").insert({
        auth_user_id: data.user.id,
        store_user_id: storeUserId,
        name,
        email: email.toLowerCase().trim(),
      } as any);
      if (customerErr && !customerErr.message.includes("duplicate")) throw customerErr;
    }

    return data;
  };

  const signIn = async (email: string, password: string, storeUserId: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password,
    });
    if (error) {
      if (error.message.includes("Invalid login") || error.message.includes("invalid_credentials")) {
        throw new Error("E-mail ou senha inválidos. Verifique seus dados ou crie uma conta.");
      }
      if (error.message.includes("Email not confirmed")) {
        throw new Error("Confirme seu e-mail antes de fazer login. Verifique sua caixa de entrada.");
      }
      throw error;
    }

    // Verify this user is a customer of THIS specific store
    const { data: customerRecord } = await supabase
      .from("customers")
      .select("id, name, email")
      .eq("auth_user_id", data.user.id)
      .eq("store_user_id", storeUserId)
      .maybeSingle();

    if (!customerRecord) {
      // User exists in auth but not as customer of this store
      // Auto-create customer record for this store (they proved their identity via password)
      const userName = data.user.user_metadata?.display_name || data.user.email?.split("@")[0] || "Cliente";
      const { error: insertErr } = await supabase.from("customers").insert({
        auth_user_id: data.user.id,
        store_user_id: storeUserId,
        name: userName,
        email: data.user.email || email.toLowerCase().trim(),
      } as any);

      if (insertErr) {
        // If insert fails, sign out and throw
        await supabase.auth.signOut();
        throw new Error("Erro ao vincular conta a esta loja. Tente novamente.");
      }
    }

    return data;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const updateProfile = async (updates: {
    name?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    cep?: string;
    cpf?: string;
  }) => {
    if (!user) throw new Error("Não autenticado");
    const { data, error } = await supabase
      .from("customers")
      .update({ ...updates, updated_at: new Date().toISOString() } as any)
      .eq("auth_user_id", user.id)
      .select()
      .single();
    if (error) throw error;
    setCustomer(data);
    return data;
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  };

  const getOrders = async (storeUserId: string) => {
    if (!customer) return [];
    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("user_id", storeUserId)
      .eq("customer_email", customer.email)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  };

  return useMemo(() => ({
    session,
    user,
    customer,
    loading,
    customerLoading,
    authReady: !loading,
    signUp,
    signIn,
    signOut,
    updateProfile,
    resetPassword,
    getOrders,
    refreshProfile: async () => {
      if (!user) return null;
      return loadCustomerProfile(user.id);
    },
  }), [session, user, customer, loading, customerLoading, loadCustomerProfile]);
}

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const value = useCustomerAuthState();

  return createElement(CustomerAuthContext.Provider, { value }, children);
}

export function useCustomerAuth() {
  const context = useContext(CustomerAuthContext);

  if (!context) {
    throw new Error("useCustomerAuth must be used within CustomerAuthProvider");
  }

  return context;
}