import { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Send, Check, CheckCheck, MessageSquare, ArrowLeft, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format, isToday, isYesterday } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import cartlyLogo from "@/assets/cartly-logo.webp";

const NOTIFICATION_SOUND = "/sounds/notification.mp3";
const LOCAL_TYPING_IDLE_MS = 1200;
const REMOTE_TYPING_STALE_MS = 2000;
const TYPING_THROTTLE_MS = 900;

const playNotificationSound = () => {
  try {
    const audio = new Audio(NOTIFICATION_SOUND);
    audio.volume = 0.6;
    audio.play().catch(() => {});
  } catch (err) {
    console.error("Error playing sound:", err);
  }
};

type Message = {
  id: string;
  conversation_id: string;
  sender_type: "customer" | "admin";
  sender_id: string;
  body: string;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
};

type Conversation = {
  id: string;
  tenant_id: string;
  session_id: string;
  customer_id: string | null;
  is_active: boolean;
  is_typing_customer: boolean;
  is_typing_admin: boolean;
  last_message_at: string;
  created_at: string;
  updated_at: string | null;
  last_message?: string;
  unread_count?: number;
  customer?: {
    name: string | null;
    email: string | null;
    phone: string | null;
    auth_user_id?: string | null;
  };
};

function formatConversationDate(dateStr?: string | null) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isToday(date)) return format(date, "HH:mm");
  if (isYesterday(date)) return "Ontem";
  return format(date, "dd/MM/yy");
}

function getConversationPresenceAt(
  conversation?: Pick<Conversation, "updated_at" | "last_message_at" | "created_at"> | null
) {
  return conversation?.updated_at || conversation?.last_message_at || conversation?.created_at || null;
}

function isConversationOnline(
  conversation?: Pick<Conversation, "updated_at" | "last_message_at" | "created_at" | "is_typing_customer"> | null
) {
  if (conversation?.is_typing_customer) return true;
  const presenceAt = getConversationPresenceAt(conversation);
  if (!presenceAt) return false;
  return Date.now() - new Date(presenceAt).getTime() < 2 * 60 * 1000;
}

