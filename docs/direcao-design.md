# CG Studio — Direção de design (aprovada)

Prévia visual: `docs/brand/previa.html` (abrir com um servidor estático na pasta, p. ex. `python3 -m http.server`).
Assets: `docs/brand/`. Contexto funcional: `docs/especificacao-v1.md`.

## Princípios

- Studio de movimento, tom calmo e acolhedor. Não é academia agressiva de musculação.
- Fundo grafite liso. A hierarquia vem de contraste e borda fina, **sem sombras**.
- O vermelho é o único ponto de cor e só aparece onde há ação ou destaque.
- Landing e painéis (aluno e admin) falam a mesma linguagem. O painel não usa o tema padrão do shadcn.

## Cores (tokens)

| Token | Valor | Uso |
|---|---|---|
| `--background` | `#1E1E1E` | fundo |
| `--surface` | `#272727` | cartões, painéis |
| `--surface-2` | `#2D2D2D` | slots e células do calendário |
| `--foreground` | `#FFFFFF` | texto e logo |
| `--muted-foreground` | branco a 62% | texto secundário |
| `--border` | branco a 12% | bordas |
| `--accent` | `#FF3420` | botão principal, destaque do título, "seu horário", vence amanhã, ações |

Usos permitidos do vermelho: botão principal, um trecho de destaque no título, slots do próprio aluno, prazos urgentes, ação "registrar pagamento", halter. Em qualquer outro lugar, branco e cinza.
Estados: lotado = opacidade 45%; com vaga = superfície com borda, que ganha borda vermelha no hover; inativo/atraso = tag com borda, e vermelho só quando for urgente.

## Tipografia

- **Lobster Two** (700, e itálico 400 quando houver destaque), via `next/font/google`: só logo-slogan, títulos de página e de seção, números grandes de resumo.
- **Inter** (400/500/600): texto corrido, tabelas, formulários, horários, valores, botões.
- Rótulos de seção: Inter 600, 12px, caixa alta, espaçamento 0,14em, vermelho, com o halter à esquerda.

## Assets (`docs/brand/`)

| Arquivo | O que é | Notas |
|---|---|---|
| `logo-crop.svg` | logo completo (CG, Studio com halter, slogan) | viewBox já recortado; usar no cabeçalho (altura ~64px) |
| `logo.svg` | original sem recorte | só referência |
| `halter.svg` | halter vermelho (`#FF3420`), 77×118 | tem sombra embutida; fora de fundo escuro gerar versão limpa |
| `pose1.svg`, `pose2.svg` | figuras de traço fino (SVG Repo) | branco, recolorível por CSS |
| `previa.html` | prévia da direção | referência visual |

Ao implementar, copiar os usados para `public/brand/`. Gerar **favicon** a partir do halter, **sem a sombra**.
**Licença das figuras:** conferir no SVG Repo antes de publicar. Pode exigir atribuição.

## Halter como marcador recorrente

Único elemento de cor fora do logo. Usos: rótulos de seção (12×18px), "Seu horário" no calendário (branco sobre o vermelho do slot), favicon, estado vazio, loading. Legível de 18px a 360px.

## Landing

- Cabeçalho: logo, menu (Modalidades, Planos, Horários, Contato) e botão "Entrar com Google" (vermelho, pílula).
- Hero: rótulo "Studio de movimento"; título em Lobster Two "Corpo em ação, *mente em equilíbrio.*" (segunda parte vermelha, itálico); subtítulo curto; botão principal e botão secundário com borda "Ver horários"; as duas figuras à direita.
- Demais seções (modalidades, planos 1x/2x/3x, horários, contato) no mesmo padrão: título em Lobster Two, conteúdo em Inter, cartões `--surface` com borda.
- Contato real no rodapé: WhatsApp **(53) 98457-3198** e Instagram **@studioclaricegeiger**.
- Substitui o design atual da landing (fonte condensada em caixa alta, laranja `#FF7A2E`).

## Painel do aluno

- Calendário semanal (seg–sex): linhas por horário, colunas por dia. Cada slot mostra "N vagas" / "1 vaga" / "Lotado" e uma barra de lotação de 4px.
- Slots do aluno em `--accent`, com halter branco. Contador "N de M slots usados" e vencimento em pílula no topo.
- Pendente: botão "agendar aula grátis".
- Legenda: Seu horário, Com vaga, Lotado.
- **Mobile é prioridade**: o aluno usa mais no celular. No celular o calendário vira lista por dia (um dia por vez, com seletor), em vez da grade de 5 colunas.

## Painel do admin

- Cartões de resumo: alunos ativos, recebido no mês, em atraso (número em Lobster Two).
- "Vencimentos próximos" (próximos 5 dias): tabela com aluno, plano, vencimento (tag; vermelha se for amanhã ou hoje) e ação "Registrar".
- Demais telas (alunos, calendário, financeiro, admins) em tabelas e cartões do mesmo estilo.

## Acessibilidade

- Contraste: branco e `#FF3420` sobre `#1E1E1E` passam; branco sobre `#FF3420` (botões) conferir em 14px+ semi-negrito.
- Foco visível em todos os controles (anel branco ou vermelho de 2px).
- Respeitar `prefers-reduced-motion`. Estado não pode depender só de cor: usar texto ("Lotado", "Seu horário").
- Alvos de toque de pelo menos 44px.

## Aplicação (para os terminais)

1. Tokens e fontes em `src/app/globals.css` e `src/app/layout.tsx`, substituindo o tema atual, incluindo o escopo `.cg` e a fonte Anton.
2. Landing: reescrever `src/components/landing/*` conforme esta direção.
3. Componentes de painel (`src/components/dashboard/*` e os novos do calendário) seguem os mesmos tokens.
