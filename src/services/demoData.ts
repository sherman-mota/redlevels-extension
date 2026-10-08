import { RedmineUser, RedmineProject, RedmineTracker, RedmineStatus, RedmineCustomFieldDef, RedmineIssue, StrategicInitiative } from '../types/redmine';

export const DEMO_USER: RedmineUser = {
  id: 42,
  login: 'reginaldo.sherman',
  firstname: 'Reginaldo',
  lastname: 'Sherman',
  mail: 'reginaldo.sherman@empresa.com.br',
  created_on: '2024-01-15T09:00:00Z',
  last_login_on: new Date().toISOString(),
};

export const DEMO_PROJECTS: RedmineProject[] = [
  { id: 101, name: 'Plataforma E-commerce Omnichannel', identifier: 'ecommerce-omni', description: 'Expansão e unificação de canais de venda digital' },
  { id: 102, name: 'Infraestrutura Cloud & DevOps', identifier: 'cloud-devops', description: 'Migração para Kubernetes e esteira CI/CD multi-region' },
  { id: 103, name: 'Core Pagamentos & Pix 2.0', identifier: 'pix-core', description: 'Sistema de conciliação e liquidação instantânea' },
];

export const DEMO_TRACKERS: RedmineTracker[] = [
  { id: 1, name: 'Tarefa' },
  { id: 2, name: 'Bug / Defeito' },
  { id: 3, name: 'Suporte Técnico' },
  { id: 4, name: 'Épico / Funcionalidade' },
  { id: 5, name: 'Entrega Tática' },
  { id: 6, name: 'Melhoria Contínua' },
];

export const DEMO_STATUSES: RedmineStatus[] = [
  { id: 1, name: 'Nova', is_closed: false },
  { id: 2, name: 'Em Análise', is_closed: false },
  { id: 3, name: 'Em Andamento', is_closed: false },
  { id: 4, name: 'Em Testes / Homologação', is_closed: false },
  { id: 5, name: 'Concluída / Fechada', is_closed: true },
];

export const DEMO_CUSTOM_FIELDS: RedmineCustomFieldDef[] = [
  {
    id: 10,
    name: 'Iniciativa Estratégica',
    customized_type: 'issue',
    field_format: 'list',
    possible_values: [
      { value: 'EXP-2026: Expansão Omnichannel' },
      { value: 'CLD-2026: Modernização Cloud & Resiliência' },
      { value: 'PAY-2026: Nova Infraestrutura de Pagamentos' },
    ]
  },
  {
    id: 20,
    name: 'Item Bloqueado / Impedimento',
    customized_type: 'issue',
    field_format: 'bool',
    possible_values: [{ value: 'Sim' }, { value: 'Não' }]
  },
  {
    id: 30,
    name: 'Motivo do Impedimento',
    customized_type: 'issue',
    field_format: 'string',
  },
  {
    id: 40,
    name: 'Impacto no Negócio',
    customized_type: 'issue',
    field_format: 'list',
    possible_values: [{ value: 'Alto' }, { value: 'Médio' }, { value: 'Baixo' }]
  }
];

export const DEMO_STRATEGIC_INITIATIVES: StrategicInitiative[] = [
  {
    id: 'EXP-2026',
    code: 'EXP-2026',
    title: 'EXP-2026: Expansão Omnichannel',
    description: 'Atingir 45% das vendas totais em canais digitais integrados com estoque físico até Q4.',
    status: 'Em Andamento',
    progress: 68,
    tacticalIssueIds: [201, 202],
  },
  {
    id: 'CLD-2026',
    code: 'CLD-2026',
    title: 'CLD-2026: Modernização Cloud & Resiliência',
    description: 'Garantir SLA de 99.99% e redução de custos operacionais de TI em 25%.',
    status: 'Em Andamento',
    progress: 82,
    tacticalIssueIds: [203],
  },
  {
    id: 'PAY-2026',
    code: 'PAY-2026',
    title: 'PAY-2026: Nova Infraestrutura de Pagamentos',
    description: 'Implementar autorizador de cartões proprietário e conciliação Pix em tempo real.',
    status: 'Em Risco',
    progress: 42,
    tacticalIssueIds: [204, 205],
  },
];

