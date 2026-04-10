import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bell, Plus, Trash2, Eye, EyeOff, Info, AlertTriangle, Megaphone, Scroll } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const typeIcons: Record<string, React.ElementType> = {
  info: Info,
  warning: AlertTriangle,
  promo: Megaphone,
};
const typeLabels: Record<string, string> = {
  info: "ℹ️ Informação",
  warning: "⚠️ Alerta",
  promo: "📣 Promoção",
};

export default function SuperAdminBanners() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [bannerType, setBannerType] = useState("info");
  const [bgColor, setBgColor] = useState("#1a1a2e");
  const [textColor, setTextColor] = useState("#ffffff");
  const [marquee, setMarquee] = useState(false);
  const [targetAudience, setTargetAudience] = useState("all");
  const [linkUrl, setLinkUrl] = useState("");

  const { data: announcements, isLoading } = useQuery({
    queryKey: ["admin_announcements_manage"],
    queryFn: async () => {
      // Super admins can see all via ALL policy
      const { data, error } = await supabase
        .from("admin_announcements")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("admin_announcements").insert({
        title,
        body: body || null,
        banner_type: bannerType,
        bg_color: bgColor,
        text_color: textColor,
        marquee,
        target_audience: targetAudience,
        link_url: linkUrl || null,
        created_by: user!.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_announcements_manage"] });
      queryClient.invalidateQueries({ queryKey: ["admin_announcements_active"] });
      toast.success("Banner criado com sucesso!");
      setTitle("");
      setBody("");
      setLinkUrl("");
      setMarquee(false);
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const toggleMut = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("admin_announcements").update({ active } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_announcements_manage"] });
      queryClient.invalidateQueries({ queryKey: ["admin_announcements_active"] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("admin_announcements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_announcements_manage"] });
      queryClient.invalidateQueries({ queryKey: ["admin_announcements_active"] });
      toast.success("Banner removido!");
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Banners para Admins</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Crie banners fixos ou letreiros animados que aparecem no topo do painel de todos os tenants.
        </p>
      </div>

      {/* Create new banner */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Plus className="h-5 w-5 text-primary" /> Novo Banner
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: ⚠️ Manutenção programada dia 15/04" />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={bannerType} onValueChange={setBannerType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">ℹ️ Informação</SelectItem>
                  <SelectItem value="warning">⚠️ Alerta</SelectItem>
                  <SelectItem value="promo">📣 Promoção</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Mensagem (opcional)</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Detalhes adicionais do aviso..." rows={2} />
          </div>

          <div className="space-y-2">
            <Label>Link (opcional)</Label>
            <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Cor de Fundo</Label>
              <div className="flex gap-2 items-center">
                <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="h-9 w-12 rounded border border-border cursor-pointer" />
                <Input value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="flex-1" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cor do Texto</Label>
              <div className="flex gap-2 items-center">
                <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="h-9 w-12 rounded border border-border cursor-pointer" />
                <Input value={textColor} onChange={(e) => setTextColor(e.target.value)} className="flex-1" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Público-alvo</Label>
              <Select value={targetAudience} onValueChange={setTargetAudience}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tenants</SelectItem>
                  <SelectItem value="specific">Tenants específicos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-4 pb-1">
              <div className="flex items-center gap-2">
                <Switch checked={marquee} onCheckedChange={setMarquee} />
                <Label className="text-sm flex items-center gap-1">
                  <Scroll className="h-4 w-4" /> Letreiro
                </Label>
              </div>
            </div>
          </div>

          {/* Preview */}
          {title && (
            <>
              <Label className="text-xs text-muted-foreground">Preview:</Label>
              <div className="rounded-lg overflow-hidden border border-border">
                <div
                  className="py-2.5 px-4 text-sm font-medium flex items-center gap-2"
                  style={{ backgroundColor: bgColor, color: textColor }}
                >
                  {marquee ? (
                    <div className="overflow-hidden flex-1">
                      <div className="whitespace-nowrap animate-marquee">
                        {bannerType === "warning" ? "⚠️" : bannerType === "promo" ? "📣" : "ℹ️"} {title}{body ? ` — ${body}` : ""}
                        {linkUrl && <span className="ml-3 underline">Saiba mais →</span>}
                      </div>
                    </div>
                  ) : (
                    <>
                      {bannerType === "warning" ? "⚠️" : bannerType === "promo" ? "📣" : "ℹ️"} {title}{body ? ` — ${body}` : ""}
                      {linkUrl && <a href={linkUrl} target="_blank" rel="noopener noreferrer" className="underline ml-2">Saiba mais →</a>}
                    </>
                  )}
                </div>
              </div>
            </>
          )}

          <Button onClick={() => createMut.mutate()} disabled={!title || createMut.isPending} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" /> Criar Banner
          </Button>
        </CardContent>
      </Card>

      {/* Marquee animation */}
      <style>{`
        @keyframes marquee-scroll {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee {
          animation: marquee-scroll 15s linear infinite;
        }
      `}</style>

      {/* List of banners */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="h-5 w-5 text-primary" /> Banners Criados
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6"><Skeleton className="h-20" /></div>
          ) : !announcements?.length ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Nenhum banner criado ainda.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Público</TableHead>
                    <TableHead>Letreiro</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {announcements.map((ann: any) => (
                    <TableRow key={ann.id}>
                      <TableCell>
                        <Badge variant={ann.active ? "default" : "outline"} className="text-xs">
                          {ann.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{typeLabels[ann.banner_type] || ann.banner_type}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded shrink-0" style={{ backgroundColor: ann.bg_color }} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate max-w-[250px]">{ann.title}</p>
                            {ann.body && <p className="text-xs text-muted-foreground truncate max-w-[250px]">{ann.body}</p>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {ann.target_audience === "all" ? "Todos" : "Específicos"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {ann.marquee ? <Scroll className="h-4 w-4 text-primary" /> : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(ann.created_at), "dd/MM/yy HH:mm")}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => toggleMut.mutate({ id: ann.id, active: !ann.active })}
                          >
                            {ann.active ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-primary" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => deleteMut.mutate(ann.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
