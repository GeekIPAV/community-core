# Tabelas compactas inspiradas no Notion

## Objetivo
Reduzir a área ocupada acima das tabelas e tornar os cabeçalhos mais informativos, mantendo todas as funções atuais e aplicando o resultado globalmente através dos componentes partilhados.

## Alterações
- Adicionar aos cabeçalhos um ícone discreto conforme o tipo de dado: texto, número, data ou seleção.
- Mostrar a seta de ordenação apenas ao passar o rato; manter persistente somente a ordenação ativa.
- Suavizar a aparência de grelha e mostrar o controlo de redimensionamento apenas quando necessário.
- Transformar as vistas guardadas numa fila compacta de separadores com ícones, scroll horizontal e botão “+” só com ícone.
- Compactar pesquisa, filtros, agrupamento, edição, colunas, exportação e contagem numa linha principal; permitir uma segunda linha apenas para vistas guardadas quando existirem.
- Tornar filtros e agrupamento mais discretos, preservando indicadores de estado e acessibilidade por tooltip.
- Harmonizar o seletor de colunas e o cabeçalho partilhado legado com o mesmo padrão visual.

## Validação
- Confirmar a verificação de tipos.
- Verificar Participantes, Financiamentos e Famílias em modo claro e escuro.
- Confirmar que listas longas de vistas fazem scroll horizontal sem aumentar a altura da página.
- Guardar capturas do estado final e usar as capturas anteriores disponíveis como referência visual do antes/depois.

## Detalhes técnicos
- As alterações ficam limitadas aos componentes partilhados indicados.
- Não serão alterados filtros, ordenação, agrupamento, vistas, edição, exportação nem ações em massa.
- Serão usados apenas tokens semânticos existentes, garantindo contraste em ambos os temas.
