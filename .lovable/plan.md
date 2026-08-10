# Membros em falta na Bolsa de Transporte (ex.: Muaz)

## O que se passa

Verifiquei na base de dados: o Muaz Hijazi Alsamman está inscrito nessa ação com estado **presente**, é do tipo **Membro** e tem cidade "São João da Madeira" — ou seja, é elegível. Mas **não existe registo de bolsa** para ele (existem apenas para a Rawan, o Hamza e a Lana). O Mohammad está como "ausente", por isso esse fica mesmo de fora.

A página "Bolsa de Transporte" mostra apenas registos que já existem na base de dados (comportamento pedido antes: depois de apagados, não voltam a aparecer). Como a bolsa da família foi criada antes de o Muaz entrar/ficar presente, ele nunca chegou a ter registo — e por isso não aparece.

## O que proponho

Na aba **Pagamentos**, dentro de cada ação:

- No cabeçalho de cada família, um aviso discreto quando há membros elegíveis sem bolsa: "1 membro elegível sem bolsa", com botão **+ Adicionar em falta**.
- Ao clicar, são criados os registos em falta com o valor calculado pela cidade de residência (valor × 2) e estado "por pagar".
- Elegibilidade igual à do resto da app: inscrição **presente**, tipo **Membro**, pessoa não eliminada.
- Um botão equivalente ao nível da ação, para resolver todas as famílias de uma vez.

Assim mantém-se a regra atual (nada aparece sozinho), mas o caso de alguém ficar de fora passa a ser visível e resolúvel num clique.

## Notas técnicas

- Ficheiro: `src/routes/_app/_admin.bolsas-transporte.tsx`.
- A query principal já traz `inscricoes`, `pessoas`, `familias`, `cidades` e `bolsas_pagamentos`. As inscrições sem pagamento (hoje descartadas em `if (!pagamento) continue;`) passam a ser recolhidas como "candidatas em falta", filtradas por `status = 'presente'` e tipo Membro — não são renderizadas como linhas, apenas contadas no aviso.
- Nova mutação com `.insert` em `bolsas_pagamentos` (inscricao_id, pessoa_id, acao_id, valor, estado `por_pagar`), seguida de `refetchQueries` das queries de transporte.
- Sem alterações de base de dados.