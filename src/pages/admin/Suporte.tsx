import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Send, User, Check, CheckCheck, Clock, MessageSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

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
};

export default function Suporte() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
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
          messages:support_messages(body, created_at)
        `)
        .eq("tenant_id", user?.id)
        .order("last_message_at", { ascending: false });

      if (error) throw error;
      
      return data.map((conv: any) => ({
        ...conv,
        last_message: conv.messages?.[0]?.body || "Nenhuma mensagem"
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

      // Mark as read when admin views
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
        { event: "*", schema: "public", table: "support_messages" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["support_messages"] });
          queryClient.invalidateQueries({ queryKey: ["support_conversations"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_conversations" },
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

  const filteredConversations = conversations?.filter(c => 
    c.session_id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-120px)] bg-card rounded-xl border shadow-sm overflow-hidden">
      {/* Sidebar */}
      <div className="w-1/3 border-r flex flex-col bg-muted/30">
        <div className="p-4 border-b bg-card">
          <h2 className="text-xl font-bold mb-4">Suporte Humano</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar conversa..." 
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
          {loadingConvs ? (
            <div className="p-4 text-center text-muted-foreground">Carregando...</div>
          ) : filteredConversations?.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">Nenhuma conversa encontrada.</div>
          ) : (
            filteredConversations?.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedConversation(conv)}
                className={`w-full p-4 flex items-center gap-3 hover:bg-accent/50 transition-colors border-b text-left ${selectedConversation?.id === conv.id ? "bg-accent" : ""}`}
              >
                <Avatar>
                  <AvatarFallback><User className="h-5 w-5" /></AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <span className="font-semibold truncate">Visitante {conv.session_id.slice(0, 4)}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {format(new Date(conv.last_message_at), "HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{conv.last_message}</p>
                </div>
                {conv.is_typing_customer && (
                  <span className="text-[10px] text-primary animate-pulse font-medium">Digitando...</span>
                )}
              </button>
            ))
          )}
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-card">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b flex items-center justify-between bg-card">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback><User /></AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-sm">Visitante {selectedConversation.session_id.slice(0, 4)}</h3>
                  <p className="text-[10px] text-muted-foreground">
                    {selectedConversation.is_typing_customer ? "Digitando..." : "Online"}
                  </p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/5" ref={scrollRef}>
              {loadingMsgs ? (
                <div className="text-center text-muted-foreground">Carregando mensagens...</div>
              ) : (
                messages?.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`flex ${msg.sender_type === "admin" ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`max-w-[70%] p-3 rounded-2xl text-sm relative shadow-sm ${
                      msg.sender_type === "admin" 
                        ? "bg-primary text-primary-foreground rounded-tr-none" 
                        : "bg-muted rounded-tl-none"
                    }`}>
                      <p>{msg.body}</p>
                      <div className={`flex items-center justify-end gap-1 mt-1 ${
                        msg.sender_type === "admin" ? "text-primary-foreground/70" : "text-muted-foreground"
                      }`}>
                        <span className="text-[9px]">
                          {format(new Date(msg.created_at), "HH:mm")}
                        </span>
                        {msg.sender_type === "admin" && (
                          msg.read_at ? <CheckCheck className="h-3 w-3" /> : 
                          msg.delivered_at ? <CheckCheck className="h-3 w-3 opacity-50" /> : 
                          <Check className="h-3 w-3" />
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="p-4 border-t flex gap-2 bg-card">
              <Input 
                placeholder="Digite sua resposta..." 
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                disabled={sendMessage.isPending}
              />
              <Button type="submit" size="icon" disabled={!newMessage.trim() || sendMessage.isPending}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
            <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <MessageSquare className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-semibold">Suas Mensagens</h3>
            <p className="max-w-xs">Selecione uma conversa ao lado para começar a responder seus clientes em tempo real.</p>
          </div>
        )}
      </div>
    </div>
  );
}
