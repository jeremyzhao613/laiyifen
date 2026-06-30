export type Identity = '员工' | '加盟商' | '供应商' | '经销商';

export type AgentStatus = 'online' | 'offline' | 'busy' | 'standby';

export interface Agent {
  id: string;
  name: string;
  owner: string;
  status: AgentStatus;
  duty: string;
  api: string;
}

export interface SupportStaff {
  id: string;
  name: string;
  group: string;
  status: AgentStatus;
  categories: string[];
  feishuUserId: string;
}

export interface QuickQuestion {
  id: string;
  title: string;
  identity: Identity;
  sort: number;
  enabled: boolean;
  agent: string;
}

export interface Ticket {
  id: string;
  title: string;
  userName: string;
  phone: string;
  identity: Identity;
  channel: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  category: string;
  status: '待处理' | '处理中' | '已完成' | '已转派';
  currentStaffId: string;
  currentStaff: string;
  rating: string;
  serviceStartedAt: string;
  feishuStatus: string;
  read: boolean;
  summary: string;
  createdAt: string;
  updatedAt: string;
  transferLogs: Array<{
    from: string;
    to: string;
    reason: string;
    at: string;
  }>;
}

export interface UploadedFile {
  id: string;
  originalName: string;
  name: string;
  mime: string;
  size: number;
  url: string;
  extractedText: string;
  ocrText?: string;
  analysisMode?: 'multimodal-direct' | 'ocr-fallback' | 'file';
  difyFileId?: string;
  difyFileIds?: Record<string, string>;
  difyUploadErrors?: string[];
}

export type InputMode = 'text' | 'multimodal';
export type LanguageCode = 'auto' | 'zh-CN' | 'en-US' | 'ja-JP' | 'ko-KR';
export type TranslationInputConfig = {
  enabled: boolean;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
};

export interface ServiceHours {
  enabled: boolean;
  workdays: string;
  start: string;
  end: string;
  offHoursMessage: string;
}

export interface ChatAction {
  type: 'navigate' | 'ticket';
  label: string;
  path?: string;
  url?: string;
  description?: string;
}

export interface WorkflowAction {
  action: string;
  description: string;
  confidence: number;
  tool?: string;
  whitelist_ok?: boolean;
}

export interface WorkflowTrace {
  trace_id: string;
  trace_version: string;
  created_at: string;
  status: 'blocked' | 'approved';
  input_summary: {
    actor: string;
    input_mode: 'text' | 'multimodal';
    source_language: string;
    target_language: string;
    translation_state: string;
    attachment_count: number;
    requires_visual_payload: boolean;
  };
  agent1_multimodal: {
    page_type: string;
    context: string;
    confidence: number;
    evidence_ids: string[];
    structured_blocks: Array<{
      type: string;
      title: string;
      source_span?: {
        file_id: string;
        source_type: string;
        region: string;
        bbox: string;
      };
      confidence: number;
    }>;
    ambiguity: string;
  };
  agent2_intent: {
    category: string;
    priority: string;
    confidence: number;
    tool: string;
    rationale: string;
    explanation: string;
  };
  agent3_execution: {
    plan: WorkflowAction[];
    action_policy: WorkflowAction[];
    whitelist_ok: boolean;
    can_execute: boolean;
    confidence: number;
    risk_assessment?: string;
  };
  agent4_security: {
    requires_confirmation: boolean;
    requires_clarify: boolean;
    risk_level: string;
    reasons: string[];
    confirmation_template: {
      action_object: string;
      impact_scope: string;
      risk_level: string;
      rollback_possible: string;
    };
    policy_version: string;
    can_return: boolean;
  };
  execution_path?: Array<{
    node_id: string;
    name: string;
    status: 'done' | 'pending' | 'skipped' | string;
  }>;
  resolution?: {
    needs_confirmation: boolean;
    confidence: number;
    ambiguity: string;
    recommended_actions: string[];
    fallback: string;
  };
}

