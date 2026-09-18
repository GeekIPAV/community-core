# Melhorar a página Atividades e Acompanhamento

## Objetivo
Tornar os resultados mais fáceis de ler e a atribuição de atividades mais evidente, sem alterar dados, operações ou outras páginas.

## Alterações visuais
- Criar avatares reutilizáveis com iniciais e cores consistentes, distinguindo participantes de voluntários.
- Mostrar até cinco participantes recentes em pilha na linha de cada atividade, com contador para os restantes.
- Ordenar atividades de cada categoria pelo número de registos, da mais usada para a menos usada.
- Adicionar o indicador “Pessoas envolvidas” e o total de registos por categoria.
- Adicionar controlo “Expandir tudo” / “Recolher tudo”.
- Apresentar cada registo como uma linha temporal mais legível, com data destacada e grupos separados de participantes e voluntários.
- Dar maior destaque ao botão principal e usar o ícone de adicionar pessoa nas ações por atividade.
- Reforçar visualmente que toda a linha da atividade é clicável.

## Validação
- Confirmar a página no navegador em formato desktop e móvel.
- Executar `bunx tsgo --noEmit` e apresentar o resultado real.

## Limites
- Não alterar consultas, operações, diálogos, invalidações, estrutura de dados ou outras páginas.
