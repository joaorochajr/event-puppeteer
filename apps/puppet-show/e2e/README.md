# Testes end-to-end

Fluxos reais do puppet-show contra a **API Puppeteer real**, sem nada simulado:

- `server.ts` sobe a API (`apps/puppeteer`) com banco Postgres em memória (PGlite) e better-auth de verdade, faz o seed pelo próprio HTTP da API e depois inicia `next dev` apontado para ela.
- `run.ts` espera a API e o front responderem, roda todos os `specs/*.spec.ts` com `node --test` e derruba a pilha no final.
- Os specs usam a biblioteca `playwright` (sem `@playwright/test`) e os helpers de `support.ts`.

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {
  'primaryColor': '#e0e7ff', 'primaryTextColor': '#1e293b',
  'primaryBorderColor': '#6366f1', 'lineColor': '#94a3b8',
  'secondaryColor': '#d1fae5', 'tertiaryColor': '#fef3c7',
  'background': '#ffffff', 'mainBkg': '#eef2ff', 'nodeBorder': '#a5b4fc',
  'clusterBkg': '#f8fafc', 'clusterBorder': '#e2e8f0',
  'titleColor': '#1e293b', 'edgeLabelBackground': '#ffffff', 'textColor': '#334155'
}}}%%
flowchart LR
    run["run.ts<br/>espera a pilha, roda os specs,<br/>derruba tudo no final"]:::shell --> server
    subgraph pilha["Pilha de teste (portas E2E_API_PORT e E2E_WEB_PORT)"]
        server["server.ts"]:::shell --> api["API Puppeteer real<br/>(apps/puppeteer)"]:::core
        api --- db[("Postgres em memória<br/>PGlite")]:::store
        server --> web["next dev<br/>apontado para a API"]:::core
        server -->|"seed pelo HTTP da API"| api
    end
    run -->|"node --test specs/*.spec.ts"| specs["specs<br/>playwright, desktop e mobile"]:::ok
    specs --> web
    classDef core fill:#e0e7ff,stroke:#6366f1,color:#1e293b
    classDef shell fill:#fef3c7,stroke:#f59e0b,color:#78350f
    classDef store fill:#d1fae5,stroke:#10b981,color:#064e3b
    classDef ok fill:#d1fae5,stroke:#10b981,color:#064e3b
```

## Rodar

```bash
cd apps/puppet-show
npm run test:e2e                                         # suíte inteira (~10 min)
npm run test:e2e -- --test-name-pattern="Público"        # só um grupo (describe)
E2E_API_PORT=8110 E2E_WEB_PORT=3110 npm run test:e2e     # outras portas (várias pilhas em paralelo)
```

Pré-requisitos: dependências instaladas com `nub install` e o Chromium da versão do Playwright em uso (`npx playwright install chromium`). Se aparecer `Executable doesn't exist at .../chromium_headless_shell-XXXX`, a versão do Playwright mudou e o navegador correspondente precisa ser instalado.

## Dados semeados

| Conta (senha `password123`) | Papel |
|---|---|
| `super@e2e.test` | Superadmin |
| `admin@e2e.test` | Admin da "Universidade Estadual" (orgA, organização pública) |
| `moderador@e2e.test` | Moderador da orgA |
| `membro@e2e.test`, `relator@e2e.test` | Membros da orgA |
| `outro@e2e.test` | Membro da "Outra Organização" (orgB) |

Além disso: tags Tecnologia/Cultura (oficiais) e robotica (livre); rótulo de link Inscrição; eventos nas duas organizações (um com dois dias, tag, link, voto e denúncia); um dispositivo órfão, um pendente na orgA e um ativo na orgA com telemetria. A política de triagem vale 30% (revisão) / 80% (recusa) em todas as categorias e a análise automática do teste responde violência 50%, então toda imagem enviada aguarda revisão; as imagens guardadas são servidas em `/__e2e/images/<id>.webp`. Os ids ficam em `/__e2e/state` (e em `.state.json`); os e-mails "enviados" em `/__e2e/emails`.

## Escrevendo specs

- Um arquivo por área (`public-*`, `dashboard-shell-*`, `dashboard-admin-*`) e um `describe` com nome em português que permita filtrar.
- Teste nos dois viewports (`OpenPage("desktop")` e `OpenPage("mobile")`) e verifique `HasHorizontalScroll` no celular.
- Afirme que a página não registrou erros (`errors` de `OpenPage`). Quando o teste provoca um erro de propósito (um 409 ou 400), declare exatamente qual é esperado.
- Os specs compartilham o mesmo seed: para alterar ou excluir algo, crie seus próprios dados com `Api(...)` / `CreateEvent(...)` e restaure o que mudar no seed.