function formatCustomerPresence(
  conversation?: Pick<Conversation, "updated_at" | "last_message_at" | "created_at" | "is_typing_customer"> | null
) {
  if (!conversation) return "Offline";
  if (conversation.is_typing_customer) return "digitando...";
  if (isConversationOnline(conversation)) return "Online";

  const presenceAt = getConversationPresenceAt(conversation);
  if (!presenceAt) return "Offline";

  const diffMin = Math.max(1, Math.floor((Date.now() - new Date(presenceAt).getTime()) / 60000));
  if (diffMin < 60) return `Visto há ${diffMin} min`;

  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Visto há ${diffH} h`;

  return `Visto ${format(new Date(presenceAt), "dd/MM HH:mm")}`;
}

export default function Suporte() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [search, setSearch] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAdminTyping, setIsAdminTyping] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<"connected" | "connecting" | "offline">("connecting");
  const [displayCustomerTyping, setDisplayCustomerTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const customerTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingPushRef = useRef<number>(0);
  const customerTypingShownAtRef = useRef<number>(0);
  const customerTypingAppearTimerRef = useRef<NodeJS.Timeout | null>(null);
  const customerTypingHideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoSelectedConvRef = useRef<string | null>(null);

  const syncSelectedConversationReception = async (conversationId: string, markAsRead: boolean) => {
    const now = new Date().toISOString();

    await supabase
      .from("support_messages")
      .update({ delivered_at: now })
      .eq("conversation_id", conversationId)
      .eq("sender_type", "customer")
      .is("delivered_at", null);

    if (markAsRead) {
      await supabase
        .from("support_messages")
        .update({ read_at: now })
        .eq("conversation_id", conversationId)
        .eq("sender_type", "customer")
        .is("read_at", null);
    }

    queryClient.setQueryData(["support_messages", conversationId], (old: Message[] | undefined) =>
      (old || []).map((message) =>
        message.sender_type === "customer"
          ? {
              ...message,
              delivered_at: message.delivered_at ?? now,
              read_at: markAsRead ? message.read_at ?? now : message.read_at,
            }
          : message
      )
    );

    return now;
  };

  const { data: conversations, isLoading: loadingConvs } = useQuery({
    queryKey: ["support_conversations", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_conversations")
        .select(`
          *,
          messages:support_messages(body, created_at, sender_type, read_at)
        `)
        .eq("tenant_id", user?.id)
        .order("last_message_at", { ascending: false });

      if (error) throw error;

      const customerIds = [...new Set((data || []).map((conv: any) => conv.customer_id).filter(Boolean))];
      let customerMap = new Map<string, { name: string | null; email: string | null; phone: string | null }>();

      if (customerIds.length > 0) {
        const { data: customers, error: customersError } = await supabase
          .from("customers")
          .select("id, name, email, phone, auth_user_id")
          .in("id", customerIds);

        if (customersError) throw customersError;

        customerMap = new Map(
          (customers || []).map((customer: any) => [customer.id, {
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
            auth_user_id: customer.auth_user_id,
          }])
        );
      }
      
      return (data || []).map((conv: any) => {
        const orderedMessages = [...(conv.messages || [])].sort(
          (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        return {
          ...conv,
          customer: conv.customer_id ? customerMap.get(conv.customer_id) : undefined,
          last_message: orderedMessages[0]?.body || "Nenhuma mensagem",
          unread_count: orderedMessages.filter((m: any) => m.sender_type === "customer" && !m.read_at).length || 0
        };
      }) as Conversation[];
    },
    enabled: !!user,
  });

  const { data: messages, isLoading: loadingMsgs } = useQuery({
    queryKey: ["support_messages", selectedConversation?.id],
    queryFn: async () => {
      if (!selectedConversation) return [];

      const { data, error } = await supabase
        .from("support_messages")
        .select("*")
        .eq("conversation_id", selectedConversation.id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const now = await syncSelectedConversationReception(
        selectedConversation.id,
        document.visibilityState === "visible"
      );

      return ((data || []) as Message[]).map((message) =>
        message.sender_type === "customer"
          ? {
              ...message,
              delivered_at: message.delivered_at ?? now,
              read_at: document.visibilityState === "visible" ? message.read_at ?? now : message.read_at,
            }
          : message
      );
    },
    enabled: !!selectedConversation,
  });

  const sendMessage = useMutation({
    mutationFn: async (body: string) => {
      if (!selectedConversation || !user) return;
      
      const { data: storeSettings } = await supabase
        .from("store_settings")
        .select("store_name, store_slug")
        .eq("user_id", user.id)
        .single();

      const { data: newMsg, error } = await supabase
        .from("support_messages")
        .insert({
          conversation_id: selectedConversation.id,
          sender_type: "admin",
          sender_id: user.id,
          body,
        })
        .select("*")
        .single();

      if (error) throw error;

      const targetAuthUserId = selectedConversation.customer?.auth_user_id;
      const pushTitle = storeSettings?.store_name || "Suporte da Loja";
      const pushBody = body.length > 100 ? body.substring(0, 97) + "..." : body;
      const pushUrl = storeSettings?.store_slug ? `/loja/${storeSettings.store_slug}?chat=true` : "/";

      if (targetAuthUserId) {
        await supabase.from("tenant_messages").insert({
          source_tenant_id: user.id,
          target_user_id: targetAuthUserId,
          target_area: "public_store",
          audience_type: "tenant_admin_to_one_customer",
          title: pushTitle,
          body: pushBody,
          message_type: "info",
          status: "sent",
          channel: "in_app",
          sender_type: "tenant_admin",
          sender_user_id: user.id,
          is_global: false,
          target_tenant_id: user.id,
        });
      }

      if (targetAuthUserId) {
        try {
          await supabase.functions.invoke("send-push-internal", {
            body: {
              target_user_id: targetAuthUserId,
              title: pushTitle,
              body: pushBody,
              url: pushUrl,
              type: "tenant_message",
              store_user_id: user.id,
            }
          });
        } catch (e) {
          console.error("Push notification error:", e);
        }
      }

      return newMsg;
    },
    onMutate: async (body) => {
      if (!selectedConversation) return;

      // Reset typing status immediately on send
      setIsAdminTyping(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      supabase
        .from("support_conversations")
        .update({ is_typing_admin: false, updated_at: new Date().toISOString() })
        .eq("id", selectedConversation.id)
        .then();
      
      const optimisticMsg: Message = {
        id: `temp-${Date.now()}`,
        conversation_id: selectedConversation.id,
        sender_type: "admin",
        sender_id: user?.id || "",
        body,
        created_at: new Date().toISOString(),
        delivered_at: null,
        read_at: null
      };

      queryClient.setQueryData(["support_messages", selectedConversation.id], (old: Message[] | undefined) => {
        return [...(old || []), optimisticMsg];
      });

      return { optimisticMsg };
    },
    onSuccess: (newMsg) => {
      setNewMessage("");
      if (newMsg && selectedConversation) {
        queryClient.setQueryData(["support_messages", selectedConversation.id], (old: Message[] | undefined) => {
          return (old || []).map(m => m.id.startsWith("temp-") && m.body === newMsg.body ? newMsg : m);
        });
      }
      queryClient.invalidateQueries({ queryKey: ["support_conversations"] });
    },
  });

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`support_realtime_${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages" },
        (payload: any) => {
          const isCurrentConversationOpen = selectedConversation?.id === payload.new.conversation_id && document.visibilityState === "visible";
          const now = new Date().toISOString();

          if (payload.new.sender_type === "customer") {
            if (customerTypingTimeoutRef.current) {
              clearTimeout(customerTypingTimeoutRef.current);
              customerTypingTimeoutRef.current = null;
            }
            setSelectedConversation(prev => prev?.id === payload.new.conversation_id ? { ...prev, is_typing_customer: false } : prev);
            queryClient.setQueryData(["support_conversations", user.id], (old: Conversation[] | undefined) =>
              (old || []).map(conv => conv.id === payload.new.conversation_id ? { ...conv, is_typing_customer: false } : conv)
            );
            playNotificationSound();

            const updates: Record<string, string> = {
              delivered_at: payload.new.delivered_at || now,
            };

            if (isCurrentConversationOpen) {
              updates.read_at = payload.new.read_at || now;
            }

            supabase.from("support_messages")
              .update(updates)
              .eq("id", payload.new.id)
              .then();
          }
          
          queryClient.setQueryData(["support_messages", payload.new.conversation_id], (old: Message[] | undefined) => {
            const alreadyExists = (old || []).some(m => m.id === payload.new.id || (m.body === payload.new.body && Math.abs(new Date(m.created_at).getTime() - new Date(payload.new.created_at).getTime()) < 2000));
            if (alreadyExists) return old;
            return [...(old || []), {
              ...payload.new,
              delivered_at: payload.new.sender_type === "customer" ? (payload.new.delivered_at || now) : payload.new.delivered_at,
              read_at: payload.new.sender_type === "customer" && isCurrentConversationOpen ? (payload.new.read_at || now) : payload.new.read_at,
            }];
          });

          queryClient.invalidateQueries({ queryKey: ["support_conversations"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "support_messages" },
        (payload: any) => {
          queryClient.setQueryData(["support_messages", payload.new.conversation_id], (old: Message[] | undefined) => {
            if (!old) return old;
            return old.map(m => m.id === payload.new.id ? payload.new : m);
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_conversations" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["support_conversations"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "support_conversations" },
        (payload: any) => {
          queryClient.invalidateQueries({ queryKey: ["support_conversations"] });
          queryClient.setQueryData(["support_conversations", user.id], (old: Conversation[] | undefined) =>
            (old || []).map(conv => conv.id === payload.new.id ? { ...conv, ...payload.new } : conv)
          );
          setSelectedConversation(prev => {
            if (prev && payload.new.id === prev.id) {
              const merged = { ...prev, ...payload.new };
              // Auto-expire stale customer typing flag after 4s of no new signals
              if (payload.new.is_typing_customer) {
                if (customerTypingTimeoutRef.current) clearTimeout(customerTypingTimeoutRef.current);
                customerTypingTimeoutRef.current = setTimeout(() => {
                  setSelectedConversation(p => p ? { ...p, is_typing_customer: false } : p);
                  queryClient.setQueryData(["support_conversations", user.id], (old: Conversation[] | undefined) =>
                    (old || []).map(conv => conv.id === payload.new.id ? { ...conv, is_typing_customer: false } : conv)
                  );
                }, REMOTE_TYPING_STALE_MS);
              } else if (customerTypingTimeoutRef.current) {
                clearTimeout(customerTypingTimeoutRef.current);
                customerTypingTimeoutRef.current = null;
              }
              return merged;
            }
            return prev;
          });
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setRealtimeStatus("connected");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setRealtimeStatus("offline");
        else setRealtimeStatus("connecting");
      });

    return () => {
      if (customerTypingTimeoutRef.current) {
        clearTimeout(customerTypingTimeoutRef.current);
        customerTypingTimeoutRef.current = null;
      }
      setRealtimeStatus("connecting");
      supabase.removeChannel(channel);
    };
  }, [user, queryClient, selectedConversation?.id]);

  // Anti-flicker for remote "digitando..." indicator + offline suppression
  useEffect(() => {
    const ANTI_FLICKER_APPEAR_MS = 250;
    const MIN_VISIBLE_MS = 700;
    const rawTyping = !!selectedConversation?.is_typing_customer;

    if (customerTypingAppearTimerRef.current) {
      clearTimeout(customerTypingAppearTimerRef.current);
      customerTypingAppearTimerRef.current = null;
    }
    if (customerTypingHideTimerRef.current) {
      clearTimeout(customerTypingHideTimerRef.current);
      customerTypingHideTimerRef.current = null;
    }

    if (rawTyping && realtimeStatus === "connected") {
      if (displayCustomerTyping) return;
      customerTypingAppearTimerRef.current = setTimeout(() => {
        setDisplayCustomerTyping(true);
        customerTypingShownAtRef.current = Date.now();
      }, ANTI_FLICKER_APPEAR_MS);
    } else {
      if (!displayCustomerTyping) return;
      const elapsed = Date.now() - customerTypingShownAtRef.current;
      const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);
      customerTypingHideTimerRef.current = setTimeout(() => {
        setDisplayCustomerTyping(false);
      }, remaining);
    }

    return () => {
      if (customerTypingAppearTimerRef.current) clearTimeout(customerTypingAppearTimerRef.current);
      if (customerTypingHideTimerRef.current) clearTimeout(customerTypingHideTimerRef.current);
    };
  }, [selectedConversation?.is_typing_customer, realtimeStatus, displayCustomerTyping]);

  useEffect(() => {
    if (!selectedConversation) return;

    const updateTypingStatus = (typing: boolean) => {
      supabase
        .from("support_conversations")
        .update({ is_typing_admin: typing, updated_at: new Date().toISOString() })
        .eq("id", selectedConversation.id)
        .then();
    };

    const hasText = newMessage.trim().length > 0;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    if (!hasText) {
      if (isAdminTyping) {
        setIsAdminTyping(false);
        updateTypingStatus(false);
        lastTypingPushRef.current = 0;
      }
      return;
    }

    const now = Date.now();
    if (!isAdminTyping || now - lastTypingPushRef.current > TYPING_THROTTLE_MS) {
      setIsAdminTyping(true);
      updateTypingStatus(true);
      lastTypingPushRef.current = now;
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsAdminTyping(false);
      updateTypingStatus(false);
      lastTypingPushRef.current = 0;
    }, LOCAL_TYPING_IDLE_MS);
  }, [newMessage, selectedConversation, isAdminTyping]);

  // Clear admin typing flag when switching conversations
  useEffect(() => {
    const convId = selectedConversation?.id;
    return () => {
      if (convId) {
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        setIsAdminTyping(false);
        supabase
          .from("support_conversations")
          .update({ is_typing_admin: false })
          .eq("id", convId)
          .then();
      }
    };
  }, [selectedConversation?.id]);

  // NOTE: We intentionally do NOT bump support_conversations.updated_at from the admin side.
  // That field is used to determine whether the CUSTOMER is online (chat panel open & visible).
  // Updating it from the admin would falsely mark the customer as online whenever the admin
  // opens the conversation. Customer presence is pinged from StorefrontAIChat only while the
  // customer's chat panel is open and the tab is visible/focused.

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Auto-select conversation from URL params (e.g. ?conv=xxx)
  useEffect(() => {
    const convId = searchParams.get("conv");
    if (convId && conversations && conversations.length > 0 && autoSelectedConvRef.current !== convId) {
      const found = conversations.find(c => c.id === convId);
      if (found) {
        setSelectedConversation(found);
        autoSelectedConvRef.current = convId;
        searchParams.delete("conv");
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [searchParams, conversations, setSearchParams]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim()) {
      sendMessage.mutate(newMessage);
    }
  };

  const totalUnread = useMemo(() => {
    return conversations?.reduce((sum, c) => sum + (c.unread_count || 0), 0) || 0;
  }, [conversations]);

  const filteredConversations = conversations?.filter(c => 
    c.session_id.toLowerCase().includes(search.toLowerCase())
  );

  const showConversationList = !selectedConversation || !isMobile;
  const showChat = selectedConversation || !isMobile;

  return (
    <div className="flex h-[calc(100vh-120px)] bg-card rounded-xl border shadow-sm overflow-hidden">
      {/* Sidebar - Conversation List */}
      {showConversationList && (
        <div className={`${isMobile ? "w-full" : "w-[340px] min-w-[300px]"} border-r flex flex-col bg-background`}>
          {/* Sidebar Header */}
          <div className="px-4 pt-4 pb-3 bg-background border-b">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                💬 Suporte
                {totalUnread > 0 && (
                  <span className="bg-destructive text-white text-[10px] font-bold h-5 min-w-5 px-1.5 rounded-full flex items-center justify-center">
                    {totalUnread}
                  </span>
                )}
              </h2>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar conversa..." 
                className="pl-9 h-9 rounded-lg bg-muted/50 border-border/30 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Conversations */}
          <ScrollArea className="flex-1">
            {loadingConvs ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Carregando...</div>
            ) : filteredConversations?.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <div className="h-14 w-14 mx-auto bg-muted rounded-full flex items-center justify-center mb-3">
                  <MessageSquare className="h-7 w-7 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-medium">Nenhuma conversa</p>
                <p className="text-xs mt-1">As mensagens dos clientes aparecerão aqui.</p>
              </div>
            ) : (
              filteredConversations?.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv)}
                  className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors border-b border-border/30 text-left ${selectedConversation?.id === conv.id ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
                >
                  <div className="relative">
                    <Avatar className="h-11 w-11">
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                        {(conv.customer?.name || conv.session_id).slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {(() => {
                      const isOnline = isConversationOnline(conv);
                      return (
                        <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background ${isOnline ? "bg-green-400" : "bg-muted-foreground/30"}`} />
                      );
                    })()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="font-semibold text-sm text-foreground truncate">
                        {conv.customer?.name || `Visitante ${conv.session_id.slice(0, 4)}`}
                      </span>
                      <span className={`text-[10px] shrink-0 ${(conv.unread_count || 0) > 0 ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                        {formatConversationDate(conv.last_message_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      {conv.is_typing_customer ? (
                        <span className="text-xs text-green-600 font-medium animate-pulse italic">digitando...</span>
                      ) : (
                        <p className={`text-xs truncate ${(conv.unread_count || 0) > 0 ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                          {conv.last_message}
                        </p>
                      )}
                      {(conv.unread_count || 0) > 0 && (
                        <span className="h-5 min-w-5 px-1 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center shrink-0 shadow-sm">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </ScrollArea>
        </div>
      )}

      {/* Chat Area */}
      {showChat && (
        <div className="flex-1 flex flex-col bg-background">
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="px-3 py-2.5 border-b flex items-center gap-3 bg-background shadow-sm">
                {isMobile && (
                  <button onClick={() => setSelectedConversation(null)} className="p-1 hover:bg-muted rounded-full">
                    <ArrowLeft className="h-5 w-5 text-muted-foreground" />
                  </button>
                )}
                <div className="relative">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                      {(selectedConversation.customer?.name || selectedConversation.session_id).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {(() => {
                    const isOnline = isConversationOnline(selectedConversation);
                    return (
                      <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background ${isOnline ? "bg-green-400" : "bg-muted-foreground/40"}`} />
                    );
                  })()}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm text-foreground">
                    {selectedConversation.customer?.name || `Visitante ${selectedConversation.session_id.slice(0, 4)}`}
                  </h3>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    {realtimeStatus !== "connected" ? (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-yellow-500 inline-block animate-pulse" />
                        <span className="italic">{realtimeStatus === "offline" ? "Reconectando..." : "Conectando..."}</span>
                      </>
                    ) : displayCustomerTyping ? (
                      <span className="text-green-600 font-medium animate-pulse">digitando...</span>
                    ) : isConversationOnline(selectedConversation) ? (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-green-400 inline-block" />
                        Online
                      </>
                    ) : (
                      formatCustomerPresence({ ...selectedConversation, is_typing_customer: false })
                    )}
                  </p>
                </div>
              </div>

              {/* Messages — Cartlly logo as faint watermark */}
              <div 
                className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5 relative isolate" 
                ref={scrollRef}
                style={{ backgroundColor: 'hsl(var(--muted) / 0.15)' }}
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 -z-10 bg-center bg-no-repeat opacity-[0.10] dark:opacity-[0.12]"
                  style={{
                    backgroundImage: `url("/cartly-logo.webp")`,
                    backgroundSize: 'min(60%, 340px) auto',
                  }}
                />

                {loadingMsgs ? (
                  <div className="text-center text-muted-foreground py-8 text-sm">Carregando mensagens...</div>
                ) : messages?.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12">
                    <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Nenhuma mensagem ainda</p>
                  </div>
                ) : (
                  messages?.map((msg) => (
                    <div 
                      key={msg.id} 
                      className={`flex ${msg.sender_type === "admin" ? "justify-end" : "justify-start"}`}
                    >
                      <div className={`max-w-[75%] px-3.5 py-2.5 text-sm relative ${
                        msg.sender_type === "admin" 
                          ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-md shadow-sm" 
                          : "bg-background text-foreground rounded-2xl rounded-tl-md shadow-sm border border-border/30"
                      }`}>
                        <p className="leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                        <div className={`flex items-center justify-end gap-1 mt-1 ${
                          msg.sender_type === "admin" ? "text-primary-foreground/60" : "text-muted-foreground/50"
                        }`}>
                          <span className="text-[10px]">
                            {format(new Date(msg.created_at), "HH:mm")}
                          </span>
                          {msg.sender_type === "admin" && (
                            <>
                              {msg.id.startsWith("temp-")
                                ? <Loader2 className="h-3 w-3 animate-spin opacity-60" />
                                : msg.read_at
                                  ? <CheckCheck className="h-3.5 w-3.5 text-blue-300" />
                                  : msg.delivered_at
                                    ? <CheckCheck className="h-3.5 w-3.5 opacity-60" />
                                    : <Check className="h-3.5 w-3.5 opacity-60" />
                              }
                            </>
                          )}
                        </div>
                        {msg.sender_type === "admin" && (
                          <p className={`text-[9px] text-right mt-0.5 ${
                            msg.read_at ? "text-blue-300" : "text-primary-foreground/40"
                          }`}>
                            {msg.id.startsWith("temp-") ? "Enviando..." : msg.read_at ? "Visualizado" : msg.delivered_at ? "Entregue" : "Enviado"}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
                {displayCustomerTyping && (
                  <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="bg-background px-4 py-3 rounded-2xl rounded-tl-md shadow-sm border border-border/30">
                      <div className="flex gap-1.5 items-end h-3">
                        <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
                        <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
                        <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <form onSubmit={handleSend} className="p-3 border-t bg-background flex items-center gap-2">
                <Input 
                  placeholder="Digite sua resposta..." 
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  disabled={sendMessage.isPending}
                  className="flex-1 rounded-full bg-muted/50 border-border/30 h-10 text-sm px-4"
                />
                <Button 
                  type="submit" 
                  size="icon" 
                  className="h-10 w-10 rounded-full shrink-0 shadow-md"
                  disabled={!newMessage.trim() || sendMessage.isPending}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
              <div className="h-20 w-20 bg-muted/50 rounded-full flex items-center justify-center mb-5">
                <MessageSquare className="h-10 w-10 opacity-40" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-1">Suas Mensagens</h3>
              <p className="max-w-xs text-sm leading-relaxed">Selecione uma conversa ao lado para começar a responder seus clientes em tempo real.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}