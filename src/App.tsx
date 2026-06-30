import {
  AlertCircle,
  ArrowLeft,
  Bot,
  ChevronRight,
  Clock3,
  FileText,
  Frown,
  Headphones,
  History,
  ImageUp,
  Laugh,
  Loader2,
  Meh,
  MessageCircle,
  Mic,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Send,
  Smile,
  Star,
  TicketCheck,
  X
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  ChangeEvent,
  DragEvent,
  FormEvent,
  PointerEvent as ReactPointerEvent,
  RefObject
} from 'react';
import {
  BootstrapPayload,
  ChatAction,
  ChatMessage,
  Identity,
  QuickQuestion,
  SupportStaff,
  Ticket,
  UploadedFile,
  createSession,
  createTicket,
  getBootstrap,
  sendChatMessage,
  sendTicketMessage,
  transferTicket,
  uploadFile
} from './api';

type AssistantSize = 'phone' | 'desktop';
type InputMode = 'text' | 'multimodal';
type LanguageCode = 'auto' | 'zh-CN' | 'en-US' | 'ja-JP' | 'ko-KR';
type AssistantSection = 'chat' | 'history' | 'tickets';
type TicketView = 'create' | 'list';
type HistoryFilter = 'all' | 'ai' | 'service';
type RatingScore = 1 | 2 | 3 | 4 | 5;
type ConversationHistoryRecord = BootstrapPayload['conversationHistories'][number];
type CurrentUser = { name: string; account: string; org: string; phone: string; role: 'customer' | 'support' };
type TicketFormState = {
  problemType: string;
  feedback: string;
  userName: string;
  phone: string;
  storeCode: string;
  nickname: string;
  contact: string;
  partnerType: string;
  companyName: string;
  sapCode: string;
  feedbackAt: string;
  province: string;
  city: string;
  district: string;
};
type TranslationInputConfig = {
  enabled: boolean;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
};
type VoicePermissionState = 'unknown' | 'prompt' | 'granted' | 'denied' | 'unsupported';
type SpeechRecognitionAlternativeLike = {
  transcript: string;
};
type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
};
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};
type SpeechRecognitionErrorEventLike = {
  error: string;
};
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: null | (() => void);
  onend: null | (() => void);
  onerror: null | ((event: SpeechRecognitionErrorEventLike) => void);
  onresult: null | ((event: SpeechRecognitionEventLike) => void);
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
type SpeechRecognitionWindow = Window &
  typeof globalThis & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
type NavigateActionLike = Omit<ChatAction, 'type'>;

