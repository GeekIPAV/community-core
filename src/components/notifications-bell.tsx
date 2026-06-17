import { useEffect, useState } from "react";
import { Bell, Check, Trash2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { pt } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

type Notif = {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  link: string | null;
  lida: boolean;
  created_at: string;
};

export function NotificationsBell() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);

  const fetchItems = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notificacoes" as any)
      .select("id, tipo, titulo, descricao, link, lida, created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    setItems((data as any) ?? []);
  };

  useEffect(() => {
    if (!user) return;
    fetchItems();
    const channel = supabase
      .channel("notif-" + user.id)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notificacoes", filter: `recipient_auth_id=eq.${user.id}` },
        () => fetchItems(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const unread = items.filter((i) => !i.lida).length;

  const markAll = async () => {
    if (!user) return;
    await supabase
      .from("notificacoes" as any)
      .update({ lida: true, lida_em: new Date().toISOString() })
      .eq("recipient_auth_id", user.id)
      .eq("lida", false);
    fetchItems();
  };

  const markOne = async (id: string) => {
    await supabase
      .from("notificacoes" as any)
      .update({ lida: true, lida_em: new Date().toISOString() })
      .eq("id", id);
    fetchItems();
  };

  const clearAll = async () => {
    if (!user) return;
    await supabase.from("notificacoes" as any).delete().eq("recipient_auth_id", user.id);
    fetchItems();
  };

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-0.5 -top-0.5 h-4 min-w-4 rounded-full px-1 text-[10px] leading-none"
            >
              {unread > 99 ? "99+" : unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">Notificações</span>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={markAll} disabled={unread === 0}>
              <Check className="mr-1 h-3 w-3" /> Marcar lidas
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={clearAll} disabled={items.length === 0}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <ScrollArea className="max-h-[420px]">
          {items.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">Sem notificações</div>
          ) : (
            <ul className="divide-y">
              {items.map((n) => {
                const content = (
                  <div className={`px-3 py-2.5 transition-colors hover:bg-accent ${n.lida ? "opacity-60" : ""}`}>
                    <div className="flex items-start gap-2">
                      {!n.lida && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{n.titulo}</div>
                        {n.descricao && (
                          <div className="truncate text-xs text-muted-foreground">{n.descricao}</div>
                        )}
                        <div className="mt-0.5 text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: pt })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link
                        to={n.link}
                        onClick={() => {
                          markOne(n.id);
                          setOpen(false);
                        }}
                        className="block"
                      >
                        {content}
                      </Link>
                    ) : (
                      <button type="button" onClick={() => markOne(n.id)} className="block w-full text-left">
                        {content}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}