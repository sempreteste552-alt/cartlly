import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Users, Mail, Phone, MapPin } from "lucide-react";
import { useState, useMemo } from "react";

export default function Clientes() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");

  const { data: customers, isLoading } = useQuery({
    queryKey: ["customers", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("store_user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    if (!customers) return [];
    if (!search.trim()) return customers;
    const term = search.toLowerCase();
    return customers.filter(
      (c: any) =>
        c.name?.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term) ||
        c.phone?.includes(term)
    );
  }, [customers, search]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Clientes</h1>
        <p className="text-muted-foreground">Clientes cadastrados na sua loja</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Badge variant="secondary" className="shrink-0">
          <Users className="mr-1 h-3 w-3" /> {customers?.length || 0} clientes
        </Badge>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-2 text-muted-foreground/50" />
            <p>Nenhum cliente encontrado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((customer: any) => (
            <Card key={customer.id} className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground">
                      {customer.name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <p className="font-medium">{customer.name}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {customer.email}
                        </span>
                        {customer.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {customer.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    {customer.city && customer.state && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {customer.city}, {customer.state}
                      </span>
                    )}
                    <p className="mt-1">
                      Desde {new Date(customer.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
