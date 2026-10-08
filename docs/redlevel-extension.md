# Redlevel Extension

> Crie uma extensão para o chrome chamada "redlevels extension".
Essa extensão deve ser capaz de se conectar ao redmine e servir como interface para o usuário do redmine

## Jornada do usuário

1. A primeira coisa que o usuário deve fazer é utilizar o onboard da nova interface. Nela será solicitado a URL da aplicação do redmine e a api_key.

Obs: Exibir uma nota dizendo: "A api key poderá ser gerada utilizando o link https://[IP_ADDRESS]/my/account".

2. Após realizar o onboarding, a extensão deve ser capaz de se conectar ao redmine e exibir informações sobre a saúde da conexão (conectado, primeiro nome do usuário) ou uma eventual falha. Deve usar a API do redmine para obter e enviar informações.

### Primeira vez do usuário

3. Na primeira vez que o usuário entra, ele deve receber explicações sobre a configuração da interface:
- Inbox -  Ficam as tarefas atribuídas ao seu usuário ou sendo observadas
- Fluxos Operacionais - Ficam as tarefas por projeto (projects) por tipo de tarefa (tracker). As tarefas devem ser exibidas como um card num kanban. Nesse kanban, cada coluna representa a situação (status) 
- Fluxos táticos - Ficam as tarefas por projeto (projects) por tipo de tarefa (tracker). As tarefas devem ser exibidas como um card num kanban. Nesse kanban, cada coluna representa a situação (status) 
- Iniciativas Estratégicas - São listadas as iniciativas estratégicas, sua relação com as tarefas táticas e operacionais num formato de árvore
- Configuração - é uma área onde ficam as configurações:
    - URL da aplicação e api key
    - Quais tipos de tarefa estão no nível operacional
    - Quais tipos de tarefa estão no nível tático
    - Qual campo personalizado (custom field) da tarefa tática representa a iniciativa estratégica
    - Qual campo personalizado (custom field) dos tipos de tarefa representa um bloqueio (item pausado)
    - Um mapeador do status no redmine com os tipos de status de um kanban(backlog, A fazer, Em progresso, Concluído)
    - Opções de tema para a interface (UI)


#### Kanban de fluxo operacional
    1. Deve exibir um kanban onde cada coluna representa a situação (status). No kanban operacional so devem aparecer colunas com status da tarefa do tipo operacional
    2. O card com impedimento deve ser sinalizado
    3. O card deve ter o id da tarefa, projeto, assunto, responsável, id da tarefa pai 
    4. Ao clicar deve abrir um modal exibindo todos os detalhes da tarefa (issue.json) de forma bem amigável
    5. Ao mover o card para uma nova coluna, deve atualizar a situação (status) da tarefa no redmine via API.Deve fazer uma requisição PUT para /issues/[issue_id].json
    6. As tarefas devem ser agrupadas por projeto (projects)
    7. Devem existir filtros para responsável, projeto, tipo de tarefa, itens bloqueados e tarefas pai.

#### Kanban de fluxo tático
    1. Deve exibir um kanban onde cada coluna representa a situação (status). No kanban tático, so devem aparecer colunas com status da tarefa do tipo tático
    2. O card com impedimento deve ser sinalizado
    3. O card deve ter o id da tarefa, projeto, assunto, responsável e ids das tarefas filhas
    4. Ao clicar deve abrir um modal exibindo todos os detalhes da tarefa (issue.json) de forma bem amigável
    5. Ao mover o card para uma nova coluna, deve atualizar a situação (status) da tarefa no redmine via API.Deve fazer uma requisição PUT para /issues/[issue_id].json
    6. As tarefas devem ser possível agrupadar por iniciativa estratégica
    7. Devem existir filtros para responsável, projeto, tipo de tarefa, itens bloqueados e campo personalizado do tipo da tarefa .
    

#### Iniciativas Estratégicas
    1. Deve exibir as iniciativas estratégicas
    2. Cada iniciativa estratégica deve ter um botão para expandir e exibir as tarefas táticas relacionadas
    3. Ao expandir, deve exibir as tarefas táticas relacionadas de forma hierárquica (árvore)
    4. Ao clicar em uma tarefa tática, deve exibir as tarefas operacionais relacionadas de forma hierárquica (árvore)
    5. Deve existir a possibilidade de agrupar ou filtrar as tarefas táticas por projeto (projects), responsavel, status, bloqueadas, ou campo personalizado das tarefas do tipo tático.

#### Configuração
    1. Deve exibir um formulário para configurar a URL da aplicação e api key
    2. Deve exibir um formulário para configurar quais tipos de tarefa estão no nível operacional
    3. Deve exibir um formulário para configurar quais tipos de tarefa estão no nível tático
    4. Deve exibir um formulário para configurar qual campo personalizado (custom field) da tarefa tática representa a iniciativa estratégica
    5. Deve exibir um formulário para configurar qual campo personalizado (custom field) dos tipos de tarefa representa um bloqueio (item pausado)
    6. Deve exibir um formulário para configurar um mapeador do status no redmine com os tipos de status de um kanban(backlog, A fazer, Em progresso, Concluído)
    7. Deve exibir um formulário para configurar opções de tema para a interface (UI)

> Faça funcionar. Garanta que siga a política do Google. Evite criar arquivos desnecessários e mantenha o código organizado. Se for criar alguma nova pasta, certifique-se de que ela seja necessária e que esteja justificada.

MUITO IMPORTANTE: A Interface deve ser fluida e amigável, garantindo uma experiência ágil e agradável para o usuário.