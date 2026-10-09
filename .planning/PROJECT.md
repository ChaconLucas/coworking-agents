# coworks-agents

Escritório em pixel art, ao vivo, para as sessões de IA de programação (Claude Code, Codex, …) de uma máquina.

## Princípios
- **Verdade antes de enfeite:** cada estado na tela vem de um sinal medido (transcrito, registro de sessões, processos). Quando o disco não sabe, a tela diz que não sabe.
- **Só leitura, só local:** sem hooks, sem tokens, sem rede. Servidor em 127.0.0.1, nunca lê credenciais.
- **Zero dependências:** Node puro + Canvas. Instala com `npx`.
- **Seguro por padrão:** Host allowlist, CSP, POST com cabeçalho próprio, modo `--private`.

## Público
Quem roda várias sessões de IA ao mesmo tempo e perde de vista quem precisa de atenção.
