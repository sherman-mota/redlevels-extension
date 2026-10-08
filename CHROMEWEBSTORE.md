# Redlevels Extension — Chrome Web Store Listing

## Metadata

- **Name**: Redlevels Extension
- **Short Name**: Redlevels
- **Version**: 1.0.0
- **Primary Language**: Português (Brasil)
- **Category**: Produtividade / Ferramentas para Desenvolvedores
- **Summary**: Interface ágil para o Redmine com fluxos operacionais, táticos e iniciativas estratégicas.

---

## Detalhes da Listagem

### Descrição Curta (até 132 caracteres)
Interface ágil e intuitiva para Redmine: Inbox pessoal, Kanban operacional e tático, e árvore hierárquica de iniciativas estratégicas.

### Descrição Completa
O Redlevels Extension conecta-se diretamente à sua instalação do Redmine para transformar sua gestão de projetos em uma experiência ágil, fluida e estruturada em três níveis de voo (Flight Levels):

• **Inbox Pessoal**: Acesse em um só lugar todas as tarefas atribuídas ao seu usuário e os itens que você acompanha, com atualização rápida de status e alertas de impedimento.
• **Fluxos Operacionais (Kanban)**: Acompanhe a execução do dia a dia em um painel Kanban ágil. Arraste e solte tarefas entre as colunas para atualizar o status em tempo real via API do Redmine, visualize tarefas pai e identifique imediatamente cartões com impedimento.
• **Fluxos Táticos (Kanban)**: Gerencie épicos e entregas táticas com rastreamento das tarefas filhas sob sua responsabilidade e agrupamento por iniciativa estratégica.
• **Iniciativas Estratégicas (Árvore Hierárquica)**: Visualize de forma integrada a hierarquia entre Estratégia, Tático e Operação, acompanhando o progresso consolidado de cada iniciativa.
• **Configuração Flexível**: Mapeie quais tipos de tarefa pertencem a cada nível, indique quais campos personalizados representam bloqueios e iniciativas, e escolha o tema visual de sua preferência.
• **Modo Demonstração Integrado**: Experimente todas as funcionalidades com dados de teste ricos sem necessidade de conexão imediata a um servidor.

---

## Justificativas de Permissões (Permissions Justifications)

| Permissão | Justificativa para a equipe de revisão do Chrome Web Store |
| :--- | :--- |
| `storage` | Utilizada exclusivamente para armazenar localmente no navegador as preferências do usuário, mapeamentos de status do Kanban e configurações de conexão. |
| `optional_host_permissions` (`https://*/*`, `http://*/*`) | Solicitada em tempo de execução somente para a URL do servidor Redmine especificada pelo usuário, permitindo comunicação direta com a API REST do Redmine do usuário. Nenhum dado é enviado para servidores de terceiros. |

---

## Privacidade e Uso de Dados

- **Coleta de dados**: A extensão **não** coleta, **não** armazena externamente e **não** compartilha dados analíticos, credenciais ou telemetria.
- **Armazenamento**: Todos os tokens de API e URLs são guardados localmente no navegador através da API `chrome.storage.local`.
- **Comunicação externa**: A extensão comunica-se estritamente com o endereço do servidor Redmine configurado pelo usuário final.
