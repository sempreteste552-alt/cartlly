import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";
import { getPasswordRecoveryErrorMessage, getPasswordResetRedirectUrl } from "@/lib/authRedirect";

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
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        if (event === "SIGNED_IN" && session?.user) {
          const u = session.user;

          // Handle OAuth callback for store customers
          const authContextStr = localStorage.getItem("auth_context");
          if (authContextStr) {
            try {
              const authContext = JSON.parse(authContextStr);
              if (authContext.type === "store_customer" && authContext.store_user_id) {
                localStorage.removeItem("auth_context");
                const storeUserId = authContext.store_user_id;

                if (!u.user_metadata?.is_customer) {
                  await supabase.auth.updateUser({
                    data: { is_customer: true, store_customer_signup: true },
                  });
                }

                const { data: existing } = await supabase
                  .from("customers")
                  .select("id")
                  .eq("auth_user_id", u.id)
                  .eq("store_user_id", storeUserId)
                  .maybeSingle();

                if (!existing) {
                  await supabase.from("customers").insert({
                    auth_user_id: u.id,
                    store_user_id: storeUserId,
                    name: u.user_metadata?.display_name || u.user_metadata?.full_name || u.email?.split("@")[0] || "Cliente",
                    email: u.email || "",
                  } as any);
                  await generateWelcomeCoupon(storeUserId, u.user_metadata?.display_name || u.user_metadata?.full_name || "Cliente");
                }

                await supabase.from("profiles").delete().eq("user_id", u.id);
              }
            } catch { /* ignore parse errors */ }
          }

          // Handle email confirmation redirect — auto-create customer record if pending
          const pendingStr = localStorage.getItem("pending_customer_signup");
          if (pendingStr) {
            try {
              const pending = JSON.parse(pendingStr);
              if (pending.auth_user_id === u.id && pending.store_user_id) {
                localStorage.removeItem("pending_customer_signup");

                // Ensure is_customer metadata is set
                if (!u.user_metadata?.is_customer) {
                  await supabase.auth.updateUser({ data: { is_customer: true } });
                }

                const { data: existing } = await supabase
                  .from("customers")
                  .select("id")
                  .eq("auth_user_id", u.id)
                  .eq("store_user_id", pending.store_user_id)
                  .maybeSingle();

                if (!existing) {
                  await supabase.from("customers").insert({
                    auth_user_id: u.id,
                    store_user_id: pending.store_user_id,
                    name: pending.name || u.user_metadata?.display_name || u.email?.split("@")[0] || "Cliente",
                    email: u.email || "",
                  } as any);
                  await generateWelcomeCoupon(pending.store_user_id, pending.name || "Cliente");
                }

                // Reload customer profile
                loadCustomerProfile(u.id).catch(() => {});
              }
            } catch { /* ignore */ }
          }
        }
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
    // Always try to load profile — metadata might not be set yet
    loadCustomerProfile(user.id).catch(() => {
      setCustomer(null);
      setCustomerLoading(false);
    });
  }, [loadCustomerProfile, user?.id]);

  const normalizeEmail = (email: string) => email.toLowerCase().trim();

  const generateWelcomeCoupon = async (storeUserId: string, customerName: string) => {
    try {
      const { data: storeSettings } = await supabase
        .from("store_settings")
        .select("welcome_coupon_enabled, welcome_coupon_discount_type, welcome_coupon_discount_value, welcome_coupon_min_order, welcome_coupon_expires_days")
        .eq("user_id", storeUserId)
        .maybeSingle();

      if (!storeSettings?.welcome_coupon_enabled) return;

      const code = `BV-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (storeSettings.welcome_coupon_expires_days || 30));

      await supabase.from("coupons").insert({
        user_id: storeUserId,
        code,
        discount_type: storeSettings.welcome_coupon_discount_type || "percentage",
        discount_value: storeSettings.welcome_coupon_discount_value || 10,
        min_order_value: storeSettings.welcome_coupon_min_order || 0,
        max_uses: 1,
        expires_at: expiresAt.toISOString(),
        active: true,
      });

      await supabase.from("admin_notifications").insert({
        sender_user_id: storeUserId,
        target_user_id: storeUserId,
        title: "🎁 Cupom de Boas-Vindas Gerado",
        message: `Cupom ${code} criado para novo cliente ${customerName}`,
        type: "welcome_coupon",
      });
    } catch (err) {
      console.error("Erro ao gerar cupom de boas-vindas:", err);
    }
  };

  const signUp = async (email: string, password: string, name: string, storeUserId: string) => {
    const normalizedEmail = normalizeEmail(email);

    // Only check if email exists in THIS store (not globally)
    const { data: existingCustomer } = await supabase
      .from("customers")
      .select("id")
      .eq("email", normalizedEmail)
      .eq("store_user_id", storeUserId)
      .maybeSingle();

    if (existingCustomer) {
      throw new Error("Este e-mail já está cadastrado nesta loja. Faça login.");
    }

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: { display_name: name, is_customer: true },
        emailRedirectTo: window.location.href,
      },
    });

    if (error) {
      if (error.message.includes("already registered") || error.message.includes("User already registered")) {
        // User exists in auth but not in this store — tell them to login instead
        // (signIn will auto-create the customer record for this store)
        throw new Error("Este e-mail já possui conta. Faça login para acessar esta loja.");
      }
      throw error;
    }

    // Supabase returns user with empty identities for existing emails
    if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
      throw new Error("Este e-mail já possui conta. Faça login para acessar esta loja.");
    }

    if (data.user && !data.session) {
      // Email confirmation required — save pending info so SIGNED_IN handler can create customer record
      localStorage.setItem("pending_customer_signup", JSON.stringify({
        auth_user_id: data.user.id,
        store_user_id: storeUserId,
        name,
        email: normalizedEmail,
      }));
      throw new Error("Verifique seu e-mail para confirmar o cadastro antes de fazer login.");
    }

    if (data.user) {
      const { error: customerErr } = await supabase.from("customers").insert({
        auth_user_id: data.user.id,
        store_user_id: storeUserId,
        name,
        email: normalizedEmail,
      } as any);

      if (customerErr && !customerErr.message.includes("duplicate")) throw customerErr;
      await generateWelcomeCoupon(storeUserId, name);
    }

    return data;
  };

  const signIn = async (email: string, password: string, storeUserId: string) => {
    const normalizedEmail = normalizeEmail(email);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
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

    // --- From here on, user IS authenticated. Never throw. ---

    // Ensure is_customer metadata is set (non-critical)
    try {
      if (!data.user.user_metadata?.is_customer) {
        await supabase.auth.updateUser({ data: { is_customer: true } });
      }
    } catch (e) {
      console.warn("Failed to set is_customer metadata:", e);
    }

    // Clear any pending signup data
    localStorage.removeItem("pending_customer_signup");

    // Check if customer record exists for this store; create if missing (non-critical)
    try {
      const { data: customerRecord } = await supabase
        .from("customers")
        .select("id, name, email")
        .eq("auth_user_id", data.user.id)
        .eq("store_user_id", storeUserId)
        .maybeSingle();

      if (!customerRecord) {
        await supabase.from("customers").insert({
          auth_user_id: data.user.id,
          store_user_id: storeUserId,
          name: data.user.user_metadata?.display_name || data.user.email?.split("@")[0] || "Cliente",
          email: data.user.email || "",
        } as any);
      }
    } catch (e) {
      console.warn("Failed to ensure customer record:", e);
    }

    // Force reload customer profile so UI updates immediately (non-critical)
    try {
      await loadCustomerProfile(data.user.id);
    } catch (e) {
      console.warn("Failed to load customer profile:", e);
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
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: getPasswordResetRedirectUrl(),
    });
    if (error) throw new Error(getPasswordRecoveryErrorMessage(error));
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