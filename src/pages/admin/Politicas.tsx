import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Shield, FileText, Cookie, Eye } from "lucide-react";
import { useStorePolicies, useUpdateStorePolicies } from "@/hooks/useStorePolicies";
import ReactMarkdown from "react-markdown";

export default function Politicas() {
  const { data: policies, isLoading } = useStorePolicies();
  const updatePolicies = useUpdateStorePolicies();
  const [tab, setTab] = useState("privacy");
  const [preview, setPreview] = useState(false);

  const [privacy, setPrivacy] = useState("");
  const [terms, setTerms] = useState("");
  const [cookies, setCookies] = useState("");

  useEffect(() => {
    if (policies) {
      setPrivacy(policies.privacy_policy || "");
      setTerms(policies.terms_of_service || "");
      setCookies(policies.cookie_policy || "");
    }
  }, [policies]);

  const handleSave = () => {
    updatePolicies.mutate({
      privacy_policy: privacy,
      terms_of_service: terms,
      cookie_policy: cookies,
    });
  };

  const currentText = tab === "privacy" ? privacy : tab === "terms" ? terms : cookies;
  const setCurrentText = tab === "privacy" ? setPrivacy : tab === "terms" ? setTerms : setCookies;

  const tabMeta = {
    privacy: { label: "Privacidade", icon: Shield, desc: "Política de Privacidade" },
    terms: { label: "Termos", icon: FileText, desc: "Termos de Uso" },
    cookies: { label: "Cookies", icon: Cookie, desc: "Política de Cookies" },
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Políticas da Loja</h1>
          <p className="text-sm text-muted-foreground">Edite as políticas que aparecem na sua vitrine</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPreview(!preview)} className="gap-1.5">
            <Eye className="h-3.5 w-3.5" /> {preview ? "Editar" : "Prévia"}
          </Button>
          <Button onClick={handleSave} disabled={updatePolicies.isPending} size="sm">
            {updatePolicies.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full sm:w-auto">
          {Object.entries(tabMeta).map(([key, meta]) => (
            <TabsTrigger key={key} value={key} className="gap-1.5 text-xs sm:text-sm">
              <meta.icon className="h-3.5 w-3.5" /> {meta.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {Object.entries(tabMeta).map(([key, meta]) => (
          <TabsContent key={key} value={key} className="mt-4">
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <meta.icon className="h-4 w-4 text-primary" /> {meta.desc}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {preview ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none min-h-[300px] p-4 rounded-lg border border-border bg-muted/30">
                    <ReactMarkdown>{currentText || "*Nenhum conteúdo ainda.*"}</ReactMarkdown>
                  </div>
                ) : (
                  <Textarea
                    value={currentText}
                    onChange={(e) => setCurrentText(e.target.value)}
                    rows={16}
                    className="font-mono text-sm"
                    placeholder={`Escreva sua ${meta.desc.toLowerCase()} em Markdown...`}
                  />
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  Suporta formatação Markdown (# títulos, **negrito**, - listas)
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
