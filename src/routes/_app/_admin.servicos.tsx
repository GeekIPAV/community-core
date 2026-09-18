import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet, Receipt, Users as UsersIcon, Tag, CalendarRange } from "lucide-react";
import { ColaboradoresTab } from "@/components/servicos/ColaboradoresTab";
import { SessoesTab } from "@/components/servicos/SessoesTab";
import { TiposServicoTab } from "@/components/servicos/TiposServicoTab";
import { RegistosTab } from "@/components/servicos/RegistosTab";
import { PagamentosTab } from "@/components/servicos/PagamentosTab";
import { ServicosCalendarioPage } from "./_admin.servicos.calendario";

export const Route = createFileRoute("/_app/_admin/servicos")({
  component: ServicosPage,
});

function ServicosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Serviços &amp; Pagamentos</h1>
        <p className="text-sm text-muted-foreground">
          Gere colaboradores, tipos de serviço, registos prestados e pagamentos.
        </p>
      </div>
      <Tabs defaultValue="calendario" className="space-y-4">
        <TabsList>
          <TabsTrigger value="calendario"><CalendarRange className="mr-2 h-4 w-4" />Calendário</TabsTrigger>
          <TabsTrigger value="registos"><Receipt className="mr-2 h-4 w-4" />Registos</TabsTrigger>
          <TabsTrigger value="sessoes"><UsersIcon className="mr-2 h-4 w-4" />Sessões</TabsTrigger>
          <TabsTrigger value="pagamentos"><Wallet className="mr-2 h-4 w-4" />Pagamentos</TabsTrigger>
          <TabsTrigger value="colaboradores"><UsersIcon className="mr-2 h-4 w-4" />Colaboradores</TabsTrigger>
          <TabsTrigger value="tipos"><Tag className="mr-2 h-4 w-4" />Tipos de serviço</TabsTrigger>
        </TabsList>
        <TabsContent value="calendario" className="mt-6"><ServicosCalendarioPage embedded /></TabsContent>
        <TabsContent value="registos" className="mt-6"><RegistosTab /></TabsContent>
        <TabsContent value="sessoes" className="mt-6"><SessoesTab /></TabsContent>
        <TabsContent value="pagamentos" className="mt-6"><PagamentosTab /></TabsContent>
        <TabsContent value="colaboradores" className="mt-6"><ColaboradoresTab /></TabsContent>
        <TabsContent value="tipos" className="mt-6"><TiposServicoTab /></TabsContent>
      </Tabs>
    </div>
  );
}
