# Context Map

Event Puppeteer is a monorepo with one shared glossary and one glossary per app that owns vocabulary of its own. Read the shared one first, then the app you are working in.

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {
  'primaryColor': '#e0e7ff', 'primaryTextColor': '#1e293b',
  'primaryBorderColor': '#6366f1', 'lineColor': '#94a3b8',
  'secondaryColor': '#d1fae5', 'tertiaryColor': '#fef3c7',
  'background': '#ffffff', 'mainBkg': '#eef2ff', 'nodeBorder': '#a5b4fc',
  'clusterBkg': '#f8fafc', 'clusterBorder': '#e2e8f0',
  'titleColor': '#1e293b', 'edgeLabelBackground': '#ffffff', 'textColor': '#334155'
}}}%%
flowchart TD
    system["System<br/>CONTEXT.md + docs/adr<br/>shared terms, cross-app decisions"]:::core
    puppeteer["Puppeteer<br/>the domain: Roles, Events, moderation,<br/>Images, Device management"]:::shell
    puppet["Puppet<br/>Agent, Terminal,<br/>update confirmation (planned)"]:::store
    show["puppet-show<br/>no glossary of its own"]:::external
    system --> puppeteer
    system --> puppet
    puppeteer -.->|"reference for shared terms"| puppet
    puppeteer -.->|"its terms, in Portuguese on screen"| show
    classDef core fill:#e0e7ff,stroke:#6366f1,color:#1e293b
    classDef shell fill:#fef3c7,stroke:#f59e0b,color:#78350f
    classDef store fill:#d1fae5,stroke:#10b981,color:#064e3b
    classDef external fill:#f1f5f9,stroke:#94a3b8,color:#334155
```

| Context | Glossary | ADRs | What it owns |
|---|---|---|---|
| System | [CONTEXT.md](CONTEXT.md) | [docs/adr](docs/adr) | The terms every app shares and the decisions that span apps (the Wake-up). |
| Puppeteer | [apps/puppeteer/CONTEXT.md](apps/puppeteer/CONTEXT.md) | [apps/puppeteer/docs/adr](apps/puppeteer/docs/adr) | The domain: Organizations, Roles, Events, moderation, Images and Screening, Device management. |
| Puppet | [apps/puppet/CONTEXT.md](apps/puppet/CONTEXT.md) | [apps/puppet/docs/adr](apps/puppet/docs/adr) | The Device-side process roles (Agent, Terminal) and the planned update confirmation and Rollback. |
| puppet-show | none | none | A presentation layer: it uses Puppeteer's terms and has no vocabulary of its own. Its screens are described in [APP-DESIGN.md](apps/puppet-show/APP-DESIGN.md). |

When a term appears in more than one glossary, Puppeteer's definition is the reference. If a term is missing everywhere, add it where it belongs rather than inventing a synonym.
