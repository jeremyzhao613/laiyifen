const nowIso = () => new Date().toISOString();
const nowText = () => new Date().toLocaleString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' });
const makeId = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const safeText = (value) => (typeof value === 'string' ? value.trim() : '');
const normalizeBaseUrl = (value) => safeText(value).replace(/\/+$/, '');
const localOnlyHostPattern = /^(localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|\[::1\]|::1)$/i;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization'
};

function envText(env, name, fallback = '') {
  return safeText(env?.[name] || fallback);
}

function getDifyRuntime(env = {}) {
  const apiUrl = normalizeBaseUrl(envText(env, 'DIFY_WORKFLOW_API_URL') || envText(env, 'DIFY_API_URL'));
  const apiKey = envText(env, 'DIFY_WORKFLOW_API_KEY') || envText(env, 'DIFY_API_KEY');
  let localOnlyUrl = false;
  try {
    localOnlyUrl = apiUrl ? localOnlyHostPattern.test(new URL(apiUrl).hostname) : false;
  } catch {
    localOnlyUrl = false;
  }
  const allowLocalDifyUrl = envText(env, 'ALLOW_LOCAL_DIFY_URL').toLowerCase() === 'true';
  const appMode = envText(env, 'DIFY_APP_MODE', 'workflow').toLowerCase();
  const responseMode = envText(env, 'DIFY_WORKFLOW_RESPONSE_MODE', 'blocking').toLowerCase();
  return {
    configured: Boolean(apiUrl && apiKey && (!localOnlyUrl || allowLocalDifyUrl)),
    configIssue: localOnlyUrl && !allowLocalDifyUrl ? 'DIFY_API_URL 指向 localhost，Cloudflare Pages Functions 无法访问本机服务。' : '',
    apiUrl,
    apiKey,
    appMode: appMode === 'chat' || appMode === 'chat-messages' ? 'chat' : appMode === 'auto' ? 'auto' : 'workflow',
    responseMode: responseMode === 'streaming' ? 'streaming' : 'blocking',
    inputKey: envText(env, 'DIFY_WORKFLOW_INPUT_KEY', 'customer_issue'),
    filesInputKey: envText(env, 'DIFY_WORKFLOW_FILES_INPUT_KEY'),
    filesInputMode: envText(env, 'DIFY_WORKFLOW_FILES_INPUT_MODE', 'single').toLowerCase() === 'array' ? 'array' : 'single',
    userPrefix: envText(env, 'DIFY_USER_PREFIX', 'laiyifen'),
    label: envText(env, 'DIFY_WORKFLOW_LABEL', 'Dify Workflow')
  };
}

function getDeepSeekRuntime(env = {}) {
  const apiKey = envText(env, 'DEEPSEEK_API_KEY');
  return {
    configured: Boolean(apiKey),
    apiUrl: normalizeBaseUrl(envText(env, 'DEEPSEEK_API_URL', 'https://api.deepseek.com')),
    apiKey,
    model: envText(env, 'DEEPSEEK_MODEL', 'deepseek-chat')
  };
}

function getAiRuntime(env = {}) {
  const dify = getDifyRuntime(env);
  const deepseek = getDeepSeekRuntime(env);
  return {
    dify,
    deepseek,
    connected: dify.configured || deepseek.configured
  };
}

const joinUrl = (baseUrl, suffix) => `${baseUrl}${suffix.startsWith('/') ? suffix : `/${suffix}`}`;