export interface WorkflowAudit {
  trace_id: string;
  sessionId: string;
  identity: Identity;
  text: string;
  createdAt: string;
  status: 'blocked' | 'approved';
  requiresConfirmation: boolean;
  intent: string;
  riskLevel: string;
  confirmationTemplate: WorkflowTrace['agent4_security']['confirmation_template'];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'staff' | 'system';
  text: string;
  files?: UploadedFile[];
  category?: string;
  priority?: string;
  source?: 'dify' | 'deepseek' | 'mock' | 'fallback';
  agent?: Agent;
  citations?: Array<{
    label: string;
    value: string;
  }>;
  actions?: ChatAction[];
  agentTrace?: WorkflowTrace;
  reasoning?: {
    title: string;
    source: string;
    sourceLabel: string;
    model?: string;
    summary: string[];
    evidence: {
      attachmentCount: number;
      imageCount: number;
      inputMode: string;
      pageType: string;
      confidence: number;
      canExecute: boolean;
      blocked: boolean;
      reasons: string[];
      fallbackReason?: string;
    };
    workflowEvents?: Array<{
      id: string;
      title: string;
      type: string;
      status: string;
      index?: number | null;
      elapsedTime?: number | null;
    }>;
  };
  trace_id?: string;
  createdAt: string;
}

export interface ConversationHistoryMessage {
  id: string;
  role: 'user' | 'assistant' | 'staff' | 'system';
  sender: string;
  text: string;
  createdAt: string;
}

export interface ConversationHistory {
  id: string;
  title: string;
  type: 'ai' | 'service';
  identity: Identity;
  channel: string;
  status: string;
  staffName?: string;
  ticketId?: string;
  updatedAt: string;
  messages: ConversationHistoryMessage[];
}

export interface BootstrapPayload {
  quickQuestions: QuickQuestion[];
  tickets: Ticket[];
  conversationHistories: ConversationHistory[];
  agents: Agent[];
  supportStaff: SupportStaff[];
  serviceHours: ServiceHours;
  difyConnected: boolean;
  integrationSources?: {
    dataSource: {
      source: string;
      label: string;
      enabled: boolean;
      endpointCount: number;
      writeEnabled: boolean;
    };
    aiSource: {
      source: string;
      label: string;
      connected: boolean;
      appMode: string;
      modelProfile: string;
      directMultimodal: boolean;
      strictMultimodal: boolean;
      localOcrEnabled: boolean;
    };
    originalAiSource: {
      source: string;
      label: string;
      enabled: boolean;
      endpointCount: number;
      usage: string;
    };
  };
  customerAiRemote?: {
    enabled: boolean;
    ok: boolean;
    endpoints: number;
    remoteAiEnabled?: boolean;
    successfulReads?: number;
    failedReads?: number;
    stored?: boolean;
    storedAt?: string;
    storedCounts?: {
      quickQuestions: number;
      tickets: number;
      conversationHistories: number;
    };
  };
}

export interface ChatResult {
  sessionId: string;
  message: ChatMessage;
  pendingTicket: boolean;
}

export interface TicketChatMessage {
  id: string;
  role: 'staff' | 'system';
  sender: string;
  text: string;
  createdAt: string;
}

const API_BASE_URL = (() => {
  const raw = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) ? String(import.meta.env.VITE_API_BASE_URL) : '';
  return raw.trim().replace(/\/$/, '');
})();
const normalizeApiBaseError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return '';
  }
  return `${error.name}:${error.message}`;
};
const isNetworkFetchError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = normalizeApiBaseError(error).toLowerCase();
  return (
    error instanceof TypeError &&
    (message.includes('failed to fetch') || message.includes('networkerror') || message.includes('network error') || message.includes('fetch failed'))
  );
};

