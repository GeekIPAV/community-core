## Ligar a tua conta Gmail à plataforma

Vou ligar o **conector Gmail da Lovable** ao projeto. Isto autoriza a TUA caixa Gmail (uma só conta — a da owner MEERU) para a plataforma poder ler e/ou enviar emails a partir dela.

### Passos

1. **Abrir o diálogo de ligação Gmail** (escolhes a conta Google e os scopes: ler, enviar, modificar, etc.).
2. Após autorizares, a chave da ligação fica disponível como variável de ambiente no backend (`GOOGLE_MAIL_API_KEY`) — nunca exposta no frontend.
3. **Confirmar a ligação** com uma chamada de teste à API Gmail (ex.: listar 1 email recente da inbox) para validar que tudo funciona.

### Importante saberes antes de avançar

- Liga **a tua conta** (owner). Não serve para cada utilizador da plataforma ligar o Gmail dele — para isso seria preciso OAuth próprio (não está no scope).
- Os emails ficam **acessíveis a quem tiver acesso ao backend** da plataforma.
- Por agora **só configuro a ligação**. Não vou criar UI nem fluxos automáticos (ex.: "enviar relatório por email", "ler caixa de apoio") — dizes-me depois o que queres fazer com o acesso e construo nessa altura.

### Próximo passo após aprovação

Decides quais permissões dar ao autorizar (recomendo no mínimo `gmail.readonly` + `gmail.send` se quiseres ler **e** enviar; só `gmail.send` se for apenas para envio).

Confirma para eu abrir a janela de autorização.