function getCollabPlatformBaseUrl(env = {}) {
  return normalizeBaseUrl(
    envText(env, 'COLLAB_PLATFORM_BASE_URL', 'https://scm.test.laiyifen.com/webadmin_vue/collaborationPlatform.html')
  ).replace(/#.*$/, '');
}

function getCollabPublicBaseUrl(env = {}) {
  return normalizeBaseUrl(envText(env, 'COLLAB_PLATFORM_PUBLIC_BASE', 'https://www.laiyifen.com'));
}

function buildCollabPlatformUrl(env = {}, hashPath = 'home') {
  return `${getCollabPlatformBaseUrl(env)}#/${String(hashPath || 'home').replace(/^#?\//, '')}`;
}

function getNavigationCatalog(env = {}) {
  const publicBase = getCollabPublicBaseUrl(env);
  return [
    {
      key: 'platform-home',
      label: '打开共创平台首页',
      url: buildCollabPlatformUrl(env, 'home'),
      group: 'platform',
      access: 'verified-route',
      description: '共创平台真实路由：/home。'
    },
    {
      key: 'platform-todo',
      label: '打开个人中心待办',
      url: buildCollabPlatformUrl(env, 'personal'),
      group: 'platform',
      access: 'verified-route',
      description: '共创平台真实路由：/personal；待办数据由消息接口加载。'
    },
    {
      key: 'platform-contract',
      label: '打开合同模板库',
      url: buildCollabPlatformUrl(env, 'templateManage/templateBase'),
      group: 'platform',
      access: 'verified-route',
      description: '共创平台真实路由：/templateManage/templateBase。'
    },
    {
      key: 'platform-settlement',
      label: '打开付款数据',
      url: buildCollabPlatformUrl(env, 'reconciliation/virify/paymentData'),
      group: 'platform',
      access: 'verified-route',
      description: '共创平台真实路由：/reconciliation/virify/paymentData。'
    },
    {
      key: 'platform-supplier-profile',
      label: '打开个人中心',
      url: buildCollabPlatformUrl(env, 'personal'),
      group: 'platform',
      access: 'verified-route',
      description: '共创平台真实路由：/personal。'
    },
    {
      key: 'platform-account',
      label: '打开个人中心',
      url: buildCollabPlatformUrl(env, 'personal'),
      group: 'platform',
      access: 'verified-route',
      description: '共创平台真实路由：/personal。'
    },
    {
      key: 'platform-franchise-opportunity',
      label: '查看加盟合作页面',
      url: joinUrl(publicBase, 'bejoiner'),
      group: 'public',
      access: 'public-link',
      description: '原站公开真实链接：/bejoiner。'
    },
    {
      key: 'platform-store-task',
      label: '打开个人中心待办',
      url: buildCollabPlatformUrl(env, 'personal'),
      group: 'platform',
      access: 'verified-route',
      description: '共创平台真实路由：/personal。'
    },
    {
      key: 'platform-distributor-order',
      label: '打开销售拼团订单',
      url: buildCollabPlatformUrl(env, 'sales/collageOrder/1'),
      group: 'platform',
      access: 'verified-route',
      description: '共创平台真实动态路由：/sales/collageOrder/:type。'
    },
    {
      key: 'platform-commodity-summary',
      label: '打开商品汇总',
      url: buildCollabPlatformUrl(env, 'sales/commoditySummary'),
      group: 'platform',
      access: 'verified-route',
      description: '共创平台真实路由：/sales/commoditySummary。'
    },
    {
      key: 'platform-feedback',
      label: '打开工单反馈',
      url: buildCollabPlatformUrl(env, 'feedback'),
      group: 'platform',
      access: 'verified-route',
      description: '共创平台真实路由：/feedback。'
    },
    {
      key: 'platform-phone-change',
      label: '打开手机号变更',
      url: buildCollabPlatformUrl(env, 'phoneNumberForm'),
      group: 'platform',
      access: 'verified-route',
      description: '共创平台真实路由：/phoneNumberForm。'
    },
    {
      key: 'platform-esign-org',
      label: '打开电签机构',
      url: buildCollabPlatformUrl(env, 'electrosignature/basicInfo/elecOrganizationList'),
      group: 'platform',
      access: 'verified-route',
      description: '共创平台真实路由：/electrosignature/basicInfo/elecOrganizationList。'
    },
    {
      key: 'franchise-public',
      label: '查看加盟合作页面',
      url: joinUrl(publicBase, 'bejoiner'),
      group: 'public',
      access: 'public-link',
      description: '加盟合作公开入口。'
    },
    {
      key: 'agency-public',
      label: '查看经销合作页面',
      url: joinUrl(publicBase, 'beagency'),
      group: 'public',
      access: 'public-link',
      description: '经销合作公开入口。'
    },
    {
      key: 'contact-public',
      label: '查看联系我们',
      url: joinUrl(publicBase, 'contact'),
      group: 'public',
      access: 'public-link',
      description: '官方联系方式页面。'
    },
    {
      key: 'integrity-platform',
      label: '查看廉洁诚信规范',
      url: buildCollabPlatformUrl(env, 'actionNorm'),
      group: 'platform',
      access: 'verified-route',
      description: '共创平台真实路由：/actionNorm。'
    }
  ];
}

function buildNavigationActions(env = {}, { query = '', category = '' } = {}) {
  const normalized = `${safeText(query)} ${safeText(category)}`.toLowerCase();
  const catalog = getNavigationCatalog(env);
  const actions = [];
  const pushByKey = (key) => {
    const target = catalog.find((item) => item.key === key);
    if (!target || actions.some((item) => item.url === target.url)) return;
    actions.push({
      type: 'navigate',
      label: target.label,
      path: target.key,
      url: target.url,
      description: target.description
    });
  };

  if (/手机号|手机|号码变更|换绑/.test(normalized)) {
    pushByKey('platform-phone-change');
  } else if (/工单|反馈|投诉|建议/.test(normalized)) {
    pushByKey('platform-feedback');
  } else if (/合同|授权|签章/.test(normalized)) {
    pushByKey('platform-contract');
  } else if (/结算|账单|发票|付款|财务/.test(normalized)) {
    pushByKey('platform-settlement');
  } else if (/商品|货品|销售汇总|商品汇总/.test(normalized)) {
    pushByKey('platform-commodity-summary');
  } else if (/待办|审批|待处理|待确认/.test(normalized)) {
    pushByKey('platform-todo');
  } else if (/加盟|商机|报名/.test(normalized)) {
    pushByKey('platform-franchise-opportunity');
  } else if (/门店|社区长|美食顾问/.test(normalized)) {
    pushByKey('platform-store-task');
  } else if (/经销商|经销|渠道|订单|对账|库存/.test(normalized)) {
    pushByKey('platform-distributor-order');
  } else if (/供应商|入驻|sap|主体|营业执照|资料/.test(normalized)) {
    pushByKey('platform-supplier-profile');
  } else if (/权限|账号|登录|入口|菜单|工作台/.test(normalized)) {
    pushByKey('platform-account');
  } else if (/举报|热线|联系|电话/.test(normalized)) {
    pushByKey('contact-public');
  } else if (/廉洁|诚信|准则/.test(normalized)) {
    pushByKey('integrity-platform');
  }

  if (actions.length === 0 && /加盟|门店|社区长|美食顾问/.test(normalized)) {
    pushByKey('franchise-public');
  }
  if (actions.length === 0 && /经销商|经销|渠道/.test(normalized)) {
    pushByKey('agency-public');
  }
  if (actions.length === 0 && /供应商|入驻|sap|合同|授权|待办|工单|订单|资料中心|菜单|首页|工作台|权限|账号|登录/.test(normalized)) {
    pushByKey('platform-home');
  }

  return actions.slice(0, 1);
}

function sanitizeExternalError(value = '') {
  return String(value)
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer ***')
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, 'sk-***')
    .slice(0, 300);
}