function resolveApiPath(path: string) {
  if (API_BASE_URL && path.startsWith('/')) {
    return `${API_BASE_URL}${path}`;
  }
  if (API_BASE_URL && !/^https?:\/\//i.test(path)) {
    return `${API_BASE_URL}/${path}`;
  }
  return path;
}

function buildOfflineBootstrapPayload(): BootstrapPayload {
  return {
    quickQuestions: [],
    tickets: [],
    conversationHistories: [],
    agents: [],
    supportStaff: [],
    serviceHours: {
      enabled: true,
      workdays: '周一至周五',
      start: '09:00',
      end: '18:00',
      offHoursMessage: '当前后端服务未连接，正在离线模式展示。'
    },
    difyConnected: false
  };
}

async function request<T>(path: string, options?: RequestInit, useBase = true): Promise<T> {
  const response = await fetch(useBase ? resolveApiPath(path) : path, {
    headers: options?.body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
    ...options
  });

  if (!response.ok) {
    const text = await response.text();
    let message = text;
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed.message === 'string' && parsed.message.length > 0) {
        message = parsed.message;
      }
    } catch {
      // keep raw text
    }
    throw new Error(message || `${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

let bootstrapRequest: Promise<BootstrapPayload> | null = null;

export function getBootstrap() {
  if (!bootstrapRequest) {
    bootstrapRequest = request<BootstrapPayload>('/api/bootstrap').catch(async (error) => {
      if (isNetworkFetchError(error)) {
        if (API_BASE_URL) {
          try {
            return await request<BootstrapPayload>('/api/bootstrap', undefined, false);
          } catch (fallbackError) {
            if (!isNetworkFetchError(fallbackError)) {
              bootstrapRequest = null;
              throw fallbackError;
            }
          }
        }
        return buildOfflineBootstrapPayload();
      }
      bootstrapRequest = null;
      throw error;
    });
  }
  return bootstrapRequest;
}

export function createSession(identity: Identity) {
  return request<{ id: string }>('/api/chat/start', {
    method: 'POST',
    body: JSON.stringify({ identity })
  });
}

export function sendChatMessage(payload: {
  sessionId?: string;
  text: string;
  identity: Identity;
  files: UploadedFile[];
  inputMode?: InputMode;
  translation?: TranslationInputConfig;
}) {
  return request<ChatResult>('/api/chat/message', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function getWorkflowAudits(params: { limit?: number; traceId?: string } = {}) {
  const search = new URLSearchParams();
  if (params.limit) search.set('limit', String(params.limit));
  if (params.traceId) search.set('trace_id', params.traceId);
  const suffix = search.toString() ? `?${search.toString()}` : '';
  return request<{ total: number; items: WorkflowAudit[] }>(`/api/workflow/audits${suffix}`);
}

export function uploadFile(file: File) {
  const form = new FormData();
  form.append('file', file);
  return request<UploadedFile>('/api/upload', {
    method: 'POST',
    body: form
  });
}

export function createTicket(payload: Partial<Ticket>) {
  return request<Ticket>('/api/tickets', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updateTicket(id: string, payload: Partial<Ticket>) {
  return request<Ticket>(`/api/tickets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export function transferTicket(ticketId: string, staffId: string, reason: string, actorRole: 'customer' | 'support' = 'customer') {
  return request<Ticket>(`/api/tickets/${ticketId}/transfer`, {
    method: 'POST',
    body: JSON.stringify({ staffId, reason, actorRole })
  });
}

export function sendTicketMessage(ticketId: string, text: string) {
  return request<{ ticket: Ticket; message: TicketChatMessage }>(`/api/tickets/${ticketId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ text })
  });
}

export function createQuickQuestion(payload: Omit<QuickQuestion, 'id'>) {
  return request<QuickQuestion>('/api/quick-questions', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function updateQuickQuestion(id: string, payload: Partial<QuickQuestion>) {
  return request<QuickQuestion>(`/api/quick-questions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}
