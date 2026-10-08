# Redlevels Extension 🚀
> Interface ágil para o **Redmine** baseada no modelo de *Flight Levels* (Operacional, Tático e Estratégico).

[![Chrome Manifest V3](https://img.shields.io/badge/Chrome_Extension-Manifest_V3-4285F4?logo=googlechrome&logoColor=white)](public/manifest.json)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

---

## 📌 Sumário

1. [Visão Geral](#-visão-geral)
2. [Arquitetura e Segurança (Manifest V3)](#-arquitetura-e-segurança-manifest-v3)
3. [Pré-requisitos](#-pré-requisitos)
4. [Como Compilar e Gerar a Extensão](#-como-compilar-e-gerar-a-extensão)
5. [Passo a Passo: Como Instalar no Google Chrome](#-passo-a-passo-como-instalar-no-google-chrome)
6. [Guia de Uso & Funcionalidades](#-guia-de-uso--funcionalidades)
   - [Onboarding & Conexão](#1-onboarding--saúde-da-conexão)
   - [Modo Demonstração (Sandbox)](#2-modo-demonstração-sandbox)
   - [Inbox Pessoal](#3-inbox-pessoal)
   - [Fluxos Operacionais (Kanban)](#4-fluxos-operacionais-kanban)
   - [Fluxos Táticos (Kanban)](#5-fluxos-táticos-kanban)
   - [Iniciativas Estratégicas (Árvore Hierárquica)](#6-iniciativas-estratégicas-árvore-hierárquica)
   - [Painel de Configurações](#7-painel-de-configurações)
7. [Scripts Disponíveis](#-scripts-disponíveis)
8. [Estrutura de Pastas](#-estrutura-de-pastas)
9. [Solução de Dúvidas e Problemas Comuns](#-solução-de-dúvidas-e-problemas-comuns)

---

## 🔍 Visão Geral

O **Redlevels Extension** é uma extensão de navegador desenvolvida sob a especificação **Manifest V3** que serve como interface moderna, ágil e produtiva para usuários do **Redmine**. 

Ela organiza o trabalho em três níveis de voo corporativos (*Flight Levels*):

```
       ┌─────────────────────────────────────────────────────┐
Nível 1│  ESTRATÉGICO: Iniciativas Globais da Organização    │
       └──────────────────────────┬──────────────────────────┘
                                  │ vincula
       ┌──────────────────────────▼──────────────────────────┐
Nível 2│  TÁTICO: Épicos e Entregas Táticas (Coordenação)    │
       └──────────────────────────┬──────────────────────────┘
                                  │ desdobra
       ┌──────────────────────────▼──────────────────────────┐
Nível 3│  OPERACIONAL: Tarefas, Bugs e Execução do Dia a Dia  │
       └─────────────────────────────────────────────────────┘
```

Toda a interação é sincronizada em tempo real com a API REST oficial do seu Redmine via chamadas diretas autenticadas por API Key.

---

## 🛡️ Arquitetura e Segurança (Manifest V3)

Esta extensão foi projetada em total conformidade com as políticas da **Google Chrome Web Store**:

- **Sem conexões a servidores terceiros**: Os dados trafegam exclusivamente entre o seu navegador e a URL do seu Redmine configurada por você.
- **Armazenamento Seguro e Isolado**: Configurações e preferências utilizam `chrome.storage.local`.
- **Zero CDNs Remotas (CSP Compliance)**: As fontes (*Plus Jakarta Sans* e *JetBrains Mono*) e os ícones estão totalmente empacotados dentro da extensão, garantindo funcionamento offline e respeito estrito à política de segurança de conteúdo.
- **Permissão sob Demanda**: Ao configurar seu servidor, a extensão solicita permissão de rede (`optional_host_permissions`) estritamente para o domínio do seu Redmine.
- **Service Worker Inteligente**: Clicar no ícone da extensão abre uma aba dedicada em tela cheia ou foca a aba já aberta, otimizando o consumo de memória do navegador.

---

## 📋 Pré-requisitos

Para gerar a extensão a partir do código-fonte, você precisa de:

- **Node.js**: Versão `18.x`, `20.x` ou superior.
- **npm**: Versão `9.x` ou superior (instalado junto com o Node).
- **Google Chrome** (ou navegadores baseados em Chromium, como *Brave*, *Edge*, *Opera*).

---

## ⚙️ Como Compilar e Gerar a Extensão

Abra o seu terminal na pasta do projeto e execute os passos abaixo:

### 1. Instalar as dependências
```bash
npm install
```

### 2. Compilar o projeto
```bash
npm run build
```

> **O que esse comando faz?**  
> O Vite compilará a aplicação TypeScript/React com Tailwind CSS e copiará o `manifest.json`, o `background.js` e a pasta de ícones para o diretório **`dist/`**.  
> **A pasta `dist/` é a sua extensão pronta para ser instalada!**

### 3. (Opcional) Gerar arquivo `.zip` para distribuição
Se você deseja gerar um pacote compactado para enviar para outros membros do time ou submeter à Chrome Web Store:
```bash
npm run zip
```
Este comando criará o arquivo **`redlevels-extension.zip`** na raiz do projeto.

---

## 🧩 Passo a Passo: Como Instalar no Google Chrome

Siga estas instruções simples para carregar a extensão no navegador:

### Passo 1: Abrir a página de extensões
No Google Chrome, digite o seguinte endereço na barra de navegação e pressione Enter:
```text
chrome://extensions
```

### Passo 2: Ativar o "Modo do desenvolvedor"
No canto superior direito da tela de extensões, ative a chave seletora **"Modo do desenvolvedor"** (*Developer mode*).

### Passo 3: Carregar a extensão descompactada
1. No canto superior esquerdo da página, clique no botão **"Carregar sem compactação"** (*Load unpacked*).
2. Na janela de seleção de pastas, navegue até a pasta do projeto e selecione a pasta:
   ```text
   /Users/shermanmota/workspace/redlevels-extension/dist
   ```
3. Confirme a seleção.

### Passo 4: Fixar e abrir a extensão
1. A extensão **Redlevels Extension** aparecerá na sua lista de extensões ativas.
2. Clique no ícone de peça de quebra-cabeça (Extensões) no canto superior direito do Chrome.
3. Clique no ícone de alfinete ao lado de **Redlevels Extension** para fixá-la na barra de ferramentas.
4. Clique no ícone do Redlevels para abrir a aplicação!

> 💡 **Atualizações de Código em Desenvolvimento**:  
> Sempre que fizer alterações no código-fonte e rodar `npm run build`, basta ir em `chrome://extensions` e clicar no botão **Recarregar (ícone de seta circular)** no card do Redlevels Extension.

---

## 📖 Guia de Uso & Funcionalidades

### 1. Onboarding & Saúde da Conexão
Na primeira vez que você abrir a extensão, a tela de boas-vindas solicitará:
- **URL da aplicação Redmine**: Ex: `https://redmine.suaempresa.com.br`
- **Chave de API (`api_key`)**: Token alfanumérico de 40 dígitos.

> ℹ️ **Onde obter a chave de API?**  
> Acesse o Redmine no link: `https://[SEU_REDMINE]/my/account`. Na barra lateral direita, na seção **Chave de acesso à API**, clique em **"Exibir"** (ou "Redefinir"). Certifique-se também de que o administrador habilitou a API REST em *Administração › Configurações › API*.

No topo da extensão, um indicador permanente monitora a saúde da conexão, mostrando latência em milissegundos e o primeiro nome do usuário autenticado.

---

### 2. Modo Demonstração (Sandbox)
Não tem acesso ao Redmine no momento ou deseja apenas testar a interface?  
Clique em **"Testar com Dados de Demonstração"** no Onboarding ou na aba de Configurações. Um ambiente sandbox com dados realistas (iniciativas, épicos, bugs, impedimentos e notas) será ativado instantaneamente.

---

### 3. Inbox Pessoal
Área focada na produtividade individual do dia a dia:
- **Atribuídas a Mim**: Lista todas as tarefas em que você é o responsável (`assigned_to_id = me`).
- **Observadas / Acompanhadas**: Tarefas em que você participa como autor ou observador (*watcher*).
- Troca rápida de status e filtros por pendências e bloqueios.

---

### 4. Fluxos Operacionais (Kanban)
Painel voltado para a execução das tarefas cotidianas (Bugs, Tarefas, Suporte, Melhorias):
- **Layout Expandido Ultra-Wide**: O quadro Kanban aproveita toda a largura da tela sem restrições de largura máxima, permitindo visualizar múltiplos status confortavelmente mesmo em fluxos com muitas colunas.
- **Densidade / Largura das Colunas**: Seletor rápido de largura das colunas (*Compacta: 224px*, *Padrão: 272px*, *Ampla: 320px*), ideal para instâncias com 6 ou mais status cadastrados.
- **Navegação Horizontal Descomplicada**: Botões dedicados de rolagem horizontal (◀ e ▶) para deslizar suavemente entre colunas.
- **Colunas por Status**: Cada coluna reflete a situação da tarefa no Redmine (*Nova*, *Em Andamento*, *Homologação*, *Concluída*, etc.).
- **Cards Informativos**: Exibem ID, Tracker, Projeto, Assunto, Responsável e **ID da tarefa Pai**.
- **Impedimentos em Destaque**: Tarefas marcadas com bloqueio exibem tarja visual de alerta e o motivo do impedimento.
- **Drag & Drop com Atualização em Tempo Real**: Arraste um card entre colunas para disparar uma requisição `PUT /issues/[id].json`. Caso o workflow do Redmine impeça a transição, a interface realiza rollback com feedback explicativo.
- **Swimlanes por Projeto**: Opção de agrupar o Kanban em raias horizontais por projeto.
- **Filtros com Ordenação Alfabética**: Filtro de projetos ordenado rigorosamente de A a Z, além de filtros por responsável, tipo de tarefa, bloqueados e ID do pai.

---

### 5. Fluxos Táticos (Kanban)
Focado no nível de coordenação e entregas táticas (Épicos, Features, Milestones):
- **Cards Táticos**: Exibem o responsável, percentual de progresso e a lista com os **IDs de todas as tarefas filhas vinculadas**.
- **Agrupamento por Iniciativa Estratégica**: Visualize os épicos organizados pelas metas da empresa.
- **Impedimentos Táticos**: Sinalização visual de bloqueios que impactam entregas de médio prazo.

---

### 6. Iniciativas Estratégicas (Árvore Hierárquica)
Visão consolidada da estratégia da organização desdobrada até o nível operacional:
1. **Nível 1 (Estratégia)**: Agrupamento dinâmico das tarefas táticas pelo **campo personalizado escolhido nas configurações** (ex.: Iniciativa Estratégica, OKRs ou Programa). Exibe status dinâmico (*Em Andamento*, *Em Risco*, *Concluído*), barra de progresso consolidada e contagem de bloqueios. Tarefas sem valor são organizadas no grupo *"Sem Iniciativa Vinculada"*.
2. **Nível 2 (Tático)**: Clique no chevron da iniciativa para expandir a lista de tarefas táticas relacionadas em formato de árvore.
3. **Nível 3 (Operacional)**: Clique em uma tarefa tática para abrir as tarefas operacionais filhas vinculadas diretamente a ela (`parent_id` ou `children`).

---

### 7. Painel de Configurações
Permite calibrar perfeitamente o Redlevels para a realidade da sua empresa:
- **Importação e Exportação de Configurações**:
  - Exporte todas as configurações definidas (conexão, mapeamento de status, ordenação e temas) em um arquivo `.json` com um clique.
  - Importe arquivos de configuração para compartilhar padronizações entre times ou migrar facilmente entre ambientes.
- **Classificação de Níveis com Busca e Filtros Inteligentes (Itens 2 e 3)**:
  - **Filtros e Busca por Tracker**: Tanto o Nível Operacional quanto o Nível Tático contam com busca em tempo real (por nome ou ID) e botões de filtro rápido (*Todos*, *Selecionados* e *Livres*).
  - **Sinalização Visual de Trackers Escolhidos**: Badges destacados indicam quais trackers já foram escolhidos no nível atual (`✓ Operacional` ou `✓ Tático`) e alertam se um tracker já foi atribuído ao outro nível (`em: Tático` ou `em: Operacional`), evitando conflitos e facilitando a localização.
  - Ordenação alfabética automática dos trackers para fácil localização.
- **Mapeamento de Campos Personalizados (*Custom Fields*)**:
  - Selecione qual campo da tarefa tática representa a **Iniciativa Estratégica** (ordenados alfabeticamente).
  - Selecione qual campo representa o **Impedimento / Bloqueio** e defina o valor disparador (ex.: `Sim`, `1`, `true`).
- **Mapeador de Colunas do Kanban por Tipo de Tarefa com Filtros Dedicados**:
  - Mapeie de forma **independente** os status do Redmine para o **Nível Operacional** e para o **Nível Tático**.
  - Estágios padronizados: *Backlog*, *Em Análise*, *Em Andamento* e *Concluído*.
  - **Filtros e Busca por Coluna**: Cada uma das 4 colunas conta com campo de busca em tempo real (por nome ou ID) e botões de filtro rápido (*Todos*, *Mapeados* e *Livres / Não Mapeados*), facilitando a gestão mesmo com dezenas de status cadastrados no Redmine.
  - Indicador visual em tempo real mostrando se um status já pertence a outra coluna do mesmo nível e botão de limpeza rápida.
- **Ordenação das Colunas dos Kanbans (Operacional e Tático)**:
  - Configure a ordem sequencial exata das colunas de cada fluxo Kanban através de botões de subir (▲) e descer (▼), refletindo os status mapeados em cada nível.
  - Ou reordene colunas diretamente nos próprios painéis Kanban utilizando os botões de avançar e recuar (`‹` e `›`) presentes nos cabeçalhos das colunas!
  - Opção para restaurar a qualquer momento a ordem padrão de cada Kanban.
- **Temas Visuais**: Escolha entre 5 esquemas cromáticos sofisticados:
  - 🔴 **Redlevels Crimson** (Padrão, escuro com detalhes em rubi)
  - 🔵 **Midnight Navy** (Azul profundo espacial)
  - 🟢 **Emerald Aurora** (Tons petróleo e esmeralda)
  - 🟡 **Warm Amber** (Carvão aquecido e âmbar)
  - ⚪ **Clean Light** (Modo claro de alto contraste)

---

## 💻 Scripts Disponíveis

| Comando | Descrição |
| :--- | :--- |
| `npm run dev` | Inicia o servidor local Vite com Hot Module Replacement (útil para desenvolvimento rápido da UI). |
| `npm run build` | Compila o bundle de produção na pasta `dist/` pronto para carregar no Chrome. |
| `npm run lint` | Executa a verificação estática de tipos do TypeScript (`tsc --noEmit`). |
| `npm run zip` | Compila o projeto e empacota o diretório `dist/` no arquivo `redlevels-extension.zip`. |
| `npm run clean` | Remove as pastas `dist/` e pacotes zip gerados anteriormente. |

---

## 📁 Estrutura de Pastas

```text
redlevels-extension/
├── public/                     # Arquivos estáticos copiados na compilação
│   ├── manifest.json           # Manifesto Manifest V3 da extensão
│   ├── background.js           # Service worker da extensão Chrome
│   └── icons/                  # Ícones em resolução 16px, 32px, 48px e 128px
├── src/
│   ├── components/             # Componentes React
│   │   ├── Header.tsx          # Cabeçalho com abas e saúde da conexão
│   │   ├── KanbanBoard.tsx     # Componente compartilhado de Kanban com drag & drop
│   │   ├── KanbanOperacional.tsx # Fluxo operacional por status e projeto
│   │   ├── KanbanTatico.tsx    # Fluxo tático por iniciativa e filhos
│   │   ├── IniciativasEstrategicas.tsx # Árvore hierárquica em 3 níveis
│   │   ├── InboxView.tsx       # Tarefas atribuídas e observadas
│   │   ├── ConfiguracaoView.tsx # Formulários de mapeamento e temas
│   │   ├── OnboardingModal.tsx # Modal de primeira conexão
│   │   ├── FirstTimeTour.tsx   # Tour explicativo de primeira viagem
│   │   └── IssueDetailModal.tsx# Modal detalhado da tarefa com notas e edição
│   ├── services/
│   │   ├── redmineApi.ts       # Cliente HTTP REST para API do Redmine
│   │   ├── storage.ts          # Camada de persistência via chrome.storage.local
│   │   └── demoData.ts         # Dataset rico para modo demonstração
│   ├── styles/
│   │   └── themes.ts           # Definições de paletas e temas
│   ├── types/
│   │   └── redmine.ts          # Interfaces TypeScript completas
│   ├── index.css               # Estilos globais Tailwind v4 e fontes locais
│   └── main.tsx                # Ponto de entrada React
├── dist/                       # PASTA FINAL DA EXTENSÃO (gerada pelo npm run build)
├── docs/
│   └── redlevel-extension.md   # Especificação e requisitos do projeto
├── CHROMEWEBSTORE.md           # Metadados e justificativas para publicação na loja
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## ❓ Solução de Dúvidas e Problemas Comuns

### 1. "Falha ao conectar com o Redmine" / Erro de Rede
- **Permissão de Host**: Ao conectar com uma nova URL, o Chrome pode exibir um banner solicitando autorização para acessar o endereço. Clique em **"Conceder Acesso"**.
- **Certificado SSL Autoassinado**: Se o seu Redmine roda em HTTPS com certificado interno, abra a URL do Redmine diretamente em uma aba do Chrome e clique em *"Avançado › Continuar para o site"* para que o navegador confie no certificado.

### 2. Erro 401 (Não Autorizado)
- Verifique se a sua chave de API está correta.
- Confirme se a API REST está ativada no Redmine: acesse *Administração › Configurações › API* e marque a opção **"Ativar serviço web REST"**.

### 3. O cartão voltou para a coluna anterior ao mover no Kanban
- No Redmine, transições de status são governadas por regras de fluxo de trabalho (*Workflows*) associadas ao seu papel (Role) e ao Tracker da tarefa. Se o Redmine rejeitar a mudança por restrição de perfil, a extensão desfaz a movimentação visualmente e avisa o motivo.

---

**Redlevels Extension** — Produtividade e clareza estratégica no seu Redmine.