function buildAiHeaders(apiKey, contentType = 'application/json') {
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'ngrok-skip-browser-warning': 'true'
  };
  if (contentType) headers['Content-Type'] = contentType;
  return headers;
}

const agents = [
  {
    id: 'agent-router',
    name: '意图路由 Agent',
    owner: 'AI平台',
    status: 'online',
    duty: '识别用户身份、问题分类、优先级与是否需要转人工',
    api: 'pages-function'
  },
  {
    id: 'agent-knowledge',
    name: '知识库 Agent',
    owner: '共创客服',
    status: 'online',
    duty: '制度、流程、平台使用、常见问题',
    api: 'mock'
  },
  {
    id: 'agent-business',
    name: '业务数据 Agent',
    owner: '业务中台',
    status: 'standby',
    duty: '供应商、加盟商、经销商、工单、待办数据查询',
    api: 'mock'
  },
  {
    id: 'agent-file',
    name: '附件理解 Agent',
    owner: 'AI平台',
    status: 'online',
    duty: '图片、PDF、Excel、截图识别与脱敏',
    api: 'mock'
  },
  {
    id: 'agent-feishu',
    name: '飞书客服 Agent',
    owner: '客服运营',
    status: 'online',
    duty: '飞书通知、群机器人、客服接入、转派',
    api: 'mock'
  }
];

const supportStaff = [
  {
    id: 'cs-001',
    name: '共创客服-小周',
    group: '共创客服',
    status: 'online',
    categories: ['其他', '投诉建议', '产品咨询'],
    feishuUserId: 'ou_mock_zhou'
  },
  {
    id: 'cs-002',
    name: '供应链客服-林悦',
    group: '供应链',
    status: 'online',
    categories: ['供应商', '合同授权', '结算问题'],
    feishuUserId: 'ou_mock_lin'
  },
  {
    id: 'cs-003',
    name: '加盟运营-陈晨',
    group: '加盟运营',
    status: 'busy',
    categories: ['加盟商', '门店运营', '商机报名'],
    feishuUserId: 'ou_mock_chen'
  },
  {
    id: 'cs-004',
    name: '技术支持-吴越',
    group: '技术支持',
    status: 'offline',
    categories: ['技术问题', '页面故障', '账号权限'],
    feishuUserId: 'ou_mock_wu'
  }
];

const serviceHours = {
  enabled: true,
  workdays: '周一至周五',
  start: '09:00',
  end: '18:00',
  offHoursMessage: '人工客服服务时间在工作日9:00-18:00，请稍后在此时间段内联系人工客服。'
};

let tickets = [
  {
    id: 'TK-20260629-001',
    title: '供应商入驻后无法看到合同授权入口',
    userName: '王敏',
    phone: '138****2619',
    identity: '供应商',
    channel: '共创',
    priority: 'P0',
    category: '账号权限',
    status: '待处理',
    currentStaffId: 'cs-002',
    currentStaff: '供应链客服-林悦',
    rating: '-',
    serviceStartedAt: '2026-06-29 09:18',
    feishuStatus: '已通知',
    read: false,
    summary: '用户完成供应商入驻后，首页未出现合同授权入口，需要核验账号角色和菜单权限。',
    createdAt: '2026-06-29 09:17',
    updatedAt: '2026-06-29 09:18',
    transferLogs: []
  },
  {
    id: 'TK-20260629-002',
    title: '加盟商商机报名后不知道下一步',
    userName: '李然',
    phone: '136****8890',
    identity: '加盟商',
    channel: '飞书',
    priority: 'P1',
    category: '产品咨询',
    status: '处理中',
    currentStaffId: 'cs-003',
    currentStaff: '加盟运营-陈晨',
    rating: '-',
    serviceStartedAt: '2026-06-29 10:06',
    feishuStatus: '已通知',
    read: true,
    summary: '用户报名后需要系统引导补充资料，建议触发 AI 助手通知和任务卡片。',
    createdAt: '2026-06-29 10:05',
    updatedAt: '2026-06-29 10:14',
    transferLogs: []
  },
  {
    id: 'TK-20260628-015',
    title: 'AI 回答未结束仍可重复发送导致卡顿',
    userName: '赵启',
    phone: '139****6012',
    identity: '员工',
    channel: '共创',
    priority: 'P0',
    category: '技术问题',
    status: '已完成',
    currentStaffId: 'cs-004',
    currentStaff: '技术支持-吴越',
    rating: '满意',
    serviceStartedAt: '2026-06-28 16:21',
    feishuStatus: '已通知',
    read: true,
    summary: '需要在前端加发送中锁定和后端队列/限流，避免重复请求打满服务。',
    createdAt: '2026-06-28 16:18',
    updatedAt: '2026-06-28 17:02',
    transferLogs: []
  }
];