export const INITIAL_DEMO_ISSUES: RedmineIssue[] = [
  // --- TACTICAL ISSUES (Trackers: 4 - Épico, 5 - Entrega Tática) ---
  {
    id: 201,
    project: { id: 101, name: 'Plataforma E-commerce Omnichannel' },
    tracker: { id: 4, name: 'Épico / Funcionalidade' },
    status: { id: 3, name: 'Em Andamento' },
    priority: { id: 3, name: 'Alta' },
    author: { id: 42, name: 'Reginaldo Sherman' },
    assigned_to: { id: 42, name: 'Reginaldo Sherman' },
    subject: 'Módulo de Retirada em Loja (Click & Collect Express)',
    description: 'Permitir que o cliente compre no app/web e retire na loja mais próxima em até 2 horas. Integração com WMS das lojas físicas.',
    start_date: '2026-02-01',
    due_date: '2026-11-15',
    done_ratio: 70,
    estimated_hours: 120,
    spent_hours: 84,
    created_on: '2026-02-01T08:00:00Z',
    updated_on: '2026-10-05T14:30:00Z',
    children: [
      { id: 301, tracker: { id: 1, name: 'Tarefa' }, subject: 'Integração API de estoque físico por CEP de loja' },
      { id: 302, tracker: { id: 1, name: 'Tarefa' }, subject: 'Fluxo UI no checkout: seleção de loja e horários' },
      { id: 303, tracker: { id: 2, name: 'Bug / Defeito' }, subject: 'Correção de cálculo de frete zero para retirada' },
    ],
    custom_fields: [
      { id: 10, name: 'Iniciativa Estratégica', value: 'EXP-2026: Expansão Omnichannel' },
      { id: 20, name: 'Item Bloqueado / Impedimento', value: 'Não' },
      { id: 40, name: 'Impacto no Negócio', value: 'Alto' },
    ],
    journals: [
      {
        id: 501,
        user: { id: 42, name: 'Reginaldo Sherman' },
        created_on: '2026-10-04T10:15:00Z',
        notes: 'Testes de integração com as primeiras 10 lojas piloto iniciados com sucesso.',
      }
    ]
  },
  {
    id: 202,
    project: { id: 101, name: 'Plataforma E-commerce Omnichannel' },
    tracker: { id: 5, name: 'Entrega Tática' },
    status: { id: 2, name: 'Em Análise' },
    priority: { id: 2, name: 'Normal' },
    author: { id: 12, name: 'Camila Duarte' },
    assigned_to: { id: 42, name: 'Reginaldo Sherman' },
    subject: 'Programa de Fidelidade e Cashback Unificado',
    description: 'Extensão de saldo de pontos entre lojas físicas e e-commerce com expiração inteligente.',
    start_date: '2026-03-01',
    due_date: '2026-12-20',
    done_ratio: 25,
    estimated_hours: 80,
    spent_hours: 20,
    created_on: '2026-03-01T10:00:00Z',
    updated_on: '2026-10-02T11:20:00Z',
    children: [
      { id: 304, tracker: { id: 1, name: 'Tarefa' }, subject: 'Webhook de notificação de pontos creditados' },
      { id: 305, tracker: { id: 1, name: 'Tarefa' }, subject: 'Validação de resgate no carrinho mobile' },
    ],
    custom_fields: [
      { id: 10, name: 'Iniciativa Estratégica', value: 'EXP-2026: Expansão Omnichannel' },
      { id: 20, name: 'Item Bloqueado / Impedimento', value: 'Não' },
      { id: 40, name: 'Impacto no Negócio', value: 'Médio' },
    ]
  },
  {
    id: 203,
    project: { id: 102, name: 'Infraestrutura Cloud & DevOps' },
    tracker: { id: 4, name: 'Épico / Funcionalidade' },
    status: { id: 3, name: 'Em Andamento' },
    priority: { id: 4, name: 'Urgente' },
    author: { id: 18, name: 'Lucas Mendes' },
    assigned_to: { id: 18, name: 'Lucas Mendes' },
    subject: 'Migração de Clusters para Multi-Region e Zero-Downtime',
    description: 'Implementação de tráfego Anycast e esteiras ArgoCD automatizadas para failover rápido.',
    start_date: '2026-01-10',
    due_date: '2026-10-30',
    done_ratio: 85,
    estimated_hours: 160,
    spent_hours: 138,
    created_on: '2026-01-10T09:00:00Z',
    updated_on: '2026-10-06T09:12:00Z',
    children: [
      { id: 306, tracker: { id: 1, name: 'Tarefa' }, subject: 'Configuração dos helm charts com istio service mesh' },
      { id: 307, tracker: { id: 1, name: 'Tarefa' }, subject: 'Simulação de caos e failover regional' },
    ],
    custom_fields: [
      { id: 10, name: 'Iniciativa Estratégica', value: 'CLD-2026: Modernização Cloud & Resiliência' },
      { id: 20, name: 'Item Bloqueado / Impedimento', value: 'Não' },
      { id: 40, name: 'Impacto no Negócio', value: 'Alto' },
    ]
  },
  {
    id: 204,
    project: { id: 103, name: 'Core Pagamentos & Pix 2.0' },
    tracker: { id: 5, name: 'Entrega Tática' },
    status: { id: 2, name: 'Em Análise' },
    priority: { id: 4, name: 'Urgente' },
    author: { id: 42, name: 'Reginaldo Sherman' },
    assigned_to: { id: 25, name: 'Mariana Rocha' },
    subject: 'Motor de Liquidação Pix Automático com BACEN Dict API',
    description: 'Comunicação direta com o Sistema de Pagamentos Instantâneos para reduzir taxas de intermediários.',
    start_date: '2026-04-01',
    due_date: '2026-11-30',
    done_ratio: 30,
    estimated_hours: 140,
    spent_hours: 45,
    created_on: '2026-04-01T14:00:00Z',
    updated_on: '2026-10-06T15:00:00Z',
    children: [
      { id: 308, tracker: { id: 1, name: 'Tarefa' }, subject: 'Assinatura digital XML de mensagens SPI' },
      { id: 309, tracker: { id: 1, name: 'Tarefa' }, subject: 'Certificação de chaves ICP-Brasil no HSM' },
    ],
    custom_fields: [
      { id: 10, name: 'Iniciativa Estratégica', value: 'PAY-2026: Nova Infraestrutura de Pagamentos' },
      { id: 20, name: 'Item Bloqueado / Impedimento', value: 'Sim' },
      { id: 30, name: 'Motivo do Impedimento', value: 'Aguardando liberação dos certificados mTLS no ambiente de homologação do Banco Central' },
      { id: 40, name: 'Impacto no Negócio', value: 'Alto' },
    ],
    journals: [
      {
        id: 502,
        user: { id: 25, name: 'Mariana Rocha' },
        created_on: '2026-10-06T14:40:00Z',
        notes: 'BLOQUEIO: O ticket #9822 aberto junto à autoridade certificadora ainda não obteve retorno para os certificados de produção simulada.',
      }
    ]
  },
  {
    id: 205,
    project: { id: 103, name: 'Core Pagamentos & Pix 2.0' },
    tracker: { id: 4, name: 'Épico / Funcionalidade' },
    status: { id: 5, name: 'Concluída / Fechada' },
    priority: { id: 2, name: 'Normal' },
    author: { id: 42, name: 'Reginaldo Sherman' },
    assigned_to: { id: 42, name: 'Reginaldo Sherman' },
    subject: 'Antifraude com Análise Comportamental em Tempo Real',
    description: 'Pontuação de risco em menos de 180ms utilizando telemetria de dispositivo e IP reputation.',
    start_date: '2026-01-05',
    due_date: '2026-09-10',
    done_ratio: 100,
    estimated_hours: 90,
    spent_hours: 88,
    created_on: '2026-01-05T10:00:00Z',
    updated_on: '2026-09-10T17:00:00Z',
    children: [
      { id: 310, tracker: { id: 1, name: 'Tarefa' }, subject: 'Pipeline Kafka para ingestão de eventos de checkout' }
    ],
    custom_fields: [
      { id: 10, name: 'Iniciativa Estratégica', value: 'PAY-2026: Nova Infraestrutura de Pagamentos' },
      { id: 20, name: 'Item Bloqueado / Impedimento', value: 'Não' },
      { id: 40, name: 'Impacto no Negócio', value: 'Médio' },
    ]
  },

  // --- OPERATIONAL ISSUES (Trackers: 1 - Tarefa, 2 - Bug, 3 - Suporte, 6 - Melhoria) ---
  {
    id: 301,
    parent: { id: 201 },
    project: { id: 101, name: 'Plataforma E-commerce Omnichannel' },
    tracker: { id: 1, name: 'Tarefa' },
    status: { id: 3, name: 'Em Andamento' },
    priority: { id: 3, name: 'Alta' },
    author: { id: 42, name: 'Reginaldo Sherman' },
    assigned_to: { id: 42, name: 'Reginaldo Sherman' },
    subject: 'Integração API de estoque físico por CEP de loja',
    description: 'Criar adapter REST para consultar a disponibilidade de SKU no ERP SAP das filiais com cache Redis de 5 minutos.',
    start_date: '2026-10-01',
    due_date: '2026-10-15',
    done_ratio: 60,
    estimated_hours: 24,
    spent_hours: 15,
    created_on: '2026-10-01T09:30:00Z',
    updated_on: '2026-10-06T11:00:00Z',
    custom_fields: [
      { id: 20, name: 'Item Bloqueado / Impedimento', value: 'Não' }
    ]
  },
  {
    id: 302,
    parent: { id: 201 },
    project: { id: 101, name: 'Plataforma E-commerce Omnichannel' },
    tracker: { id: 1, name: 'Tarefa' },
    status: { id: 2, name: 'Em Análise' },
    priority: { id: 2, name: 'Normal' },
    author: { id: 42, name: 'Reginaldo Sherman' },
    assigned_to: { id: 31, name: 'Renata Vasconcelos' },
    subject: 'Fluxo UI no checkout: seleção de loja e horários',
    description: 'Implementar componente de mapa e lista de lojas ordenadas por menor distância com horários de retirada disponíveis.',
    start_date: '2026-10-08',
    due_date: '2026-10-22',
    done_ratio: 0,
    estimated_hours: 32,
    spent_hours: 0,
    created_on: '2026-10-02T14:15:00Z',
    updated_on: '2026-10-02T14:15:00Z',
    custom_fields: [
      { id: 20, name: 'Item Bloqueado / Impedimento', value: 'Não' }
    ]
  },
  {
    id: 303,
    parent: { id: 201 },
    project: { id: 101, name: 'Plataforma E-commerce Omnichannel' },
    tracker: { id: 2, name: 'Bug / Defeito' },
    status: { id: 4, name: 'Em Testes / Homologação' },
    priority: { id: 4, name: 'Urgente' },
    author: { id: 12, name: 'Camila Duarte' },
    assigned_to: { id: 42, name: 'Reginaldo Sherman' },
    subject: 'Correção de cálculo de frete zero para retirada',
    description: 'Quando o usuário alternava entre entrega expressa e retirada, a taxa de entrega continuava computada no total do carrinho.',
    start_date: '2026-10-04',
    due_date: '2026-10-07',
    done_ratio: 90,
    estimated_hours: 8,
    spent_hours: 7,
    created_on: '2026-10-04T16:00:00Z',
    updated_on: '2026-10-06T14:20:00Z',
    custom_fields: [
      { id: 20, name: 'Item Bloqueado / Impedimento', value: 'Não' }
    ]
  },
  {
    id: 304,
    parent: { id: 202 },
    project: { id: 101, name: 'Plataforma E-commerce Omnichannel' },
    tracker: { id: 1, name: 'Tarefa' },
    status: { id: 1, name: 'Nova' },
    priority: { id: 2, name: 'Normal' },
    author: { id: 12, name: 'Camila Duarte' },
    assigned_to: { id: 42, name: 'Reginaldo Sherman' },
    subject: 'Webhook de notificação de pontos creditados',
    description: 'Disparar push e e-mail com extrato transacional de pontos assim que o status do pedido mudar para Entregue.',
    start_date: '2026-10-15',
    due_date: '2026-10-30',
    done_ratio: 0,
    estimated_hours: 16,
    spent_hours: 0,
    created_on: '2026-10-05T09:00:00Z',
    updated_on: '2026-10-05T09:00:00Z',
    custom_fields: [
      { id: 20, name: 'Item Bloqueado / Impedimento', value: 'Não' }
    ]
  },
  {
    id: 305,
    parent: { id: 202 },
    project: { id: 101, name: 'Plataforma E-commerce Omnichannel' },
    tracker: { id: 1, name: 'Tarefa' },
    status: { id: 1, name: 'Nova' },
    priority: { id: 2, name: 'Normal' },
    author: { id: 12, name: 'Camila Duarte' },
    assigned_to: { id: 31, name: 'Renata Vasconcelos' },
    subject: 'Validação de resgate no carrinho mobile',
    description: 'Interface modal permitindo aplicar desconto proporcional aos pontos acumulados.',
    start_date: '2026-10-20',
    due_date: '2026-11-05',
    done_ratio: 0,
    estimated_hours: 20,
    spent_hours: 0,
    created_on: '2026-10-05T09:30:00Z',
    updated_on: '2026-10-05T09:30:00Z',
    custom_fields: [
      { id: 20, name: 'Item Bloqueado / Impedimento', value: 'Não' }
    ]
  },
  {
    id: 306,
    parent: { id: 203 },
    project: { id: 102, name: 'Infraestrutura Cloud & DevOps' },
    tracker: { id: 1, name: 'Tarefa' },
    status: { id: 5, name: 'Concluída / Fechada' },
    priority: { id: 3, name: 'Alta' },
    author: { id: 18, name: 'Lucas Mendes' },
    assigned_to: { id: 18, name: 'Lucas Mendes' },
    subject: 'Configuração dos helm charts com istio service mesh',
    description: 'Mapeamento de VirtualServices e DestinationRules para suporte a canários de deploy.',
    start_date: '2026-09-10',
    due_date: '2026-09-25',
    done_ratio: 100,
    estimated_hours: 40,
    spent_hours: 38,
    created_on: '2026-09-10T08:00:00Z',
    updated_on: '2026-09-26T18:00:00Z',
    custom_fields: [
      { id: 20, name: 'Item Bloqueado / Impedimento', value: 'Não' }
    ]
  },
  {
    id: 307,
    parent: { id: 203 },
    project: { id: 102, name: 'Infraestrutura Cloud & DevOps' },
    tracker: { id: 1, name: 'Tarefa' },
    status: { id: 3, name: 'Em Andamento' },
    priority: { id: 3, name: 'Alta' },
    author: { id: 18, name: 'Lucas Mendes' },
    assigned_to: { id: 18, name: 'Lucas Mendes' },
    subject: 'Simulação de caos e failover regional',
    description: 'Executar testes de drenagem forçada da região US-East para validar redirecionamento seguro para SA-East.',
    start_date: '2026-10-02',
    due_date: '2026-10-18',
    done_ratio: 70,
    estimated_hours: 30,
    spent_hours: 22,
    created_on: '2026-10-02T10:00:00Z',
    updated_on: '2026-10-06T09:00:00Z',
    custom_fields: [
      { id: 20, name: 'Item Bloqueado / Impedimento', value: 'Não' }
    ]
  },
  {
    id: 308,
    parent: { id: 204 },
    project: { id: 103, name: 'Core Pagamentos & Pix 2.0' },
    tracker: { id: 1, name: 'Tarefa' },
    status: { id: 3, name: 'Em Andamento' },
    priority: { id: 4, name: 'Urgente' },
    author: { id: 42, name: 'Reginaldo Sherman' },
    assigned_to: { id: 25, name: 'Mariana Rocha' },
    subject: 'Assinatura digital XML de mensagens SPI',
    description: 'Implementar módulo em Go para geração de envelopes XMLDSIG com algoritmo RSA-SHA256 conforme manual do BACEN.',
    start_date: '2026-09-15',
    due_date: '2026-10-25',
    done_ratio: 50,
    estimated_hours: 45,
    spent_hours: 32,
    created_on: '2026-09-15T11:00:00Z',
    updated_on: '2026-10-06T15:30:00Z',
    custom_fields: [
      { id: 20, name: 'Item Bloqueado / Impedimento', value: 'Sim' },
      { id: 30, name: 'Motivo do Impedimento', value: 'Falta homologação dos certificados no módulo HSM corporativo' }
    ]
  },
  {
    id: 309,
    parent: { id: 204 },
    project: { id: 103, name: 'Core Pagamentos & Pix 2.0' },
    tracker: { id: 3, name: 'Suporte Técnico' },
    status: { id: 2, name: 'Em Análise' },
    priority: { id: 4, name: 'Urgente' },
    author: { id: 25, name: 'Mariana Rocha' },
    assigned_to: { id: 42, name: 'Reginaldo Sherman' },
    subject: 'Certificação de chaves ICP-Brasil no HSM',
    description: 'Abrir chamado emergencial com a equipe de segurança da informação para instalação da raiz certificadora V10.',
    start_date: '2026-10-05',
    due_date: '2026-10-10',
    done_ratio: 20,
    estimated_hours: 16,
    spent_hours: 4,
    created_on: '2026-10-05T14:00:00Z',
    updated_on: '2026-10-06T15:10:00Z',
    custom_fields: [
      { id: 20, name: 'Item Bloqueado / Impedimento', value: 'Sim' },
      { id: 30, name: 'Motivo do Impedimento', value: 'Aguardando validação do CISO corporativo' }
    ]
  },
  {
    id: 310,
    parent: { id: 205 },
    project: { id: 103, name: 'Core Pagamentos & Pix 2.0' },
    tracker: { id: 1, name: 'Tarefa' },
    status: { id: 5, name: 'Concluída / Fechada' },
    priority: { id: 2, name: 'Normal' },
    author: { id: 42, name: 'Reginaldo Sherman' },
    assigned_to: { id: 42, name: 'Reginaldo Sherman' },
    subject: 'Pipeline Kafka para ingestão de eventos de checkout',
    description: 'Tópico particionado por customer_id com política de retenção de 7 dias e compactação.',
    start_date: '2026-08-01',
    due_date: '2026-08-20',
    done_ratio: 100,
    estimated_hours: 32,
    spent_hours: 30,
    created_on: '2026-08-01T09:00:00Z',
    updated_on: '2026-08-20T17:00:00Z',
    custom_fields: [
      { id: 20, name: 'Item Bloqueado / Impedimento', value: 'Não' }
    ]
  },
  {
    id: 311,
    project: { id: 101, name: 'Plataforma E-commerce Omnichannel' },
    tracker: { id: 2, name: 'Bug / Defeito' },
    status: { id: 3, name: 'Em Andamento' },
    priority: { id: 4, name: 'Urgente' },
    author: { id: 31, name: 'Renata Vasconcelos' },
    assigned_to: { id: 42, name: 'Reginaldo Sherman' },
    subject: 'Falha de renderização do mini-cart em dispositivos iOS Safari 18',
    description: 'Botão de finalizar compra fica sobreposto pela barra inferior dinâmica do Safari.',
    start_date: '2026-10-06',
    due_date: '2026-10-08',
    done_ratio: 40,
    estimated_hours: 6,
    spent_hours: 2.5,
    created_on: '2026-10-06T08:30:00Z',
    updated_on: '2026-10-06T13:00:00Z',
    custom_fields: [
      { id: 20, name: 'Item Bloqueado / Impedimento', value: 'Não' }
    ]
  }
];
