# Ficha da pessoa: separador Mapa de KM + campos em falta

## 1. Novo separador "Mapa de KM"

No painel de detalhes de uma pessoa (Participantes > abrir pessoa), junta-se um separador ao lado de Perfil, Dados, Ações/Eventos, Etiquetas e Currículo.

Mostra:
- Todas as folhas de quilómetros dessa pessoa: período, data de criação, total de km, valor total, e um selo de estado colorido (rascunho / enviado / erro), igual ao que já existe na Gestão de Bolsas de Transporte.
- Ações por linha: editar (abre o formulário de folha de KM já preenchido), descarregar PDF, reenviar por email e apagar (com confirmação).
- Botão "Nova folha de KM" que abre o formulário já associado a esta pessoa.
- Se a pessoa pertencer a uma família, uma lista secundária, apenas de leitura, com as despesas de quilómetros dessa família (data, motivo, km, valor, estado), para dar contexto.
- Mensagem simpática quando ainda não existem registos.

## 2. Campos ocultos agora visíveis

No separador "Dados" passa a haver uma secção "Dados de pagamento" com:
- IBAN (texto)
- Matrícula (texto)
- Assinatura: pré-visualização da assinatura guardada, com opção de desenhar/substituir ou limpar, usando o mesmo bloco de assinatura já usado na folha de KM.

Estes campos passam a ser lidos e gravados ao guardar a pessoa, ficando disponíveis para preencher automaticamente as folhas de KM.

## Notas técnicas

- Ficheiro principal: `src/routes/_app/_admin.participantes.tsx` (diálogo de edição, query de `pessoas`, mutação `update`).
- Adicionar `iban, matricula, assinatura` à seleção de colunas (também no `onOpenMember`), ao tipo do estado `editing` e ao payload de `update`.
- Assinatura via `src/components/signature-pad.tsx` (guardada como data URL em `pessoas.assinatura`).
- Novo componente `src/components/pessoa-mapa-km-section.tsx`: query `folhas_km` por `pessoa_id` e `mapa_km` por `familia_id`; reutiliza `FolhaKmDialog` (props `folhaId`) e o utilitário partilhado de PDF já extraído; invalida `folhas-km` após gravar/apagar.
- Sem alterações de base de dados; todas as colunas já existem.