let conversationHistories = [];
const sessions = new Map();
const workflowAudits = [];

function json(payload, init = {}) {
  return Response.json(payload, {
    ...init,
    headers: {
      ...corsHeaders,
      ...(init.headers || {})
    }
  });
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function classifyIntent(text = '', files = []) {
  if (files.some((item) => item?.mime?.startsWith('image/'))) {
    return { category: '附件图片文件识别', priority: 'P1', agentId: 'agent-file' };
  }
  if (/卡死|故障|bug|报错|加载失败|不可用|接口错误|无法提交|无法发送/.test(text)) {
    return { category: '系统异常与缺陷', priority: 'P0', agentId: 'agent-router' };
  }
  if (/登录|密码|账号|账户|绑定|角色|权限|菜单/.test(text)) {
    return { category: '账号权限与登录', priority: 'P1', agentId: 'agent-business' };
  }
  if (/待办|工单|订单|审批|查询|状态|入口/.test(text)) {
    return { category: '菜单定位与操作引导', priority: 'P1', agentId: 'agent-business' };
  }
  if (/转人工|人工客服|评价服务|服务时间|客服/.test(text)) {
    return { category: '工单与人工客服', priority: 'P0', agentId: 'agent-feishu' };
  }
  if (/合同|结算|授权|签章|付款|发票/.test(text)) {
    return { category: '合同授权与结算', priority: 'P1', agentId: 'agent-business' };
  }
  if (/供应商|入驻|sap/i.test(text)) {
    return { category: '供应商入驻', priority: 'P1', agentId: 'agent-business' };
  }
  if (/加盟|商机|门店|开店|培训/.test(text)) {
    return { category: '加盟商商机与门店运营', priority: 'P1', agentId: 'agent-knowledge' };
  }
  if (/经销|库存|返利|渠道|对账/.test(text)) {
    return { category: '经销商业务问题', priority: 'P1', agentId: 'agent-business' };
  }
  return { category: '其他问题', priority: 'P2', agentId: 'agent-knowledge' };
}

function pickStaff(category = '') {
  if (/供应商|合同|结算/.test(category)) return supportStaff[1];
  if (/加盟|商机|门店/.test(category)) return supportStaff[2];
  if (/技术|异常|账号/.test(category)) return supportStaff[3];
  return supportStaff[0];
}

function buildDifyFilePayload(files = []) {
  return (Array.isArray(files) ? files : [])
    .filter((file) => safeText(file?.difyFileId))
    .map((file) => ({
      type: file.mime?.startsWith('image/') ? 'image' : 'document',
      transfer_method: 'local_file',
      upload_file_id: file.difyFileId
    }));
}

function buildDifyWorkflowInputs(runtime, { text, identity, files = [] }) {
  const inputs = {
    [runtime.inputKey]: text,
    customer_identity: identity,
    user_type: identity,
    identity,
    issue_type: classifyIntent(text, files).category
  };
  if (runtime.inputKey !== 'query') {
    inputs.query = text;
  }
  const filePayload = buildDifyFilePayload(files);
  if (runtime.filesInputKey && filePayload.length > 0) {
    inputs[runtime.filesInputKey] = runtime.filesInputMode === 'array' ? filePayload : filePayload[0];
  }
  return inputs;
}


const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const META_KEY_PATTERN = /(^|\.)(id|task_id|workflow_id|conversation_id|message_id|run_id|created_at|updated_at|finished_at|status|elapsed|duration|input|inputs?|outputs?|metadata|trace)$/i;
const ANSWER_KEY_PATTERN = /(^|\.)(answer|text|result|output|reply|response|content|final_answer|final_response|message|agent_message)$/i;

function hasChineseCharacters(value = '') {
  return /[\u4e00-\u9fff]/.test(value);
}

function collectDifyTextCandidates(value, path = '') {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    return [{ value: trimmed, path }];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectDifyTextCandidates(item, `${path}[${index}]`));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) =>
      collectDifyTextCandidates(child, path ? `${path}.${key}` : key)
    );
  }
  return [];
}

function scoreDifyTextCandidate(candidate) {
  const { value, path = '' } = candidate;
  let score = value.length;
  if (UUID_PATTERN.test(value)) score -= 200;
  if (hasChineseCharacters(value)) score += 40;
  if (ANSWER_KEY_PATTERN.test(path)) score += 120;
  if (META_KEY_PATTERN.test(path)) score -= 120;
  if (value.length > 30) score += 20;
  if (/[。！？；,，.!?]/.test(value)) score += 10;
  if (value.length < 12) score -= 8;
  return score;
}

function getDirectDifyField(outputs, key) {
  const direct = outputs?.[key];
  if (typeof direct === 'string') return direct.trim();
  if (Array.isArray(direct)) {
    for (const item of direct) {
      if (typeof item === 'string' && item.trim()) return item.trim();
    }
  }
  if (direct && typeof direct === 'object') {
    const nested = collectDifyTextCandidates(direct);
    if (nested.length > 0) {
      const sorted = nested
        .map((item) => ({ ...item, score: scoreDifyTextCandidate(item) }))
        .sort((a, b) => b.score - a.score);
      if (sorted[0]?.score > -100) return sorted[0].value;
    }
  }
  return '';
}