const identities: Identity[] = ['供应商', '加盟商', '员工', '经销商'];
const quickQuestionPresets: Record<Identity, Array<{ id: string; title: string; agent: string }>> = {
  供应商: [
    { id: 'preset-supplier-1', title: '我这边还有哪些待办没处理？', agent: 'agent-business' },
    { id: 'preset-supplier-2', title: '合同授权卡在待确认，下一步怎么做？', agent: 'agent-knowledge' },
    { id: 'preset-supplier-3', title: '供应商资料提交后多久能审核完？', agent: 'agent-knowledge' },
    { id: 'preset-supplier-4', title: '这个账号为什么看不到结算入口？', agent: 'agent-business' },
    { id: 'preset-supplier-5', title: '我想补传营业执照，在哪里操作？', agent: 'agent-knowledge' },
    { id: 'preset-supplier-6', title: 'SAP 编码和主体名称不一致怎么办？', agent: 'agent-business' },
    { id: 'preset-supplier-7', title: '入驻完成后先做哪三步？', agent: 'agent-knowledge' },
    { id: 'preset-supplier-8', title: '待办超过 3 天未处理可以找谁？', agent: 'agent-feishu' }
  ],
  加盟商: [
    { id: 'preset-franchise-1', title: '我刚提交加盟资料，下一步做什么？', agent: 'agent-knowledge' },
    { id: 'preset-franchise-2', title: '今天还有哪些加盟待办没完成？', agent: 'agent-business' },
    { id: 'preset-franchise-3', title: '商机报名后多久会有人联系我？', agent: 'agent-knowledge' },
    { id: 'preset-franchise-4', title: '意向城市填错了怎么修改？', agent: 'agent-business' },
    { id: 'preset-franchise-5', title: '门店审核卡在待确认怎么办？', agent: 'agent-business' },
    { id: 'preset-franchise-6', title: '培训通知和开店资料在哪里看？', agent: 'agent-knowledge' },
    { id: 'preset-franchise-7', title: '保证金资料补交入口在哪？', agent: 'agent-business' },
    { id: 'preset-franchise-8', title: '注册流程能发我一下吗？', agent: 'agent-knowledge' }
  ],
  员工: [
    { id: 'preset-staff-1', title: '今天还有哪些客户待回访？', agent: 'agent-feishu' },
    { id: 'preset-staff-2', title: '哪几张工单超过一周还没结案？', agent: 'agent-business' },
    { id: 'preset-staff-3', title: '待审核的待办有哪些？', agent: 'agent-business' },
    { id: 'preset-staff-4', title: '这个客户应该转给哪个组？', agent: 'agent-feishu' },
    { id: 'preset-staff-5', title: '账号权限类工单怎么判断优先级？', agent: 'agent-knowledge' },
    { id: 'preset-staff-6', title: '飞书通知失败的工单有哪些？', agent: 'agent-feishu' },
    { id: 'preset-staff-7', title: '哪些会话已经接入人工但还没回复？', agent: 'agent-business' },
    { id: 'preset-staff-8', title: '本周投诉类工单有几单？', agent: 'agent-business' }
  ],
  经销商: [
    { id: 'preset-distributor-1', title: '本周待处理订单有哪些？', agent: 'agent-business' },
    { id: 'preset-distributor-2', title: '经销商合同授权状态怎么查？', agent: 'agent-knowledge' },
    { id: 'preset-distributor-3', title: '哪些门店还没完成对账？', agent: 'agent-business' },
    { id: 'preset-distributor-4', title: '返利申请提交后多久审核？', agent: 'agent-knowledge' },
    { id: 'preset-distributor-5', title: '库存预警在哪里看？', agent: 'agent-business' },
    { id: 'preset-distributor-6', title: '渠道价格有变更怎么确认？', agent: 'agent-knowledge' },
    { id: 'preset-distributor-7', title: '超过一周的待办有哪些？', agent: 'agent-business' },
    { id: 'preset-distributor-8', title: '账号被停用后怎么恢复？', agent: 'agent-knowledge' }
  ]
};
const visionRequestPattern = /(截图|截屏|图片|照片|相片|界面截图|页面截图|界面|页面|二维码|条码|票据|发票|OCR|ocr|视觉|多模态|识别|看.*(图|张|界面|页面)|这张(图|图片|截图|照片))/;
const isImageFile = (mime: string) => mime.startsWith('image/');
const isVisionRequest = (text: string) => visionRequestPattern.test(text);
const NAV_PLATFORM_BASE_URL = (() => {
  const envValue =
    typeof import.meta !== 'undefined' &&
    import.meta &&
    (import.meta as unknown as { env?: Record<string, string> }).env &&
    typeof (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_COLLAB_PLATFORM_BASE_URL === 'string'
      ? String((import.meta as unknown as { env?: Record<string, string> }).env!.VITE_COLLAB_PLATFORM_BASE_URL)
      : '';
  return (envValue || 'https://scm.test.laiyifen.com/webadmin_vue/collaborationPlatform.html')
    .trim()
    .replace(/#.*$/, '')
    .replace(/\/+$/, '');
})();
const NAV_PUBLIC_BASE_URL = (() => {
  const envValue =
    typeof import.meta !== 'undefined' &&
    import.meta &&
    (import.meta as unknown as { env?: Record<string, string> }).env &&
    typeof (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_COLLAB_PUBLIC_BASE_URL === 'string'
      ? String((import.meta as unknown as { env?: Record<string, string> }).env!.VITE_COLLAB_PUBLIC_BASE_URL)
      : '';
  return (envValue || 'https://www.laiyifen.com').trim().replace(/\/+$/, '');
})();
const NAV_PLATFORM_ROUTE_MAP: Record<string, string> = {
  home: 'home',
  '/home': 'home',
  personal: 'personal',
  '/personal': 'personal',
  platform: 'home',
  'platform-home': 'home',
  'platform-todo': 'personal',
  'platform-contract': 'templateManage/templateBase',
  'platform-settlement': 'reconciliation/virify/paymentData',
  'platform-supplier-profile': 'personal',
  'platform-account': 'personal',
  'platform-store-task': 'personal',
  'platform-distributor-order': 'sales/collageOrder/1',
  'platform-commodity-summary': 'sales/commoditySummary',
  'platform-feedback': 'feedback',
  'platform-phone-change': 'phoneNumberForm',
  'platform-esign-org': 'electrosignature/basicInfo/elecOrganizationList',
  'platform-franchise-opportunity': 'bejoiner',
  'integrity-platform': 'actionNorm',
  'platform-integrity': 'actionNorm'
};
const NAV_PUBLIC_ROUTE_MAP: Record<string, string> = {
  bejoiner: 'bejoiner',
  'platform-franchise-opportunity': 'bejoiner',
  'franchise-public': 'bejoiner',
  beagency: 'beagency',
  'agency-public': 'beagency',
  contact: 'contact',
  'contact-public': 'contact',
  company: 'company',
  'company-public': 'company',
  brand: 'brand',
  'brand-public': 'brand'
};
const DEFAULT_NAV_PLATFORM_URL = `${NAV_PLATFORM_BASE_URL}#/home`;

function isAbsoluteHttpUrl(value?: string) {
  return typeof value === 'string' && /^[a-z][a-z0-9+.-]*:\/\//i.test(value.trim());
}

function normalizeRelativeNavigationTarget(rawTarget?: string) {
  const target = (rawTarget || '').trim();
  if (!target) {
    return DEFAULT_NAV_PLATFORM_URL;
  }
  if (isAbsoluteHttpUrl(target)) return target;
  if (target.startsWith('#/')) {
    return `${NAV_PLATFORM_BASE_URL}${target}`;
  }
  if (target.startsWith('/')) {
    return `${NAV_PLATFORM_BASE_URL}#/${target.replace(/^\/+/, '')}`;
  }

  const publicRoute =
    NAV_PUBLIC_ROUTE_MAP[target] ||
    NAV_PUBLIC_ROUTE_MAP[target.replace(/^\/+/, '')] ||
    NAV_PUBLIC_ROUTE_MAP[target.replace(/#\/+/g, '')];
  if (publicRoute) {
    return `${NAV_PUBLIC_BASE_URL}/${publicRoute}`;
  }

  const platformRoute =
    NAV_PLATFORM_ROUTE_MAP[target] ||
    NAV_PLATFORM_ROUTE_MAP[target.replace(/^\/+/, '')] ||
    NAV_PLATFORM_ROUTE_MAP[target.replace(/#\/+/g, '')];
  if (platformRoute) {
    return `${NAV_PLATFORM_BASE_URL}#/${platformRoute}`;
  }

  return `${NAV_PLATFORM_BASE_URL}#/${target.replace(/^\/+/, '')}`;
}

function resolveNavigateUrl(action?: NavigateActionLike | string) {
  const target = typeof action === 'string' ? { path: action, label: action, url: '' } : action;
  const directUrl = target?.url?.trim() || target?.path || '';
  return normalizeRelativeNavigationTarget(directUrl);
}

function getSpeechRecognitionConstructor() {
  if (typeof window === 'undefined') return null;
  const speechWindow = window as SpeechRecognitionWindow;
  return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition || null;
}

function normalizeVoicePermissionState(state?: string): VoicePermissionState {
  if (state === 'granted' || state === 'denied' || state === 'prompt') return state;
  return 'unknown';
}

function clampSize(value: number, min: number, max: number) {
  return max <= min ? max : Math.min(Math.max(value, min), max);
}

function getCanvasBounds() {
  const margin = window.innerWidth >= 900 ? 36 : 20;
  const maxWidth = window.innerWidth - margin;
  const maxHeight = window.innerHeight - margin;

  return {
    maxWidth,
    maxHeight,
    minWidth: 320,
    minHeight: 360,
    width: maxWidth <= 320 ? maxWidth : clampSize(maxWidth, 320, maxWidth),
    height: maxHeight <= 360 ? maxHeight : clampSize(maxHeight, 360, maxHeight)
  };
}

function getViewportDimensions() {
  if (typeof window === 'undefined') {
    return { width: 390, height: 844 };
  }
  const { width, height } = getCanvasBounds();
  return {
    width,
    height
  };
}

function getDateTimeLocalValue() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 16);
}

function getDefaultTicketForm(identity: Identity, currentUser: CurrentUser): TicketFormState {
  return {
    problemType: '',
    feedback: '',
    userName: currentUser.name,
    phone: currentUser.phone,
    storeCode: '',
    nickname: currentUser.name,
    contact: currentUser.phone,
    partnerType: identity,
    companyName: currentUser.org,
    sapCode: currentUser.account,
    feedbackAt: getDateTimeLocalValue(),
    province: '',
    city: '',
    district: ''
  };
}

function getHistoryTypeLabel(record: ConversationHistoryRecord) {
  return record.type === 'service' ? '客服对话' : 'AI对话';
}

function getHistoryExcerpt(record: ConversationHistoryRecord) {
  const latest = record.messages[record.messages.length - 1];
  return latest?.text || '暂无对话内容';
}

function formatHistoryTime(value: string) {
  if (!value) return '-';
  const normalized = value.replace('T', ' ');
  if (normalized.length >= 16 && normalized.slice(0, 4).match(/\d{4}/)) {
    return normalized.slice(5, 16);
  }
  return normalized;
}

function parseHistoryDate(value: string) {
  if (!value) return null;

  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) {
    return direct;
  }

  const normalized = value
    .trim()
    .replace(/\./g, '/')
    .replace(/年/g, '/')
    .replace(/月/g, '/')
    .replace(/日/g, '')
    .replace(/\//g, '-');
  const isoLike = normalized.includes('T') ? normalized : normalized.replace(' ', 'T');
  const parsed = new Date(isoLike);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatHistoryRelativeTime(value: string) {
  const parsed = parseHistoryDate(value);
  if (!parsed) return '-';

  const diffMs = Math.max(0, Date.now() - parsed.getTime());
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;
  const monthMs = 30 * dayMs;
  const yearMs = 365 * dayMs;

  if (diffMs < hourMs) {
    return `${Math.max(1, Math.floor(diffMs / minuteMs))}m`;
  }
  if (diffMs < dayMs) {
    return `${Math.floor(diffMs / hourMs)}h`;
  }
  if (diffMs < monthMs) {
    return `${Math.floor(diffMs / dayMs)}d`;
  }
  if (diffMs < yearMs) {
    return `${Math.floor(diffMs / monthMs)}mo`;
  }
  return `${Math.floor(diffMs / yearMs)}y`;
}

function truncateText(value: string, maxLength = 18) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

function getConversationTitleFromMessages(messages: ChatMessage[], fallback = '当前对话') {
  const firstUserMessage = messages.find((message) => message.role === 'user' && message.text.trim());
  const firstMeaningfulMessage =
    firstUserMessage ||
    messages.find((message) => (message.role === 'assistant' || message.role === 'staff') && message.text.trim()) ||
    messages.find((message) => message.text.trim());

  return truncateText(firstMeaningfulMessage?.text || '', 20) || fallback;
}

function isInternalCitation(item: { label: string; value: string }) {
  if (item.label === '模式') return false;
  const normalized = `${item.label} ${item.value}`.toLowerCase();
  return /workflow|dify|处理链路|智能体路由|workflow 输入|trace/.test(normalized);
}

function buildQuickQuestionPool(identity: Identity, fallbackQuestions: QuickQuestion[]) {
  const presets = quickQuestionPresets[identity];
  if (presets.length > 0) {
    return presets.map((item, index) => ({
      id: item.id,
      title: item.title,
      identity,
      sort: index + 1,
      enabled: true,
      agent: item.agent
    }));
  }

  return fallbackQuestions
    .filter((question) => question.identity === identity && question.enabled)
    .sort((a, b) => a.sort - b.sort);
}

function App() {
  const [data, setData] = useState<BootstrapPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [identity, setIdentity] = useState<Identity>('供应商');

  useEffect(() => {
    getBootstrap()
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleTicketCreated = (ticket: Ticket) => {
    setData((current) => {
      if (!current) return current;
      return {
        ...current,
        tickets: [ticket, ...current.tickets.filter((item) => item.id !== ticket.id)]
      };
    });
  };

  const handleTicketUpdated = (ticket: Ticket) => {
    setData((current) => {
      if (!current) return current;
      return {
        ...current,
        tickets: current.tickets.map((item) => (item.id === ticket.id ? ticket : item))
      };
    });
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <Loader2 className="spin" size={28} />
        <span>正在加载 来伊份 AI 客服助手 小伊...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="loading-screen">
        <AlertCircle size={28} />
        <span>{error || '服务端暂不可用'}</span>
      </div>
    );
  }

  return (
    <div className="ai-page">
      <AssistantSurface
        data={data}
        identity={identity}
        setIdentity={setIdentity}
        onTicketCreated={handleTicketCreated}
        onTicketUpdated={handleTicketUpdated}
      />
    </div>
  );
}

function AssistantSurface({
  data,
  identity,
  setIdentity,
  onTicketCreated,
  onTicketUpdated
}: {
  data: BootstrapPayload;
  identity: Identity;
  setIdentity: (identity: Identity) => void;
  onTicketCreated: (ticket: Ticket) => void;
  onTicketUpdated: (ticket: Ticket) => void;
}) {
  const [dimensions, setDimensions] = useState(getViewportDimensions);
  const size: AssistantSize = dimensions.width >= 760 ? 'desktop' : 'phone';
  const [section, setSection] = useState<AssistantSection>('chat');
  const [ticketView, setTicketView] = useState<TicketView>('create');
  const [selectedHistoryId, setSelectedHistoryId] = useState('current');
  const [sessionId, setSessionId] = useState('');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [manualTicket, setManualTicket] = useState<Ticket | null>(null);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [ratingScore, setRatingScore] = useState<RatingScore>(5);
  const [questionOffset, setQuestionOffset] = useState(0);
  const [attachments, setAttachments] = useState<UploadedFile[]>([]);
  const [previewFile, setPreviewFile] = useState<UploadedFile | null>(null);
  const [inputMode] = useState<InputMode>('text');
  const [voiceSupported, setVoiceSupported] = useState(() => Boolean(getSpeechRecognitionConstructor()));
  const [voiceListening, setVoiceListening] = useState(false);
  const [voicePermissionState, setVoicePermissionState] = useState<VoicePermissionState>('unknown');
  const [translationConfig] = useState<TranslationInputConfig>({
    enabled: false,
    sourceLanguage: 'auto',
    targetLanguage: 'zh-CN'
  });
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: '你好，我是小伊!有什么可以帮您的?',
      source: 'mock',
      createdAt: new Date().toISOString()
    }
  ]);
  const fileRef = useRef<HTMLInputElement>(null);
  const voiceRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const voiceTranscriptRef = useRef('');
  const voiceInputBaseRef = useRef('');

  const clampDimensions = (width: number, height: number) => {
    const { maxWidth, maxHeight, minWidth, minHeight } = getCanvasBounds();
    return {
      width: clampSize(width, minWidth, maxWidth),
      height: clampSize(height, minHeight, maxHeight)
    };
  };

  useEffect(() => {
    const syncToViewport = () => {
      setDimensions(getViewportDimensions());
    };
    window.addEventListener('resize', syncToViewport);
    return () => window.removeEventListener('resize', syncToViewport);
  }, []);

  useEffect(() => {
    setVoiceSupported(Boolean(getSpeechRecognitionConstructor()));
    return () => {
      voiceRecognitionRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.navigator?.permissions?.query) return;

    let active = true;
    let permissionStatus: PermissionStatus | null = null;

    void window.navigator.permissions
      .query({ name: 'microphone' as PermissionName })
      .then((result) => {
        if (!active) return;
        permissionStatus = result;
        setVoicePermissionState(normalizeVoicePermissionState(result.state));
        result.onchange = () => {
          setVoicePermissionState(normalizeVoicePermissionState(result.state));
        };
      })
      .catch(() => {
        if (!active) return;
        setVoicePermissionState((current) => (current === 'unknown' ? 'prompt' : current));
      });

    return () => {
      active = false;
      if (permissionStatus) {
        permissionStatus.onchange = null;
      }
    };
  }, []);

  useEffect(() => {
    setQuestionOffset(0);
  }, [identity]);

  const handleResizeStart = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const start = {
      x: event.clientX,
      y: event.clientY,
      width: dimensions.width,
      height: dimensions.height
    };

    const handleMove = (moveEvent: PointerEvent) => {
      setDimensions(clampDimensions(start.width + moveEvent.clientX - start.x, start.height + moveEvent.clientY - start.y));
    };

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  const quickQuestionPool = useMemo(() => buildQuickQuestionPool(identity, data.quickQuestions), [data.quickQuestions, identity]);
  const questionPageSize = size === 'phone' ? 4 : 6;
  const visibleQuestions = useMemo(() => {
    if (quickQuestionPool.length === 0) return [];
    const visibleCount = Math.min(questionPageSize, quickQuestionPool.length);
    const start = (questionOffset * visibleCount) % quickQuestionPool.length;
    return Array.from({ length: visibleCount }, (_, index) => quickQuestionPool[(start + index) % quickQuestionPool.length]);
  }, [quickQuestionPool, questionOffset, questionPageSize]);

  const currentUser = useMemo(() => {
    const profiles: Record<Identity, CurrentUser> = {
      供应商: { name: '王敏', account: '00095129', org: '供应商协同平台', phone: '13800009529', role: 'customer' },
      加盟商: { name: '李然', account: 'FR20260629', org: '加盟商工作台', phone: '13900002026', role: 'customer' },
      员工: { name: '赵启', account: 'E10086', org: '来伊份内部员工', phone: '13700001086', role: 'customer' },
      经销商: { name: '周宁', account: 'D20260629', org: '经销商协同平台', phone: '13600002029', role: 'customer' }
    };
    return profiles[identity];
  }, [identity]);

  const conversationHistories = useMemo<ConversationHistoryRecord[]>(() => {
    const hasCurrentConversation = messages.length > 1;
    const currentConversation = hasCurrentConversation
      ? {
          id: 'current',
          title: manualTicket?.title || getConversationTitleFromMessages(messages.slice(1)),
          type: manualTicket ? ('service' as const) : ('ai' as const),
          identity,
          channel: '共创',
          status: manualTicket?.status || (sending || transferring || uploading ? '处理中' : '进行中'),
          staffName: manualTicket?.currentStaff,
          ticketId: manualTicket?.id,
          updatedAt: messages[messages.length - 1]?.createdAt || new Date().toISOString(),
          messages: messages.map((message) => ({
            id: message.id,
            role: message.role,
            sender:
              message.role === 'user'
                ? currentUser.name
                : message.role === 'assistant'
                  ? '小伊'
                  : message.role === 'staff'
                    ? message.agent?.name || manualTicket?.currentStaff || '人工客服'
                    : '系统',
            text: message.text,
            createdAt: message.createdAt
          }))
        }
      : null;

    return currentConversation ? [currentConversation, ...data.conversationHistories] : data.conversationHistories;
  }, [currentUser.name, data.conversationHistories, identity, manualTicket, messages, sending, transferring, uploading]);
  const recentHistories = data.conversationHistories;

  const removeAttachment = (fileId: string) => {
    setAttachments((current) => current.filter((file) => file.id !== fileId));
  };

  const handleSectionChange = (nextSection: AssistantSection) => {
    if (nextSection === 'tickets') {
      setTicketView('create');
    }
    setSection(nextSection);
  };

  const pushSystemMessage = (text: string) => {
    setMessages((current) => [
      ...current,
      {
        id: `system-${Date.now()}`,
        role: 'system',
        text,
        createdAt: new Date().toISOString()
      }
    ]);
  };

  const sendText = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending || uploading) return;
    if (voiceListening) {
      voiceRecognitionRef.current?.stop();
      setVoiceListening(false);
    }

    const needsVision = isVisionRequest(trimmed) || inputMode === 'multimodal';
    const hasImageAttachment = attachments.some((file) => isImageFile(file.mime));

    if (inputMode === 'multimodal' && !hasImageAttachment) {
      setMessages((current) => [
        ...current,
        {
          id: `system-${Date.now()}`,
          role: 'system',
          text: '已切换到多模态输入，请先上传图片或截图后再提问。',
          createdAt: new Date().toISOString()
        }
      ]);
      return;
    }

    if (needsVision && !hasImageAttachment) {
      setMessages((current) => [
        ...current,
        {
          id: `system-${Date.now()}`,
          role: 'system',
          text: '检测到该问题为视觉理解场景，请先上传图片、截图或相关文件后再提问。',
          createdAt: new Date().toISOString()
        }
      ]);
      return;
    }

    setSending(true);
    setInput('');
    const userMessage: ChatMessage = {
      id: `local-${Date.now()}`,
      role: 'user',
      text: trimmed,
      files: attachments,
      createdAt: new Date().toISOString()
    };
    setMessages((current) => [...current, userMessage]);

    try {
      if (manualTicket) {
        const result = await sendTicketMessage(manualTicket.id, trimmed);
        setManualTicket(result.ticket);
        onTicketUpdated(result.ticket);
        setMessages((current) => [
          ...current,
          {
            id: result.message.id,
            role: 'staff',
            text: result.message.text,
            source: 'mock',
            agent: {
              id: 'manual-service',
              name: result.message.sender,
              owner: '客户接入接口',
              status: 'online',
              duty: '接入客服会话',
              api: '/api/tickets/:id/messages'
            },
            createdAt: result.message.createdAt
          }
        ]);
        setAttachments([]);
        return;
      }

      let currentSessionId = sessionId;
      if (!currentSessionId) {
        const session = await createSession(identity);
        currentSessionId = session.id;
        setSessionId(session.id);
      }
      const result = await sendChatMessage({
        sessionId: currentSessionId,
        text: trimmed,
        identity,
        files: attachments,
        inputMode,
        translation: translationConfig
      });
      setSessionId(result.sessionId);
      setMessages((current) => [...current, result.message]);
      setAttachments([]);
    } catch (err) {
      const message = err instanceof Error ? err.message : '请求失败';
      setMessages((current) => [
        ...current,
        {
          id: `error-${Date.now()}`,
          role: 'system',
          text: `发送失败：${message}`,
          createdAt: new Date().toISOString()
        }
      ]);
    } finally {
      setSending(false);
    }
  };

  const sendAndOpenChat = async (text: string) => {
    setSection('chat');
    await sendText(text);
  };

  const handleUpload = async (file?: File) => {
    if (!file) return;
    try {
      setUploading(true);
      const uploaded = await uploadFile(file);
      setAttachments((current) => [...current, uploaded]);
    } catch (err) {
      const message = err instanceof Error ? err.message : '上传失败';
      setMessages((current) => [
        ...current,
        {
          id: `upload-error-${Date.now()}`,
          role: 'system',
          text: `文件上传失败：${message}`,
          createdAt: new Date().toISOString()
        }
      ]);
    } finally {
      setUploading(false);
    }
  };

  const handleHumanTransfer = async () => {
    if (manualTicket) {
      setSection('chat');
      setMessages((current) => [
        ...current,
        {
          id: `ticket-active-${Date.now()}`,
          role: 'system',
          text: `接入客服正在当前会话中处理，工单号：${manualTicket.id}。请直接在输入框继续沟通。`,
          createdAt: new Date().toISOString()
        }
      ]);
      return;
    }
    if (transferring) return;
    setTransferring(true);
    const lastUserText = [...messages].reverse().find((item) => item.role === 'user')?.text || '用户请求转人工';
    try {
      const ticket = await createTicket({
        title: lastUserText.slice(0, 50),
        identity,
        userName: currentUser.name,
        phone: currentUser.phone,
        summary: `小伊会话转人工：${lastUserText}`,
        channel: '共创'
      });
      setManualTicket(ticket);
      onTicketCreated(ticket);
      setSection('chat');
      setMessages((current) => [
        ...current,
        {
          id: `ticket-${ticket.id}`,
          role: 'staff',
          text: `您好，我是${ticket.currentStaff}，当前通过客户接入接口继续为您处理。请在当前对话补充问题或截图，我会直接在这里跟进。工单号：${ticket.id}`,
          source: 'mock',
          agent: {
            id: 'manual-service',
            name: ticket.currentStaff,
            owner: '客户接入接口',
            status: 'online',
            duty: '接入客服会话',
            api: '/api/tickets/:id/messages'
          },
          createdAt: new Date().toISOString()
        }
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : '转人工失败';
      setMessages((current) => [
        ...current,
        {
          id: `ticket-error-${Date.now()}`,
          role: 'system',
          text: `转人工失败：${message}`,
          createdAt: new Date().toISOString()
        }
      ]);
      setSection('chat');
    } finally {
      setTransferring(false);
    }
  };

  const requestMicrophoneAccess = async () => {
    if (typeof window === 'undefined') {
      return { ok: false as const, reason: 'unsupported' as const };
    }

    const mediaDevices = window.navigator?.mediaDevices;
    if (!mediaDevices?.getUserMedia) {
      return { ok: true as const, skipped: true as const };
    }

    try {
      const stream = await mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setVoicePermissionState('granted');
      return { ok: true as const, skipped: false as const };
    } catch (error) {
      const name =
        typeof error === 'object' && error && 'name' in error
          ? String((error as { name?: unknown }).name || '')
          : '';

      if (['NotAllowedError', 'PermissionDeniedError', 'SecurityError'].includes(name)) {
        setVoicePermissionState('denied');
        return { ok: false as const, reason: 'denied' as const };
      }

      if (['NotFoundError', 'DevicesNotFoundError'].includes(name)) {
        return { ok: false as const, reason: 'missing-device' as const };
      }

      return { ok: false as const, reason: 'unavailable' as const };
    }
  };

  const handleVoiceInput = async () => {
    if (sending || uploading) return;

    if (voiceListening) {
      voiceRecognitionRef.current?.stop();
      return;
    }

    const Recognition = getSpeechRecognitionConstructor();
    setVoiceSupported(Boolean(Recognition));
    if (!Recognition) {
      setVoicePermissionState('unsupported');
      pushSystemMessage('当前浏览器暂不支持语音输入，请改用键盘输入，或切换到支持语音识别的浏览器。');
      return;
    }

    const microphoneAccess = await requestMicrophoneAccess();
    if (!microphoneAccess.ok) {
      const messageMap: Record<string, string> = {
        denied: '麦克风权限已被浏览器拒绝，请先在地址栏或浏览器设置中开启麦克风权限后再试。',
        'missing-device': '没有检测到可用麦克风，请检查系统输入设备后重试。',
        unavailable: '当前环境暂时无法访问麦克风，请检查浏览器或系统权限后重试。'
      };
      pushSystemMessage(messageMap[microphoneAccess.reason] || '语音输入暂时不可用，请稍后重试。');
      return;
    }

    if (!voiceRecognitionRef.current) {
      const recognition = new Recognition();
      recognition.lang = 'zh-CN';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.onstart = () => {
        voiceTranscriptRef.current = '';
        setVoicePermissionState('granted');
        setVoiceListening(true);
      };
      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .slice(event.resultIndex)
          .map((result) => result[0]?.transcript || '')
          .join('')
          .trim();

        voiceTranscriptRef.current = transcript;

        if (!transcript) return;

        const base = voiceInputBaseRef.current.trim();
        const separator = base && !/[，。！？；：、,\s]$/.test(base) ? ' ' : '';
        setInput(`${base}${separator}${transcript}`.trim());
      };
      recognition.onerror = (event) => {
        setVoiceListening(false);
        if (event.error === 'aborted') return;

        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setVoicePermissionState('denied');
        }

        const errorMessageMap: Record<string, string> = {
          'not-allowed': '麦克风权限未开启，请允许浏览器访问麦克风后再试。',
          'service-not-allowed': '当前环境不允许使用语音识别服务，请检查浏览器权限设置。',
          'audio-capture': '没有检测到可用麦克风，请检查系统输入设备。',
          'no-speech': '没有识别到语音，请靠近麦克风后重试。',
          network: '语音识别网络异常，请稍后重试。'
        };

        pushSystemMessage(errorMessageMap[event.error] || '语音输入暂时不可用，请稍后重试。');
      };
      recognition.onend = () => {
        setVoiceListening(false);
      };
      voiceRecognitionRef.current = recognition;
    }

    voiceInputBaseRef.current = input;
    voiceTranscriptRef.current = '';

    try {
      voiceRecognitionRef.current.start();
    } catch (error) {
      const message = error instanceof Error ? error.message : '语音识别启动失败';
      setVoiceListening(false);
      pushSystemMessage(`语音输入启动失败：${message}`);
    }
  };

  const handleRateService = () => {
    setRatingScore(5);
    setRatingOpen(true);
  };

  const handleRatingSubmit = (score: RatingScore) => {
    const labelMap: Record<RatingScore, string> = {
      1: '很不满意',
      2: '不满意',
      3: '一般',
      4: '满意',
      5: '非常满意'
    };
    setRatingOpen(false);
    setMessages((current) => [
      ...current,
      {
        id: `rate-${Date.now()}`,
        role: 'system',
        text: `已提交本次服务评价：${labelMap[score]}。正式版会写入工单满意度。`,
        createdAt: new Date().toISOString()
      }
    ]);
  };

  const handleNavigate = (action?: NavigateActionLike | string) => {
    const target =
      typeof action === 'string'
        ? { path: action, label: action, url: '' }
        : action || { path: 'platform-home', label: '共创平台首页', url: '' };
    const targetUrl = resolveNavigateUrl(target);
    if (targetUrl) {
      const popup = window.open(targetUrl, '_blank', 'noopener,noreferrer');
      if (popup) {
        popup.focus();
      }
    }
    setMessages((current) => [
      ...current,
      {
        id: `navigate-${Date.now()}`,
        role: 'system',
        text: targetUrl
          ? `已为你打开：${target.label || target.path || targetUrl}\n${targetUrl}`
          : `已为你定位相关菜单：${target.path || '/home'}。当前动作尚未配置外部链接。`,
        createdAt: new Date().toISOString()
      }
    ]);
  };

  const startNewConversation = () => {
    voiceRecognitionRef.current?.abort();
    setVoiceListening(false);
    setSection('chat');
    setSelectedHistoryId('current');
    setSessionId('');
    setInput('');
    setAttachments([]);
    setManualTicket(null);
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        text: '你好，我是小伊!有什么可以帮您的?',
        source: 'mock',
        createdAt: new Date().toISOString()
      }
    ]);
  };

  return (
    <section className={`ly-ai ${size}`} style={{ width: dimensions.width, height: dimensions.height }}>
      <header className="ly-topbar">
        <div className="ly-brand">
          <span>来伊份</span>
          <b />
          <strong>AI客服助手 小伊</strong>
        </div>
        <div className="ly-top-actions">
          <select value={identity} onChange={(event) => setIdentity(event.target.value as Identity)}>
            {identities.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
      </header>

      <div className="ly-body">
        <SideMenu
          section={section}
          setSection={handleSectionChange}
          startNewConversation={startNewConversation}
          compact={size === 'phone'}
          histories={recentHistories}
          selectedHistoryId={selectedHistoryId}
          setSelectedHistoryId={setSelectedHistoryId}
          currentUser={currentUser}
        />

        <main className="ly-main">
          {section === 'chat' && (
            <ChatWorkspace
              messages={messages}
              questions={visibleQuestions}
              sending={sending}
              uploading={uploading}
              attachments={attachments}
              input={input}
              setInput={setInput}
              sendText={sendText}
              onShuffleQuestions={() => setQuestionOffset((current) => current + 1)}
              handleHumanTransfer={handleHumanTransfer}
              transferring={transferring}
              handleUpload={handleUpload}
              handleVoiceInput={handleVoiceInput}
              handleRateService={handleRateService}
              handleNavigate={handleNavigate}
              onPreviewFile={setPreviewFile}
              fileRef={fileRef}
              size={size}
              serviceHours={data.serviceHours}
              manualTicket={manualTicket}
              removeAttachment={removeAttachment}
              voiceListening={voiceListening}
              voiceSupported={voiceSupported}
              voicePermissionState={voicePermissionState}
            />
          )}
          {section === 'history' && (
            <HistoryWorkspace
              histories={conversationHistories}
              selectedHistoryId={selectedHistoryId}
              setSelectedHistoryId={setSelectedHistoryId}
              questions={visibleQuestions}
              sendText={sendAndOpenChat}
            />
          )}
          {section === 'tickets' && (
            <TicketWorkspace
              tickets={data.tickets}
              supportStaff={data.supportStaff}
              identity={identity}
              currentUser={currentUser}
              activeView={ticketView}
              setActiveView={setTicketView}
              onTicketCreated={onTicketCreated}
              onTicketUpdated={onTicketUpdated}
              onBackToChat={() => setSection('chat')}
            />
          )}
        </main>
      </div>
      <button className="ly-resize-handle" onPointerDown={handleResizeStart} aria-label="拉伸小伊客服窗口">
        <span />
      </button>
      {ratingOpen && (
        <RatingDialog
          score={ratingScore}
          setScore={setRatingScore}
          onClose={() => setRatingOpen(false)}
          onSubmit={handleRatingSubmit}
        />
      )}
      {previewFile && <FilePreviewDialog file={previewFile} onClose={() => setPreviewFile(null)} />}
    </section>
  );
}

