import { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Send, User, Check, CheckCheck, MessageSquare, ArrowLeft, Phone, MoreVertical } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

const NOTIFICATION_SOUND = "/sounds/notification.mp3";

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
  last_message?: string;
  unread_count?: number;
  customer?: {
    name: string | null;
    email: string | null;
    phone: string | null;
  };
};

function formatConversationDate(dateStr: string) {
  const date = new Date(dateStr);
  if (isToday(date)) return format(date, "HH:mm");
  if (isYesterday(date)) return "Ontem";
  return format(date, "dd/MM/yy");
}

export default function Suporte() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [search, setSearch] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAdminTyping, setIsAdminTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { data: conversations, isLoading: loadingConvs } = useQuery({
    queryKey: ["support_conversations", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_conversations")
        .select(`
          *,
          customer:customers(name, email, phone),
          messages:support_messages(body, created_at, sender_type, read_at)
        `)
        .eq("tenant_id", user?.id)
        .order("last_message_at", { ascending: false });

      if (error) throw error;
      
      return data.map((conv: any) => ({
        ...conv,
        last_message: conv.messages?.[0]?.body || "Nenhuma mensagem",
        unread_count: conv.messages?.filter((m: any) => m.sender_type === "customer" && !m.read_at).length || 0
      })) as Conversation[];
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

      await supabase
        .from("support_messages")
        .update({ read_at: new Date().toISOString() })
        .eq("conversation_id", selectedConversation.id)
        .eq("sender_type", "customer")
        .is("read_at", null);

      return data as Message[];
    },
    enabled: !!selectedConversation,
  });

  const sendMessage = useMutation({
    mutationFn: async (body: string) => {
      if (!selectedConversation || !user) return;
      const { error } = await supabase
        .from("support_messages")
        .insert({
          conversation_id: selectedConversation.id,
          sender_type: "admin",
          sender_id: user.id,
          body,
        });
      if (error) throw error;

      if (selectedConversation.customer_id) {
        await supabase.functions.invoke("send-push", {
          body: {
            title: `Nova mensagem de ${user.email || "Suporte"}`,
            body: body.length > 100 ? body.substring(0, 97) + "..." : body,
            targetUserId: selectedConversation.customer_id,
            url: `/loja/${selectedConversation.tenant_id}?chat=true`
          }
        });
      }
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["support_messages", selectedConversation?.id] });
      queryClient.invalidateQueries({ queryKey: ["support_conversations"] });
    },
  });

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("support_realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages" },
        (payload: any) => {
          if (payload.new.sender_type === "customer") {
            playNotificationSound();
          }
          queryClient.invalidateQueries({ queryKey: ["support_messages", payload.new.conversation_id] });
          queryClient.invalidateQueries({ queryKey: ["support_conversations"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "support_conversations" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["support_conversations"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  useEffect(() => {
    if (selectedConversation) {
      const updateTypingStatus = async (typing: boolean) => {
        await supabase
          .from("support_conversations")
          .update({ is_typing_admin: typing })
          .eq("id", selectedConversation.id);
      };

      if (newMessage.trim() && !isAdminTyping) {
        setIsAdminTyping(true);
        updateTypingStatus(true);
      }

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      
      typingTimeoutRef.current = setTimeout(() => {
        if (isAdminTyping) {
          setIsAdminTyping(false);
          updateTypingStatus(false);
        }
      }, 3000);
    }
  }, [newMessage, selectedConversation]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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
                        {conv.session_id.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {conv.is_typing_customer && (
                      <span className="absolute bottom-0 right-0 h-3 w-3 bg-green-400 rounded-full border-2 border-background" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="font-semibold text-sm text-foreground truncate">Visitante {conv.session_id.slice(0, 4)}</span>
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
                      {selectedConversation.session_id.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-green-400 rounded-full border-2 border-background" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm text-foreground">Visitante {selectedConversation.session_id.slice(0, 4)}</h3>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    {selectedConversation.is_typing_customer ? (
                      <span className="text-green-600 font-medium animate-pulse">digitando...</span>
                    ) : (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-green-400 inline-block" />
                        Online
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Messages */}
              <div 
                className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5" 
                ref={scrollRef}
                style={{ 
                  backgroundColor: 'hsl(var(--muted) / 0.15)',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
                }}
              >
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
                            msg.read_at 
                              ? <CheckCheck className="h-3.5 w-3.5 text-blue-300" /> 
                              : msg.delivered_at 
                                ? <CheckCheck className="h-3.5 w-3.5 opacity-60" /> 
                                : <Check className="h-3.5 w-3.5 opacity-60" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))
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