function extractDifyText(data = {}) {
  const outputs = data?.data?.outputs || data?.outputs || {};
  const primarySources = [outputs, data?.data || {}, data];
  const preferenceKeys = ['answer', 'text', 'result', 'output', 'reply', 'response', 'content', 'final_answer', 'final_response', 'message'];
  for (const source of primarySources) {
    for (const key of preferenceKeys) {
      const hit = getDirectDifyField(source, key);
      if (hit && !UUID_PATTERN.test(hit)) return hit;
    }
  }
  for (const source of primarySources) {
    const candidates = collectDifyTextCandidates(source)
      .map((item) => ({ ...item, score: scoreDifyTextCandidate(item) }))
      .filter((item) => item.score > -200)
      .sort((a, b) => b.score - a.score);
    if (candidates[0]?.score > 0) return candidates[0].value;
  }
  return '';
}

function parseDifySseChunk(chunk = '') {
  const dataLines = String(chunk)
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim());
  const raw = dataLines.join('\n').trim();
  if (!raw || raw === '[DONE]') return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function readDifyStream(response) {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let buffer = '';
  let streamedText = '';
  let finalEvent = null;

  const handleEvent = (event) => {
    if (!event?.event) return;
    if (event.event === 'text_chunk') {
      streamedText += safeText(event.data?.text || '');
    }
    if (event.event === 'message' || event.event === 'agent_message') {
      streamedText += safeText(event.answer || event.data?.answer || '');
    }
    if (event.event === 'workflow_finished' || event.event === 'message_end') {
      finalEvent = event;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split(/\n\n/);
    buffer = parts.pop() || '';
    for (const part of parts) {
      const event = parseDifySseChunk(part);
      if (event) handleEvent(event);
    }
  }
  if (buffer.trim()) {
    const event = parseDifySseChunk(buffer);
    if (event) handleEvent(event);
  }
  return streamedText || extractDifyText(finalEvent || {});
}

async function readDifyResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/event-stream')) {
    return readDifyStream(response);
  }
  const data = await response.json().catch(() => ({}));
  return extractDifyText(data);
}