function SideMenu({
  section,
  setSection,
  startNewConversation,
  compact,
  histories,
  selectedHistoryId,
  setSelectedHistoryId,
  currentUser
}: {
  section: AssistantSection;
  setSection: (section: AssistantSection) => void;
  startNewConversation: () => void;
  compact: boolean;
  histories: BootstrapPayload['conversationHistories'];
  selectedHistoryId: string;
  setSelectedHistoryId: (id: string) => void;
  currentUser: CurrentUser;
}) {
  const items: Array<{
    key: AssistantSection;
    label: string;
    icon: typeof MessageCircle;
  }> = [
    { key: 'history', label: '历史对话', icon: History },
    { key: 'tickets', label: '工单反馈', icon: TicketCheck }
  ];
  const [recentCollapsed, setRecentCollapsed] = useState(false);

  if (compact) {
    const titleMap: Record<AssistantSection, { title: string; subtitle: string }> = {
      chat: { title: '小伊对话', subtitle: '返回可查看历史记录' },
      history: { title: '历史记录', subtitle: `${histories.length} 条对话` },
      tickets: { title: '工单反馈', subtitle: '提交和查看工单' }
    };
    const current = titleMap[section];
    const handleBack = () => {
      if (section === 'chat') {
        setSelectedHistoryId('current');
        setSection('history');
        return;
      }
      setSection('chat');
    };

    return (
      <nav className="ly-mobile-nav">
        <button className="ly-mobile-back" onClick={handleBack} aria-label={section === 'chat' ? '查看历史记录' : '返回对话'}>
          <ArrowLeft size={17} />
          <span>{section === 'chat' ? '历史' : '返回'}</span>
        </button>
        <div className="ly-mobile-heading">
          <strong>{current.title}</strong>
          <span>{current.subtitle}</span>
        </div>
        <div className="ly-mobile-actions">
          <button onClick={startNewConversation} className={section === 'chat' ? 'active' : ''} aria-label="新建对话">
            <Plus size={16} />
          </button>
          <button onClick={() => setSection('tickets')} className={section === 'tickets' ? 'active' : ''} aria-label="工单反馈">
            <TicketCheck size={16} />
          </button>
        </div>
      </nav>
    );
  }

  return (
    <aside className="ly-sidebar">
      <button className="ly-new-chat" onClick={startNewConversation}>
        <Plus size={16} />
        新建对话
      </button>
      <nav>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.key} className="ly-nav-group">
              <button className={section === item.key ? 'active' : ''} onClick={() => setSection(item.key)}>
                <Icon size={16} />
                <span>{item.label}</span>
              </button>
              {item.key === 'history' && (
                <div className={`ly-history-submenu${recentCollapsed ? ' collapsed' : ''}`} aria-label="最近历史对话">
                  <button
                    className="ly-history-submenu-head"
                    onClick={() => setRecentCollapsed((current) => !current)}
                    aria-expanded={!recentCollapsed}
                    aria-controls="recent-history-list"
                  >
                    <span>
                      <ChevronRight size={13} />
                      最近记录
                    </span>
                    <em>{histories.length}</em>
                  </button>
                  {!recentCollapsed && (
                    <div id="recent-history-list" className="ly-history-submenu-list">
                      {histories.length > 0 ? (
                        <>
                          {histories.slice(0, 4).map((record) => (
                            <button
                              key={record.id}
                              className={selectedHistoryId === record.id ? 'active' : ''}
                              onClick={() => {
                                setSelectedHistoryId(record.id);
                                setSection('history');
                              }}
                            >
                              <strong>{record.title}</strong>
                              <span>
                                {record.type === 'service' ? '客服' : 'AI'} · {formatHistoryRelativeTime(record.updatedAt)}
                              </span>
                            </button>
                          ))}
                          <button
                            className="ly-history-submenu-all"
                            onClick={() => {
                              setSelectedHistoryId(histories[0]?.id || 'current');
                              setSection('history');
                            }}
                          >
                            查看全部历史
                          </button>
                        </>
                      ) : (
                        <div className="ly-history-submenu-empty">暂无真实历史记录</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      <div className="ly-user-card">
        <span>{currentUser.name.slice(0, 1)}</span>
        <div>
          <strong>{currentUser.name}</strong>
          <em>{currentUser.org}</em>
          <small>账号 {currentUser.account}</small>
        </div>
      </div>
    </aside>
  );
}

function ChatWorkspace({
  messages,
  questions,
  sending,
  uploading,
  attachments,
  input,
  setInput,
  sendText,
  onShuffleQuestions,
  handleHumanTransfer,
  transferring,
  handleUpload,
  handleVoiceInput,
  handleRateService,
  handleNavigate,
  onPreviewFile,
  fileRef,
  size,
  serviceHours,
  manualTicket,
  removeAttachment,
  voiceListening,
  voiceSupported,
  voicePermissionState
}: {
  messages: ChatMessage[];
  questions: QuickQuestion[];
  sending: boolean;
  uploading: boolean;
  attachments: UploadedFile[];
  input: string;
  setInput: (value: string) => void;
  sendText: (text: string) => Promise<void>;
  onShuffleQuestions: () => void;
  handleHumanTransfer: () => Promise<void>;
  transferring: boolean;
  handleUpload: (file?: File) => Promise<void>;
  handleVoiceInput: () => Promise<void>;
  handleRateService: () => void;
  handleNavigate: (action?: NavigateActionLike | string) => void;
  onPreviewFile: (file: UploadedFile) => void;
  fileRef: RefObject<HTMLInputElement>;
  size: AssistantSize;
  serviceHours: BootstrapPayload['serviceHours'];
  manualTicket: Ticket | null;
  removeAttachment: (fileId: string) => void;
  voiceListening: boolean;
  voiceSupported: boolean;
  voicePermissionState: VoicePermissionState;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = scrollRef.current;
    if (!target) return;
    window.requestAnimationFrame(() => {
      target.scrollTo({ top: target.scrollHeight, behavior: 'smooth' });
    });
  }, [messages.length, sending]);

  return (
    <div className="ly-chat-workspace">
      <div className="ly-chat-scroll" ref={scrollRef}>
        <div className="ly-greeting">
          <div className="ly-bot-avatar">
            <Bot size={20} />
          </div>
          <div className="ly-greeting-bubble">你好，我是小伊!有什么可以帮您的?</div>
          <time>15:30</time>
        </div>

        <section className="ly-quick">
          <div className="ly-quick-title">
            <span>
              <Send size={14} />
              快捷提问
            </span>
            <button onClick={onShuffleQuestions}>
              <RefreshCw size={14} />
              换一换
            </button>
          </div>
          <div className="ly-question-grid">
            {questions.map((question) => (
              <button key={question.id} onClick={() => void sendText(question.title)} disabled={sending}>
                <span>{question.title}</span>
                <ChevronRight size={17} />
              </button>
            ))}
          </div>
        </section>

        <section className="ly-message-stack">
          {messages.slice(1).map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onActionTicket={handleHumanTransfer}
              onNavigate={handleNavigate}
              onPreviewFile={onPreviewFile}
            />
          ))}
          {sending && (
            <div className="ly-message assistant">
              <div className="ly-bubble ly-typing">
                <Loader2 className="spin" size={16} />
                小伊正在分析，请稍候...
              </div>
            </div>
          )}
        </section>
      </div>

      <Composer
        input={input}
        setInput={setInput}
        sending={sending}
        attachments={attachments}
        sendText={sendText}
        handleHumanTransfer={handleHumanTransfer}
        transferring={transferring}
        handleUpload={handleUpload}
        handleVoiceInput={handleVoiceInput}
        handleRateService={handleRateService}
        fileRef={fileRef}
        size={size}
        serviceHours={serviceHours}
        uploading={uploading}
        manualTicket={manualTicket}
        removeAttachment={removeAttachment}
        onPreviewFile={onPreviewFile}
        voiceListening={voiceListening}
        voiceSupported={voiceSupported}
        voicePermissionState={voicePermissionState}
      />
    </div>
  );
}

function Composer({
  input,
  setInput,
  sending,
  uploading,
  attachments,
  sendText,
  handleHumanTransfer,
  transferring,
  handleUpload,
  handleVoiceInput,
  handleRateService,
  fileRef,
  size,
  serviceHours,
  manualTicket,
  removeAttachment,
  onPreviewFile,
  voiceListening,
  voiceSupported,
  voicePermissionState
}: {
  input: string;
  setInput: (value: string) => void;
  sending: boolean;
  uploading: boolean;
  attachments: UploadedFile[];
  sendText: (text: string) => Promise<void>;
  handleHumanTransfer: () => Promise<void>;
  transferring: boolean;
  handleUpload: (file?: File) => Promise<void>;
  handleVoiceInput: () => Promise<void>;
  handleRateService: () => void;
  fileRef: RefObject<HTMLInputElement>;
  size: AssistantSize;
  serviceHours: BootstrapPayload['serviceHours'];
  manualTicket: Ticket | null;
  removeAttachment: (fileId: string) => void;
  onPreviewFile: (file: UploadedFile) => void;
  voiceListening: boolean;
  voiceSupported: boolean;
  voicePermissionState: VoicePermissionState;
}) {
  const [showServiceHours, setShowServiceHours] = useState(false);
  const voiceHint = voiceListening
    ? '正在聆听，请开始说话。再次点击麦克风可结束。'
    : voicePermissionState === 'denied'
      ? '麦克风权限已关闭，请先在浏览器设置中重新开启。'
    : !voiceSupported
      ? '当前浏览器不支持语音输入。'
      : voicePermissionState === 'prompt' || voicePermissionState === 'unknown'
        ? '点击麦克风开始语音转文字，首次会请求麦克风权限。'
      : '点击麦克风可直接语音转文字。';
  const attachmentHint = uploading
    ? '正在上传附件，请稍候。'
    : attachments.length > 0
      ? `已添加 ${attachments.length} 个附件，发送时会与文字一起提交。`
      : '';
  const attachmentDetail =
    attachments.length > 0
      ? attachments.some((file) => isImageFile(file.mime))
        ? '图片会与文字描述一起发送给 AI 分析。'
        : '附件内容会作为当前问题的上下文一起处理。'
      : '';

  const continueHumanTransfer = async () => {
    setShowServiceHours(false);
    await handleHumanTransfer();
  };

  return (
    <footer className="ly-composer">
      <div className="ly-service-row">
        <button
          className={`ly-transfer${manualTicket ? ' connected' : ''}`}
          onClick={() => setShowServiceHours((current) => !current)}
          disabled={transferring}
        >
          {transferring ? <Loader2 className="spin" size={15} /> : <Headphones size={15} />}
          <span className="ly-transfer-copy">
            <strong>{manualTicket ? '人工客服已接入' : transferring ? '转接中' : '转人工客服'}</strong>
          </span>
        </button>
        {showServiceHours && (
          <div className="ly-service-popover">
            <div>
              <Clock3 size={15} />
              <span>
                {manualTicket
                  ? `当前客服：${manualTicket.currentStaff}，工单号：${manualTicket.id}`
                  : `人工客服工作时间：${serviceHours.workdays} ${serviceHours.start}-${serviceHours.end}`}
              </span>
            </div>
            <button onClick={() => void continueHumanTransfer()} disabled={transferring || Boolean(manualTicket)}>
              {manualTicket ? '已接入' : '继续转人工'}
            </button>
          </div>
        )}
        <button className="ly-rate" onClick={handleRateService}>
          <Star size={15} />
          评价服务
        </button>
      </div>

      <div className={`ly-input-shell${attachments.length > 0 ? ' has-attachments' : ''}`}>
        <input
          ref={fileRef}
          type="file"
          hidden
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
          onChange={(event) => {
            const file = event.target.files?.[0];
            void handleUpload(file);
            event.currentTarget.value = '';
          }}
        />
        {attachments.length > 0 && (
          <div className="ly-attachments" aria-label="待发送附件">
            {attachments.map((file) => (
              <span key={file.id} className={isImageFile(file.mime) ? 'is-image' : ''}>
                {isImageFile(file.mime) && file.url ? (
                  <button
                    type="button"
                    className="ly-attachment-preview"
                    onClick={() => onPreviewFile(file)}
                    aria-label={`预览附件 ${file.originalName}`}
                    disabled={sending || uploading}
                  >
                    <img src={file.url} alt={file.originalName} className="ly-attachment-thumb" />
                  </button>
                ) : (
                  <Paperclip size={12} />
                )}
                <strong>{file.originalName}</strong>
                <button
                  type="button"
                  className="ly-attachment-remove"
                  onClick={() => removeAttachment(file.id)}
                  aria-label={`移除附件 ${file.originalName}`}
                  disabled={sending || uploading}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className={`ly-input-row${size === 'phone' ? ' mobile' : ''}`}>
          <button className="ly-tool" onClick={() => fileRef.current?.click()} aria-label="上传图片/文件" disabled={uploading}>
            {uploading ? <Loader2 className="spin" size={18} /> : <ImageUp size={19} />}
          </button>
          <ChatInput
            input={input}
            setInput={setInput}
            sendText={sendText}
            sending={sending}
            uploading={uploading}
            attachments={attachments}
          />
          <button
            className={`ly-tool muted${voiceListening ? ' active' : ''}`}
            onClick={() => void handleVoiceInput()}
            aria-label={voiceListening ? '停止语音输入' : '语音输入'}
            disabled={sending || uploading}
            aria-pressed={voiceListening}
          >
            <Mic size={18} />
          </button>
          <button className="ly-send" onClick={() => void sendText(input)} disabled={sending || uploading || !input.trim()} aria-label="发送">
            {sending ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
          </button>
        </div>
        <div className="ly-input-hint">
          <span>{voiceHint}</span>
          {attachmentHint && <span>{attachmentHint}</span>}
          {attachmentDetail && <span>{attachmentDetail}</span>}
        </div>
      </div>
    </footer>
  );
}

function RatingDialog({
  score,
  setScore,
  onClose,
  onSubmit
}: {
  score: RatingScore;
  setScore: (score: RatingScore) => void;
  onClose: () => void;
  onSubmit: (score: RatingScore) => void;
}) {
  const options: Array<{ score: RatingScore; label: string; icon: typeof Smile }> = [
    { score: 1, label: '很不满意', icon: Frown },
    { score: 2, label: '不满意', icon: Frown },
    { score: 3, label: '一般', icon: Meh },
    { score: 4, label: '满意', icon: Smile },
    { score: 5, label: '非常满意', icon: Laugh }
  ];

  return (
    <div className="ly-rating-overlay" role="dialog" aria-modal="true" aria-labelledby="rating-title">
      <div className="ly-rating-modal">
        <div className="ly-rating-face">
          <Smile size={42} />
        </div>
        <button className="ly-rating-close" onClick={onClose} aria-label="关闭评价">
          <X size={15} />
        </button>
        <h2 id="rating-title">请评价本次服务</h2>
        <div className="ly-rating-panel">
          <div className="ly-rating-options">
            {options.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.score}
                  className={score === option.score ? 'active' : ''}
                  onClick={() => setScore(option.score)}
                  aria-pressed={score === option.score}
                >
                  <Icon size={25} />
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
          <button className="ly-rating-submit" onClick={() => onSubmit(score)}>
            提交
          </button>
        </div>
      </div>
    </div>
  );
}

function ChatInput({
  input,
  setInput,
  sendText,
  sending,
  uploading,
  attachments
}: {
  input: string;
  setInput: (value: string) => void;
  sendText: (text: string) => Promise<void>;
  sending: boolean;
  uploading: boolean;
  attachments: UploadedFile[];
}) {
  const placeholder = uploading
    ? '正在上传附件...'
    : attachments.length > 0
      ? '请输入想结合附件一起咨询的问题...'
      : '请输入您的问题，可先上传图片或文件...';

  return (
    <textarea
      value={input}
      onChange={(event) => setInput(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          void sendText(input);
        }
      }}
      placeholder={placeholder}
      disabled={sending}
    />
  );
}

function FilePreviewDialog({
  file,
  onClose
}: {
  file: UploadedFile;
  onClose: () => void;
}) {
  return (
    <div className="ly-preview-overlay" role="dialog" aria-modal="true" aria-labelledby="preview-title">
      <div className="ly-preview-modal">
        <div className="ly-preview-head">
          <div>
            <strong id="preview-title">{file.originalName}</strong>
            <span>{Math.max(1, Math.round(file.size / 1024))} KB</span>
          </div>
          <button className="ly-preview-close" onClick={onClose} aria-label="关闭图片预览">
            <X size={16} />
          </button>
        </div>
        {file.url && <img src={file.url} alt={file.originalName} className="ly-preview-image" />}
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  onActionTicket,
  onNavigate,
  onPreviewFile
}: {
  message: ChatMessage;
  onActionTicket: () => Promise<void>;
  onNavigate: (action?: NavigateActionLike | string) => void;
  onPreviewFile: (file: UploadedFile) => void;
}) {
  const trace = message.agentTrace;
  const reasoning = message.reasoning;
  const showTrace = Boolean(trace && (message.role === 'assistant' || trace.agent4_security.requires_confirmation));
  const visibleCitations = message.citations?.filter((item) => !isInternalCitation(item)) || [];
  const riskClass =
    trace?.agent4_security.risk_level === 'high'
      ? 'danger'
      : trace?.agent4_security.risk_level === 'medium'
        ? 'warning'
        : 'success';
  const traceSummary =
    trace && reasoning
      ? [
          `问题类型：${trace.agent2_intent.category}${message.priority || trace.agent2_intent.priority ? ` · ${message.priority || trace.agent2_intent.priority}` : ''}`,
          trace.status === 'blocked'
            ? '当前需要进一步确认后才能继续处理。'
            : trace.agent4_security.risk_level === 'high'
              ? '当前请求风险较高，系统已采用谨慎处理方式。'
              : '已完成问题判断，可以继续处理当前请求。'
        ].filter(Boolean)
      : [];
  const traceNotes = [
    reasoning?.evidence.fallbackReason ? `处理说明：${reasoning.evidence.fallbackReason}` : '',
    trace?.agent4_security.reasons.length ? trace.agent4_security.reasons.join('；') : ''
  ].filter(Boolean);
  const primaryTraceSummary = traceSummary[0] || '';
  const secondaryTraceSummary = traceSummary[1] || '';
  const visibleTraceNotes = trace?.status === 'blocked' ? traceNotes.slice(0, 1) : [];

  return (
    <div className={`ly-message ${message.role}`}>
      <div className="ly-bubble">
        <p>{message.text}</p>
        {message.files && message.files.length > 0 && (
          <div className="ly-file-list">
            {message.files.map((file) => (
              <span key={file.id} className={isImageFile(file.mime) ? 'is-image' : ''}>
                {file.mime.startsWith('image/') && file.url ? (
                  <button
                    type="button"
                    className="ly-file-preview"
                    onClick={() => onPreviewFile(file)}
                    aria-label={`预览图片 ${file.originalName}`}
                  >
                    <img src={file.url} alt={file.originalName} className="ly-file-image" />
                  </button>
                ) : (
                  <FileText size={14} />
                )}
                {file.originalName}
              </span>
            ))}
          </div>
        )}
        {visibleCitations.length > 0 && (
          <div className="ly-citations">
            {visibleCitations.map((item) => (
              <span key={`${item.label}-${item.value}`}>{item.label}: {item.value}</span>
            ))}
          </div>
        )}
        {showTrace && trace && (
          <div className={`ly-trace-card ${riskClass}`}>
            <div className="ly-trace-head">
              {trace.status === 'blocked' ? <AlertCircle size={14} /> : <Bot size={14} />}
              <strong>{trace.status === 'blocked' ? '处理确认' : 'AI 处理结果'}</strong>
            </div>
            {(primaryTraceSummary || secondaryTraceSummary) && (
              <div className="ly-trace-brief">
                {primaryTraceSummary && <strong>{primaryTraceSummary}</strong>}
                {secondaryTraceSummary && <span>{secondaryTraceSummary}</span>}
              </div>
            )}
            {visibleTraceNotes.map((note) => (
              <p key={note}>{note}</p>
            ))}
          </div>
        )}
        {message.actions && (
          <div className="ly-actions">
            {message.actions.map((action) => (
              <button
                key={`${action.label}-${action.path || action.url || action.type}`}
                title={action.description}
                onClick={action.type === 'ticket' ? () => void onActionTicket() : () => onNavigate(action)}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HistoryWorkspace({
  histories,
  selectedHistoryId,
  setSelectedHistoryId,
  questions,
  sendText
}: {
  histories: BootstrapPayload['conversationHistories'];
  selectedHistoryId: string;
  setSelectedHistoryId: (id: string) => void;
  questions: QuickQuestion[];
  sendText: (text: string) => Promise<void>;
}) {
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [historyQuery, setHistoryQuery] = useState('');
  const records = histories;
  const historyStats = useMemo(
    () => ({
      all: records.length,
      ai: records.filter((record) => record.type === 'ai').length,
      service: records.filter((record) => record.type === 'service').length,
      active: records.filter((record) => ['进行中', '处理中', '待处理'].includes(record.status)).length
    }),
    [records]
  );
  const filteredRecords = useMemo(() => {
    const keyword = historyQuery.trim().toLowerCase();
    return records.filter((record) => {
      const matchesType = historyFilter === 'all' || record.type === historyFilter;
      if (!matchesType) return false;
      if (!keyword) return true;
      const searchText = [
        record.title,
        record.identity,
        record.channel,
        record.status,
        record.staffName || '',
        record.ticketId || '',
        ...record.messages.flatMap((message) => [message.sender, message.text])
      ]
        .join(' ')
        .toLowerCase();
      return searchText.includes(keyword);
    });
  }, [historyFilter, historyQuery, records]);
  const selected = filteredRecords.find((record) => record.id === selectedHistoryId) || filteredRecords[0] || records[0];
  const filterOptions: Array<{ key: HistoryFilter; label: string; count: number }> = [
    { key: 'all', label: '全部', count: historyStats.all },
    { key: 'ai', label: 'AI 对话', count: historyStats.ai },
    { key: 'service', label: '客服对话', count: historyStats.service }
  ];

  useEffect(() => {
    if (records.length === 0) {
      if (selectedHistoryId !== 'current') {
        setSelectedHistoryId('current');
      }
      return;
    }
    if (!records.some((record) => record.id === selectedHistoryId)) {
      setSelectedHistoryId(records[0].id);
    }
  }, [records, selectedHistoryId, setSelectedHistoryId]);

  return (
    <div className="ly-pane ly-history-pane">
      <div className="ly-pane-title ly-history-title">
        <div>
          <h2>历史对话</h2>
          <p>集中查看真实历史对话，以及转人工后的客服上下文。</p>
        </div>
        <div className="ly-history-title-actions">
          <select className="ly-history-select" value={selected?.id || 'current'} onChange={(event) => setSelectedHistoryId(event.target.value)}>
            {records.map((record) => (
              <option key={record.id} value={record.id}>
                {getHistoryTypeLabel(record)} · {record.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="ly-history-overview">
        {filterOptions.map((option) => (
          <button
            key={option.key}
            className={historyFilter === option.key ? 'active' : ''}
            onClick={() => setHistoryFilter(option.key)}
          >
            <strong>{option.count}</strong>
            <span>{option.label}</span>
          </button>
        ))}
        <button className="status-card" onClick={() => setHistoryFilter('all')}>
          <strong>{historyStats.active}</strong>
          <span>进行中</span>
        </button>
      </div>

      <div className="ly-history-toolbar">
        <label className="ly-history-search">
          <Search size={15} />
          <input
            value={historyQuery}
            onChange={(event) => setHistoryQuery(event.target.value)}
            placeholder="搜索标题、内容、工单号或客服"
          />
        </label>
        <div className="ly-history-filter">
          {filterOptions.map((option) => (
            <button
              key={option.key}
              className={historyFilter === option.key ? 'active' : ''}
              onClick={() => setHistoryFilter(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="ly-history-result-bar">
        <span>匹配结果 {filteredRecords.length} 条</span>
        {filteredRecords.length > 0 && selected && (
          <button onClick={() => setSelectedHistoryId(selected.id)}>
            当前查看：{getHistoryTypeLabel(selected)} · {selected.title}
          </button>
        )}
      </div>

      <div className="ly-history-layout">
        <section className="ly-history-detail">
          {filteredRecords.length > 0 && selected ? (
            <>
              <div className="ly-history-detail-head">
                <div className={`ly-history-detail-icon ${selected.type}`}>
                  {selected.type === 'service' ? <Headphones size={18} /> : <Bot size={18} />}
                </div>
                <div>
                  <h3>{selected.title}</h3>
                  <p>{getHistoryExcerpt(selected)}</p>
                </div>
              </div>

              <div className="ly-history-meta">
                <span>{getHistoryTypeLabel(selected)}</span>
                <span>{selected.identity}</span>
                <span>{selected.channel}</span>
                <span>{selected.status}</span>
                {selected.staffName && <span>{selected.staffName}</span>}
                {selected.ticketId && <span>{selected.ticketId}</span>}
                <span>{formatHistoryTime(selected.updatedAt)}</span>
              </div>

              <div className="ly-history-thread">
                {selected.messages.map((message) => (
                  <article key={message.id} className={`ly-history-thread-message ${message.role}`}>
                    <div className="ly-history-message-avatar">{message.sender.slice(0, 1)}</div>
                    <div className="ly-history-message-body">
                      <div>
                        <strong>{message.sender}</strong>
                        <time>{formatHistoryTime(message.createdAt)}</time>
                      </div>
                      <p>{message.text}</p>
                    </div>
                  </article>
                ))}
              </div>

              <div className="ly-history-followups">
                <div>
                  <strong>继续处理</strong>
                  <span>可基于当前上下文继续向小伊提问</span>
                </div>
                <div className="ly-question-grid in-pane compact-history">
                  {questions.slice(0, 3).map((question) => (
                    <button key={question.id} onClick={() => void sendText(question.title)}>
                      <span>{question.title}</span>
                      <ChevronRight size={16} />
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="ly-history-detail-empty">
              <History size={28} />
              <strong>没有找到历史对话</strong>
              <span>换个关键词，或切回全部历史。</span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function TicketWorkspace({
  tickets,
  supportStaff,
  identity,
  currentUser,
  activeView,
  setActiveView,
  onTicketCreated,
  onTicketUpdated,
  onBackToChat
}: {
  tickets: Ticket[];
  supportStaff: SupportStaff[];
  identity: Identity;
  currentUser: CurrentUser;
  activeView: TicketView;
  setActiveView: (view: TicketView) => void;
  onTicketCreated: (ticket: Ticket) => void;
  onTicketUpdated: (ticket: Ticket) => void;
  onBackToChat: () => void;
}) {
  const [transferTargets, setTransferTargets] = useState<Record<string, string>>({});
  const [transferringTicketId, setTransferringTicketId] = useState('');
  const [form, setForm] = useState<TicketFormState>(() => getDefaultTicketForm(identity, currentUser));
  const [ticketFiles, setTicketFiles] = useState<UploadedFile[]>([]);
  const [ticketSubmitting, setTicketSubmitting] = useState(false);
  const [ticketUploading, setTicketUploading] = useState(false);
  const [ticketNotice, setTicketNotice] = useState('');
  const ticketFileRef = useRef<HTMLInputElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);

  const problemTypes = ['账号权限与登录', '菜单定位与操作引导', '供应商入驻', '合同授权与结算', '加盟商商机与门店运营', '经销商业务问题', '工单与人工客服', '附件图片文件识别', '系统异常与缺陷', '其他问题'];
  const provinceOptions = ['上海市', '江苏省', '浙江省', '安徽省', '广东省'];
  const cityOptions = form.province === '上海市' ? ['上海市'] : ['南京市', '杭州市', '合肥市', '广州市'];
  const districtOptions = form.province === '上海市' ? ['浦东新区', '闵行区', '徐汇区', '黄浦区'] : ['核心城区', '合作片区'];
  const canTransferTickets = currentUser.role === 'support';

  useEffect(() => {
    setForm(getDefaultTicketForm(identity, currentUser));
    setTicketFiles([]);
    setTicketNotice('');
  }, [identity, currentUser]);

  useEffect(() => {
    paneRef.current?.scrollTo({ top: 0 });
  }, [activeView]);

  const handleTransfer = async (ticket: Ticket) => {
    const staffId = transferTargets[ticket.id] || supportStaff[0]?.id;
    if (!canTransferTickets || !staffId || transferringTicketId) return;
    setTransferringTicketId(ticket.id);
    try {
      const updated = await transferTicket(ticket.id, staffId, '客服工作台手动转派', currentUser.role);
      onTicketUpdated(updated);
      setTicketNotice(`工单 ${ticket.id} 已转派给 ${updated.currentStaff}。`);
    } catch (err) {
      const message = err instanceof Error ? err.message : '转派失败';
      setTicketNotice(message);
    } finally {
      setTransferringTicketId('');
    }
  };

  const updateForm = (field: keyof TicketFormState, value: string) => {
    setForm((current) => {
      if (field === 'province') {
        return { ...current, province: value, city: '', district: '' };
      }
      if (field === 'city') {
        return { ...current, city: value, district: '' };
      }
      return { ...current, [field]: value };
    });
  };

  const handleTicketFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).slice(0, 4 - ticketFiles.length);
    if (files.length === 0 || ticketUploading) return;
    setTicketUploading(true);
    setTicketNotice('');
    try {
      const uploaded = await Promise.all(files.map((file) => uploadFile(file)));
      setTicketFiles((current) => [...current, ...uploaded].slice(0, 4));
    } catch (err) {
      const message = err instanceof Error ? err.message : '附件上传失败';
      setTicketNotice(message);
    } finally {
      setTicketUploading(false);
    }
  };

  const handleTicketFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      void handleTicketFiles(files);
    }
    event.target.value = '';
  };

  const handleTicketDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    void handleTicketFiles(event.dataTransfer.files);
  };

  const resetTicketForm = () => {
    setForm(getDefaultTicketForm(identity, currentUser));
    setTicketFiles([]);
    setTicketNotice('');
  };

  const handleCreateTicket = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (ticketSubmitting) return;
    if (!form.problemType || !form.feedback.trim() || !form.userName.trim() || !form.phone.trim()) {
      setTicketNotice('请先填写问题类型、意见反馈、反馈人姓名和手机号。');
      return;
    }

    setTicketSubmitting(true);
    setTicketNotice('');
    try {
      const attachmentSummary =
        ticketFiles.length > 0 ? `\n附件：${ticketFiles.map((file) => file.originalName).join('、')}` : '';
      const ticket = await createTicket({
        title: `${form.problemType}：${form.feedback.trim().slice(0, 36)}`,
        userName: form.userName.trim(),
        phone: form.phone.trim(),
        identity,
        channel: '共创',
        category: form.problemType,
        summary: [
          form.feedback.trim(),
          `反馈时间：${form.feedbackAt.replace('T', ' ')}`,
          `门店编码：${form.storeCode || '-'}`,
          `昵称：${form.nickname || '-'}`,
          `联系方式：${form.contact || '-'}`,
          `合作伙伴类型：${form.partnerType || identity}`,
          `公司名称：${form.companyName || '-'}`,
          `公司SAP编码：${form.sapCode || '-'}`,
          `地区：${[form.province, form.city, form.district].filter(Boolean).join('/') || '-'}${attachmentSummary}`
        ].join('\n')
      });
      onTicketCreated(ticket);
      resetTicketForm();
      setTicketNotice(`已提交工单 ${ticket.id}，当前分配给 ${ticket.currentStaff}。`);
      setActiveView('list');
    } catch (err) {
      const message = err instanceof Error ? err.message : '提交工单失败';
      setTicketNotice(message);
    } finally {
      setTicketSubmitting(false);
    }
  };

  return (
    <div className="ly-pane" ref={paneRef}>
      <div className="ly-pane-title">
        <div>
          <h2>工单反馈</h2>
          <p>可提交新工单，也可以查看转人工后的工单状态、当前客服、飞书通知和评价结果。</p>
        </div>
        <div className="ly-ticket-title-actions">
          <div className="ly-ticket-switch" role="tablist" aria-label="工单视图">
            <button className={activeView === 'create' ? 'active' : ''} onClick={() => setActiveView('create')}>
              提交新工单
            </button>
            <button className={activeView === 'list' ? 'active' : ''} onClick={() => setActiveView('list')}>
              工单列表
            </button>
          </div>
          <button onClick={onBackToChat}>
            <MessageCircle size={15} />
            返回对话
          </button>
        </div>
      </div>

      {ticketNotice && <div className="ly-ticket-notice">{ticketNotice}</div>}

      {activeView === 'create' ? (
        <form className="ly-ticket-form" onSubmit={(event) => void handleCreateTicket(event)} noValidate>
          <div className="ly-ticket-form-row wide">
            <label>
              <span className="required">问题类型</span>
              <select value={form.problemType} onChange={(event) => updateForm('problemType', event.target.value)} required>
                <option value="">请选择问题类型</option>
                {problemTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="ly-ticket-form-row wide">
            <label>
              <span className="required">意见反馈</span>
              <textarea
                value={form.feedback}
                onChange={(event) => updateForm('feedback', event.target.value)}
                placeholder="请输入问题描述"
                required
              />
            </label>
          </div>

          <div className="ly-ticket-form-row wide">
            <span>附件上传</span>
            <button
              className="ly-ticket-upload"
              type="button"
              onClick={() => ticketFileRef.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleTicketDrop}
            >
              <ImageUp size={30} />
              <strong>{ticketUploading ? '正在上传附件...' : '将文件拖到此处，或点击上传'}</strong>
              <em>支持图片、PDF、Word、Excel，最多 4 个附件</em>
            </button>
            <input ref={ticketFileRef} type="file" multiple hidden onChange={handleTicketFileInput} />
            {ticketFiles.length > 0 && (
              <div className="ly-ticket-file-list">
                {ticketFiles.map((file) => (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => setTicketFiles((current) => current.filter((item) => item.id !== file.id))}
                  >
                    <FileText size={14} />
                    <span>{file.originalName}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="ly-ticket-form-grid">
            <label>
              <span className="required">反馈人姓名</span>
              <input value={form.userName} onChange={(event) => updateForm('userName', event.target.value)} placeholder="请输入反馈人姓名" required />
            </label>
            <label>
              <span className="required">反馈人手机号</span>
              <input value={form.phone} onChange={(event) => updateForm('phone', event.target.value)} placeholder="请输入反馈人手机号" required />
            </label>
            <label>
              <span>门店编码</span>
              <input value={form.storeCode} onChange={(event) => updateForm('storeCode', event.target.value)} placeholder="请输入门店编码" />
            </label>
            <label>
              <span>昵称</span>
              <input value={form.nickname} onChange={(event) => updateForm('nickname', event.target.value)} placeholder="请输入昵称" />
            </label>
            <label>
              <span>联系方式</span>
              <input value={form.contact} onChange={(event) => updateForm('contact', event.target.value)} placeholder="请输入联系方式" />
            </label>
            <label>
              <span>合作伙伴类型</span>
              <select value={form.partnerType} onChange={(event) => updateForm('partnerType', event.target.value)}>
                {identities.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>公司名称</span>
              <input value={form.companyName} onChange={(event) => updateForm('companyName', event.target.value)} placeholder="请输入公司名称" />
            </label>
            <label>
              <span>公司SAP编码</span>
              <input value={form.sapCode} onChange={(event) => updateForm('sapCode', event.target.value)} placeholder="请输入SAP编码" />
            </label>
          </div>

          <div className="ly-ticket-form-row wide">
            <label>
              <span>反馈时间</span>
              <input type="datetime-local" value={form.feedbackAt} onChange={(event) => updateForm('feedbackAt', event.target.value)} />
            </label>
          </div>

          <div className="ly-ticket-location-grid">
            <label>
              <span>省份/直辖市</span>
              <select value={form.province} onChange={(event) => updateForm('province', event.target.value)}>
                <option value="">请选择省份</option>
                {provinceOptions.map((province) => (
                  <option key={province} value={province}>
                    {province}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>市</span>
              <select value={form.city} onChange={(event) => updateForm('city', event.target.value)}>
                <option value="">请选择市</option>
                {cityOptions.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>区/县</span>
              <select value={form.district} onChange={(event) => updateForm('district', event.target.value)}>
                <option value="">请选择区/县</option>
                {districtOptions.map((district) => (
                  <option key={district} value={district}>
                    {district}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="ly-ticket-form-actions">
            <button type="button" onClick={resetTicketForm}>
              重置
            </button>
            <button type="submit" disabled={ticketSubmitting}>
              {ticketSubmitting ? '提交中' : '提交工单'}
            </button>
          </div>
        </form>
      ) : (
        <div className="ly-ticket-list">
          {tickets.map((ticket) => (
            <article key={ticket.id}>
              <div>
                <strong>{ticket.title}</strong>
                <span>{ticket.id} · {ticket.identity} · {ticket.channel}</span>
              </div>
              <p>{ticket.summary}</p>
              <div className="ly-ticket-meta">
                <b>{ticket.priority}</b>
                <span>{ticket.status}</span>
                <span>{ticket.currentStaff}</span>
                <span>{ticket.feishuStatus}</span>
              </div>
              {canTransferTickets ? (
                <div className="ly-ticket-transfer">
                  <select
                    value={transferTargets[ticket.id] || supportStaff[0]?.id || ''}
                    onChange={(event) => setTransferTargets((current) => ({ ...current, [ticket.id]: event.target.value }))}
                  >
                    {supportStaff.map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.name} · {staff.status}
                      </option>
                    ))}
                  </select>
                  <button onClick={() => void handleTransfer(ticket)} disabled={transferringTicketId === ticket.id}>
                    {transferringTicketId === ticket.id ? '转派中' : '转派客服'}
                  </button>
                </div>
              ) : (
                <div className="ly-ticket-readonly">
                  <span>
                    <em>当前客服</em>
                    <strong>{ticket.currentStaff}</strong>
                  </span>
                  <span>
                    <em>处理状态</em>
                    <strong>{ticket.status}</strong>
                  </span>
                  <span>
                    <em>已读状态</em>
                    <strong>{ticket.read ? '客服已读' : '等待客服查看'}</strong>
                  </span>
                  <span>
                    <em>服务评价</em>
                    <strong>{ticket.rating || '-'}</strong>
                  </span>
                </div>
              )}
            </article>
          ))}
          {tickets.length === 0 && (
            <div className="ly-ticket-empty">
              <TicketCheck size={26} />
              <strong>暂无工单</strong>
              <span>提交新工单或从 AI 对话转人工后，会在这里展示处理状态。</span>
              <button onClick={() => setActiveView('create')}>提交新工单</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