async function callDifyWorkflow(runtime, { text, identity, files = [] }) {
  const response = await fetch(`${runtime.apiUrl}/workflows/run`, {
    method: 'POST',
    headers: buildAiHeaders(runtime.apiKey),
    body: JSON.stringify({
      inputs: buildDifyWorkflowInputs(runtime, { text, identity, files }),
      response_mode: runtime.responseMode,
      user: `${runtime.userPrefix}-${identity || 'user'}`
    })
  });
  if (!response.ok) {
    throw new Error(`Dify workflow ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }
  const reply = await readDifyResponse(response);
  if (!reply) throw new Error('Dify workflow returned empty answer');
  return reply;
}

async function callDifyChat(runtime, { text, identity, files = [] }) {
  const response = await fetch(`${runtime.apiUrl}/chat-messages`, {
    method: 'POST',
    headers: buildAiHeaders(runtime.apiKey),
    body: JSON.stringify({
      inputs: {
        customer_identity: identity,
        user_type: identity
      },
      query: text,
      response_mode: runtime.responseMode,
      user: `${runtime.userPrefix}-${identity || 'user'}`,
      files: buildDifyFilePayload(files)
    })
  });
  if (!response.ok) {
    throw new Error(`Dify chat ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }
  const reply = await readDifyResponse(response);
  if (!reply) throw new Error('Dify chat returned empty answer');
  return reply;
}

async function callDify(env, payload) {
  const runtime = getDifyRuntime(env);
  if (!runtime.configured) return null;
  if (runtime.appMode === 'chat') {
    return {
      source: 'dify',
      label: runtime.label,
      reply: await callDifyChat(runtime, payload)
    };
  }
  if (runtime.appMode === 'auto') {
    try {
      return {
        source: 'dify',
        label: runtime.label,
        reply: await callDifyWorkflow(runtime, payload)
      };
    } catch (workflowError) {
      return {
        source: 'dify',
        label: runtime.label,
        reply: await callDifyChat(runtime, payload),
        fallbackReason: sanitizeExternalError(workflowError.message)
      };
    }
  }
  return {
    source: 'dify',
    label: runtime.label,
    reply: await callDifyWorkflow(runtime, payload)
  };
}

function buildDeepSeekPrompt(identity = '供应商') {
  return [
    '你是来伊份共创平台的 AI 客服助手“小伊”。',
    `当前用户身份：${identity}。`,
    '请用中文回答，先给结论，再给可执行步骤。',
    '不能编造后台实时数据；如果需要权限、工单或页面状态核验，请提示用户转人工或提交工单。',
    '服务时间：人工客服周一至周五 09:00-18:00。'
  ].join('\n');
}

async function callDeepSeek(env, { text, identity }) {
  const runtime = getDeepSeekRuntime(env);
  if (!runtime.configured) return null;
  const response = await fetch(`${runtime.apiUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${runtime.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: runtime.model,
      messages: [
        { role: 'system', content: buildDeepSeekPrompt(identity) },
        { role: 'user', content: text }
      ],
      temperature: 0.2
    })
  });
  if (!response.ok) {
    throw new Error(`DeepSeek ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }
  const data = await response.json();
  const reply = safeText(data?.choices?.[0]?.message?.content);
  if (!reply) throw new Error('DeepSeek returned empty answer');
  return {
    source: 'deepseek',
    label: runtime.model,
    reply
  };
}

async function callConfiguredAi(env, payload) {
  const errors = [];
  try {
    const dify = await callDify(env, payload);
    if (dify?.reply) return dify;
  } catch (error) {
    errors.push(`Dify: ${sanitizeExternalError(error.message)}`);
  }
  try {
    const deepseek = await callDeepSeek(env, payload);
    if (deepseek?.reply) return deepseek;
  } catch (error) {
    errors.push(`DeepSeek: ${sanitizeExternalError(error.message)}`);
  }
  return errors.length ? { source: 'mock', errors } : null;
}

function getAiSource(env = {}) {
  const runtime = getAiRuntime(env);
  if (runtime.dify.configured) {
    return {
      source: 'dify',
      label: runtime.dify.label,
      connected: true,
      appMode: runtime.dify.appMode,
      modelProfile: envText(env, 'DIFY_MODEL_PROFILE', 'configured'),
      directMultimodal: Boolean(runtime.dify.filesInputKey),
      strictMultimodal: envText(env, 'DIFY_MULTIMODAL_STRICT', 'true') !== 'false',
      localOcrEnabled: false
    };
  }
  if (runtime.deepseek.configured) {
    return {
      source: 'deepseek',
      label: `DeepSeek ${runtime.deepseek.model}`,
      connected: true,
      appMode: 'chat-completions',
      modelProfile: 'deepseek',
      directMultimodal: false,
      strictMultimodal: false,
      localOcrEnabled: false
    };
  }
  return {
    source: 'mock',
    label: '线上演示 Mock AI',
    connected: true,
    appMode: 'demo',
    modelProfile: 'mock',
    directMultimodal: false,
    strictMultimodal: false,
    localOcrEnabled: false
  };
}

function buildBootstrapPayload(env = {}) {
  const runtime = getAiRuntime(env);
  return {
    quickQuestions: [],
    tickets,
    conversationHistories,
    agents,
    supportStaff,
    serviceHours,
    difyConnected: runtime.dify.configured,
    integrationSources: {
      dataSource: {
        source: 'cloudflare-pages-functions',
        label: 'Cloudflare Pages 演示数据',
        enabled: true,
        endpointCount: 8,
        writeEnabled: true
      },
      aiSource: getAiSource(env),
      originalAiSource: {
        source: 'cloudflare-pages-functions-ai',
        label: runtime.connected ? 'Pages Functions 已接入 AI Secret' : 'Pages Functions 未配置可用 AI Secret',
        enabled: runtime.connected,
        endpointCount: runtime.connected ? 2 : 0,
        usage: runtime.dify.configIssue
          ? `${runtime.dify.configIssue} 请改成公网可访问的 Dify API 地址，或继续使用 DeepSeek 兜底。`
          : runtime.connected
            ? '线上聊天接口会优先调用 Dify，失败后按配置降级 DeepSeek/Mock。'
            : '请在 Cloudflare Pages 环境变量/Secrets 中配置公网 DIFY_API_URL、DIFY_API_KEY 或 DEEPSEEK_API_KEY。'
      }
    },
    customerAiRemote: {
      enabled: false,
      ok: false,
      endpoints: 0,
      remoteAiEnabled: false,
      successfulReads: 0,
      failedReads: 0
    }
  };
}

async function buildAssistantMessage({ text, identity, files = [], env = {} }) {
  const intent = classifyIntent(text, files);
  const agent = agents.find((item) => item.id === intent.agentId) || agents[1];
  const actionLabel = /转人工|客服|投诉|工单/.test(text) ? '转人工客服' : '提交工单';
  const aiResult = await callConfiguredAi(env, { text, identity, files });
  const hasRealAnswer = aiResult?.reply && aiResult.source !== 'mock';
  const fileNote =
    files.length > 0 && !hasRealAnswer
      ? `\n\n已收到 ${files.length} 个附件。当前环境没有拿到可用的多模态 AI 回复，已先按文字和附件元信息处理。`
      : '';
  const answer = hasRealAnswer
    ? aiResult.reply
    : [
        `我先按「${identity}」身份把问题归到「${intent.category}」。`,
        '建议先核对账号角色、当前待办状态和页面入口；如果涉及审批、合同、结算或资料补交，请保留页面截图和工单编号。',
        getAiRuntime(env).connected
          ? '已尝试调用线上 AI 接口，但当前调用失败，已自动降级为 Pages Functions 兜底回复。'
          : '当前 Pages Functions 未配置 Dify/DeepSeek Secret，已使用线上演示 Mock 回复。'
      ].join('\n');
  const modeLabel = hasRealAnswer ? (aiResult.source === 'dify' ? 'Dify' : 'DeepSeek') : 'Pages Functions Mock';

  return {
    id: makeId('msg'),
    role: 'assistant',
    text: `${answer}${fileNote}`,
    category: intent.category,
    priority: intent.priority,
    source: hasRealAnswer ? aiResult.source : 'mock',
    agent: hasRealAnswer
      ? {
      ...agent,
      status: 'online',
      owner: modeLabel,
      api: aiResult.source
    }
      : agent,
    citations: [
      { label: '运行环境', value: 'Cloudflare Pages Functions' },
      { label: '模式', value: modeLabel },
      ...(aiResult?.fallbackReason ? [{ label: '降级说明', value: aiResult.fallbackReason }] : []),
      ...(aiResult?.errors?.length ? [{ label: 'AI 调用降级', value: aiResult.errors.join('；') }] : [])
    ],
    actions: [
      ...buildNavigationActions(env, { query: text, category: intent.category }),
      {
        type: 'ticket',
        label: actionLabel,
        description: '生成演示工单并接入人工客服流程'
      }
    ],
    createdAt: nowIso()
  };
}

async function fileToDataUrl(file) {
  if (!file?.type?.startsWith('image/') || file.size > 2 * 1024 * 1024) {
    return '';
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return `data:${file.type};base64,${btoa(binary)}`;
}

function createTicketFromPayload(payload) {
  const intent = classifyIntent(payload.title || payload.summary || '');
  const staff = pickStaff(payload.category || intent.category);
  const ticket = {
    id: `TK-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${String(tickets.length + 1).padStart(3, '0')}`,
    title: payload.title || '用户请求转人工',
    userName: payload.userName || '演示用户',
    phone: payload.phone || '138****0000',
    identity: payload.identity || '供应商',
    channel: payload.channel || '共创',
    priority: payload.priority || intent.priority,
    category: payload.category || intent.category,
    status: '待处理',
    currentStaffId: staff.id,
    currentStaff: staff.name,
    rating: '-',
    serviceStartedAt: nowText(),
    feishuStatus: '已通知',
    read: false,
    summary: payload.summary || 'AI 助手转人工生成工单，已保留当前对话上下文。',
    createdAt: nowText(),
    updatedAt: nowText(),
    transferLogs: []
  };
  tickets = [ticket, ...tickets].slice(0, 50);
  conversationHistories = [
    {
      id: `history-${ticket.id}`,
      title: `转人工：${ticket.title}`,
      type: 'service',
      identity: ticket.identity,
      channel: ticket.channel,
      status: ticket.status,
      staffName: ticket.currentStaff,
      ticketId: ticket.id,
      updatedAt: ticket.updatedAt,
      messages: [
        {
          id: makeId('history-msg'),
          role: 'system',
          sender: '系统',
          text: `已生成工单 ${ticket.id}，当前分配给 ${ticket.currentStaff}。`,
          createdAt: ticket.createdAt
        },
        {
          id: makeId('history-msg'),
          role: 'staff',
          sender: ticket.currentStaff,
          text: `您好，我是${ticket.currentStaff}，当前通过公网演示接口继续为您处理。`,
          createdAt: ticket.serviceStartedAt
        }
      ]
    },
    ...conversationHistories
  ].slice(0, 20);
  return ticket;
}

async function uploadFileToDify(env, file) {
  const runtime = getDifyRuntime(env);
  if (!runtime.configured) return null;
  const form = new FormData();
  form.append('file', file, file.name || 'upload');
  form.append('user', `${runtime.userPrefix}-upload`);
  const response = await fetch(`${runtime.apiUrl}/files/upload`, {
    method: 'POST',
    headers: buildAiHeaders(runtime.apiKey, ''),
    body: form
  });
  if (!response.ok) {
    throw new Error(`Dify upload ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }
  return response.json();
}

async function handleRequest(request, env = {}) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, '').replace(/\/$/, '');
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (method === 'GET' && path === 'health') {
    return json({
      ok: true,
      runtime: 'cloudflare-pages-functions',
      ai: getAiSource(env),
      time: nowIso()
    });
  }

  if (method === 'GET' && path === 'bootstrap') {
    return json(buildBootstrapPayload(env));
  }

  if (method === 'GET' && path === 'tickets') {
    return json(tickets);
  }

  if (method === 'GET' && path === 'quick-questions') {
    return json([]);
  }

  if (method === 'GET' && path === 'workflow/audits') {
    return json({ total: workflowAudits.length, items: workflowAudits.slice(-50).reverse() });
  }

  if (method === 'GET' && path === 'agents') {
    return json({ agents, supportStaff });
  }

  if (method === 'GET' && path === 'agents/runtime') {
    const runtime = getAiRuntime(env);
    return json({
      connected: runtime.connected,
      agents: agents.map((agent) => ({
        id: agent.id,
        label: agent.name,
        configured: agent.id === 'agent-feishu' ? true : runtime.connected,
        apiUrlConfigured: runtime.dify.configured || runtime.deepseek.configured,
        apiKeyConfigured: runtime.connected,
        mode: runtime.dify.configured ? runtime.dify.appMode : runtime.deepseek.configured ? 'deepseek' : 'mock'
      }))
    });
  }

  if (method === 'GET' && path === 'integration/sources') {
    return json(buildBootstrapPayload(env).integrationSources);
  }

  if (method === 'GET' && path === 'navigation/catalog') {
    return json({
      note: '返回共创平台 bundle 中已确认的真实 hash 路由和公开链接。',
      baseUrls: {
        collabPlatformBaseUrl: getCollabPlatformBaseUrl(env),
        collabPublicBaseUrl: getCollabPublicBaseUrl(env)
      },
      items: getNavigationCatalog(env)
    });
  }

  if (method === 'POST' && path === 'chat/start') {
    const body = await readJson(request);
    const session = {
      id: makeId('session'),
      userId: body.userId || 'demo-user',
      identity: body.identity || '供应商',
      messages: [],
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    sessions.set(session.id, session);
    return json({ id: session.id }, { status: 201 });
  }

  if (method === 'POST' && path === 'chat/message') {
    const body = await readJson(request);
    const text = safeText(body.text);
    if (!text) return json({ message: '消息内容不能为空。' }, { status: 400 });

    let session = sessions.get(body.sessionId);
    if (!session) {
      session = {
        id: makeId('session'),
        userId: 'demo-user',
        identity: body.identity || '供应商',
        messages: [],
        createdAt: nowIso(),
        updatedAt: nowIso()
      };
      sessions.set(session.id, session);
    }

    const message = await buildAssistantMessage({
      text,
      identity: body.identity || session.identity || '供应商',
      files: Array.isArray(body.files) ? body.files : [],
      env
    });
    session.messages.push({ id: makeId('msg'), role: 'user', text, createdAt: nowIso() }, message);
    session.updatedAt = nowIso();
    return json({ sessionId: session.id, message, pendingTicket: /转人工|客服|投诉|工单/.test(text) });
  }

  if (method === 'POST' && path === 'upload') {
    const form = await request.formData();
    const file = form.get('file');
    if (!file || typeof file === 'string') {
      return json({ message: 'File is required' }, { status: 400 });
    }
    const id = makeId('file');
    let difyUpload = null;
    let difyUploadError = '';
    try {
      difyUpload = await uploadFileToDify(env, file);
    } catch (error) {
      difyUploadError = sanitizeExternalError(error.message);
    }
    return json(
      {
        id,
        originalName: file.name || 'upload',
        name: id,
        mime: file.type || 'application/octet-stream',
        size: file.size || 0,
        url: await fileToDataUrl(file),
        extractedText: difyUpload?.id
          ? '文件已上传到 Pages Functions，并已同步到 Dify 文件接口。'
          : '文件已上传到公网演示接口；正式内容理解需接入 Dify/多模态模型。',
        analysisMode: file.type?.startsWith('image/') ? 'multimodal-direct' : 'file',
        difyFileId: difyUpload?.id || '',
        difyFileIds: difyUpload?.id ? { 'dify-workflow': difyUpload.id } : {},
        difyUploadErrors: difyUpload?.id ? [] : [difyUploadError || '公网环境未配置 Dify 文件上传凭证。']
      },
      { status: 201 }
    );
  }

  if (method === 'POST' && path === 'tickets') {
    const body = await readJson(request);
    return json(createTicketFromPayload(body), { status: 201 });
  }

  const ticketMessageMatch = path.match(/^tickets\/([^/]+)\/messages$/);
  if (method === 'POST' && ticketMessageMatch) {
    const body = await readJson(request);
    const ticket = tickets.find((item) => item.id === decodeURIComponent(ticketMessageMatch[1]));
    const text = safeText(body.text);
    if (!ticket) return json({ message: '工单不存在。' }, { status: 404 });
    if (!text) return json({ message: '消息内容不能为空。' }, { status: 400 });
    ticket.status = '处理中';
    ticket.read = true;
    ticket.updatedAt = nowText();
    const message = {
      id: makeId('ticket-msg'),
      role: 'staff',
      sender: ticket.currentStaff,
      text: `我是${ticket.currentStaff}，已经收到你补充的问题：${text.length > 36 ? `“${text.slice(0, 36)}...”` : `“${text}”`}。我先核对当前账号与工单进度，有结果会直接同步。`,
      createdAt: nowText()
    };
    return json({ ticket, message });
  }

  const ticketTransferMatch = path.match(/^tickets\/([^/]+)\/transfer$/);
  if (method === 'POST' && ticketTransferMatch) {
    const body = await readJson(request);
    if (body.actorRole !== 'support') return json({ message: '仅客服人员可转派工单。' }, { status: 403 });
    const ticket = tickets.find((item) => item.id === decodeURIComponent(ticketTransferMatch[1]));
    const staff = supportStaff.find((item) => item.id === body.staffId);
    if (!ticket || !staff) return json({ message: '工单或目标客服不存在。' }, { status: 404 });
    ticket.transferLogs.push({
      from: ticket.currentStaff,
      to: staff.name,
      reason: body.reason || '客服主动转派',
      at: nowText()
    });
    ticket.currentStaffId = staff.id;
    ticket.currentStaff = staff.name;
    ticket.status = '已转派';
    ticket.updatedAt = nowText();
    return json(ticket);
  }

  const ticketPatchMatch = path.match(/^tickets\/([^/]+)$/);
  if (method === 'PATCH' && ticketPatchMatch) {
    const body = await readJson(request);
    const ticket = tickets.find((item) => item.id === decodeURIComponent(ticketPatchMatch[1]));
    if (!ticket) return json({ message: '工单不存在。' }, { status: 404 });
    Object.assign(ticket, body, { updatedAt: nowText() });
    return json(ticket);
  }

  if (method === 'POST' && path === 'quick-questions') {
    const body = await readJson(request);
    return json(
      {
        id: makeId('qq'),
        title: body.title || '新的快捷问题',
        identity: body.identity || '供应商',
        sort: Number(body.sort || 1),
        enabled: body.enabled !== false,
        agent: body.agent || 'agent-knowledge'
      },
      { status: 201 }
    );
  }

  if (method === 'POST' && path === 'feishu/notify') {
    return json({ ok: true, mode: 'mock', message: '公网演示环境已模拟飞书通知。' });
  }

  return json({ message: `API route not found: /api/${path}` }, { status: 404 });
}

export const onRequest = ({ request, env }) => handleRequest(request, env);
