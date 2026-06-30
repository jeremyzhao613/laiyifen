import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 8788);
const uploadDir = path.join(process.cwd(), 'uploads');
const execFileAsync = promisify(execFile);

fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 20 * 1024 * 1024
  }
});

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(uploadDir));

const now = () => new Date().toISOString();
const makeId = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const isImageMime = (mime) => mime?.startsWith('image/');
const detectDifyFileType = (mime) => (isImageMime(mime) ? 'image' : 'document');
const visionRequestPattern = /(截图|截屏|图片|照片|相片|界面截图|页面截图|界面|页面|二维码|条码|票据|发票|ocr|OCR|视觉|多模态|识别|看.*(图|张|界面|页面)|这张(图|图片|截图|照片))/;
const isVisionRequest = (text = '') => visionRequestPattern.test(text || '');
const validInputModes = ['text', 'multimodal'];
const languageLabelMap = {
  'auto': '自动识别',
  'zh-CN': '中文',
  'en-US': 'English',
  'ja-JP': '日本語',
  'ko-KR': '한국어'
};
const supportedLanguages = Object.keys(languageLabelMap);
const normalizeInputMode = (mode) => (mode === 'multimodal' ? 'multimodal' : 'text');
const normalizeLanguage = (value) => (supportedLanguages.includes(value) ? value : 'auto');
const normalizeTranslation = (value = {}) => {
  const enabled = Boolean(value?.enabled);
  const sourceLanguage = normalizeLanguage(value?.sourceLanguage || 'auto');
  const targetLanguage = normalizeLanguage(value?.targetLanguage || (enabled ? 'zh-CN' : 'auto'));
  return { enabled, sourceLanguage, targetLanguage };
};
const workflowConfig = {
  version: '1.1.0',
  confidenceThreshold: 0.7,
  actionWhitelist: ['knowledge', 'multimodal', 'mcp', 'ticket', 'chat', 'external'],
  highRiskKeywords: /修改|删除|导出|审批(通过|驳回)|外部跳转|第三方|跳转到|更新|变更/,
  confirmKeywords: /(确认执行|确认|同意执行|同意|允许执行|继续执行)/
};
const workflowRouteConfig = {
  handoff: {
    label: '转人工',
    patterns: [/转人工|人工客服|客服|工单|投诉|建议|反馈|联系工作人员/]
  },
  task: {
    label: '任务执行',
    patterns: [/提交|新建|修改|更新|删除|导出|审批|同意|驳回|执行|创建|变更/] 
  },
  analytics: {
    label: '数据分析',
    patterns: [/待办|审批|工单|订单|状态|报表|统计|账单|结算|查询|数据|列表|我的/] 
  },
  knowledge: {
    label: '知识问答',
    patterns: [
      /如何|怎么办|如何做|查询流程|说明|规则|权限|入口|菜单|页面|按钮|操作指南|产品咨询|流程|为什么/, 
      /入驻|供应商|加盟商|经销商|账号|登录|密码|合同授权|角色|功能说明/
    ]
  }
};
const clamp01 = (value) => Math.max(0, Math.min(1, Number(value)));
const normalizeConfidence = (value) => Number(clamp01(value).toFixed(3));
const safeText = (value) => (typeof value === 'string' ? value.trim() : '');
const isEnvTrue = (name, fallback = false) => {
  const value = safeText(process.env[name]).toLowerCase();
  if (!value) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value);
};
const isEnvFalse = (name) => ['0', 'false', 'no', 'off'].includes(safeText(process.env[name]).toLowerCase());
const shouldUseLocalOcr = () => isEnvTrue('ENABLE_LOCAL_OCR', false);
const shouldUseDifyDirectMultimodal = () => !isEnvFalse('DIFY_DIRECT_MULTIMODAL');
const shouldRequireDirectMultimodal = () => !isEnvFalse('DIFY_MULTIMODAL_STRICT');
const getDifyRequestUser = () => `${process.env.DIFY_USER_PREFIX || 'laiyifen'}-user`;
const normalizeUploadFileName = (name = '') => {
  const text = safeText(name);
  if (!text) return 'upload';
  if (!/[ÃÂÄÅÆÇÈÉæåäöü]/.test(text)) return text;
  try {
    const decoded = Buffer.from(text, 'latin1').toString('utf8');
    return decoded.includes('�') ? text : decoded;
  } catch {
    return text;
  }
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const sourceSpanFromFile = (file = {}, index = 0) => ({
  file_id: file.id || file.name || `attachment-${index}`,
  source_type: isImageMime(file.mime) ? 'image' : 'document',
  region: 'full_frame',
  bbox: '0,0,1,1'
});
const isRoleSceneConflict = (text, identity) => {
  const normalized = safeText(text).toLowerCase();
  if (!normalized) return false;
  if (identity === '员工' && /加盟商|加盟|供应商|经销商/.test(normalized)) return true;
  if (identity === '加盟商' && /供应商|经销商|员工|内部/.test(normalized)) return true;
  if (identity === '供应商' && /员工|内部|经销商/.test(normalized)) return true;
  if (identity === '经销商' && /员工|内部|加盟商/.test(normalized)) return true;
  return false;
};
const getPriorityFromConfidence = (value) => (value >= 0.85 ? 'low' : value >= 0.7 ? 'medium' : 'high');
const defaultCustomerAiPageUrl =
  process.env.CUSTOMER_AI_PAGE_URL || 'https://customer-ai.test.laiyifen.com/scm-customer-web-static/?token=&pathName=home';
const customerAiRequestHeaders = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
};
const difyAgentEnvMap = {
  'agent-router': {
    label: '意图路由 Agent',
    apiUrlEnv: 'DIFY_ROUTER_API_URL',
    apiKeyEnv: 'DIFY_ROUTER_API_KEY'
  },
  'agent-knowledge': {
    label: '知识库 Agent',
    apiUrlEnv: 'DIFY_KNOWLEDGE_API_URL',
    apiKeyEnv: 'DIFY_KNOWLEDGE_API_KEY'
  },
  'agent-business': {
    label: '业务数据 Agent',
    apiUrlEnv: 'DIFY_BUSINESS_API_URL',
    apiKeyEnv: 'DIFY_BUSINESS_API_KEY'
  },
  'agent-file': {
    label: '附件理解 Agent',
    apiUrlEnv: 'DIFY_FILE_API_URL',
    apiKeyEnv: 'DIFY_FILE_API_KEY'
  },
  'agent-feishu': {
    label: '飞书客服 Agent',
    apiUrlEnv: 'DIFY_FEISHU_API_URL',
    apiKeyEnv: 'DIFY_FEISHU_API_KEY'
  }
};

function normalizeDifyApiUrl(value) {
  return safeText(value || process.env.DIFY_API_URL).replace(/\/$/, '');
}

function getDifyAppMode() {
  const mode = safeText(process.env.DIFY_APP_MODE || 'workflow').toLowerCase();
  if (mode === 'chat' || mode === 'chat-messages') return 'chat';
  if (mode === 'auto') return 'auto';
  return 'workflow';
}

function getDifyWorkflowInputKey() {
  return safeText(process.env.DIFY_WORKFLOW_INPUT_KEY) || 'customer_issue';
}

function getDifyWorkflowFilesInputKey() {
  return safeText(process.env.DIFY_WORKFLOW_FILES_INPUT_KEY);
}

function getDifyWorkflowFilesInputMode() {
  const mode = safeText(process.env.DIFY_WORKFLOW_FILES_INPUT_MODE || 'single').toLowerCase();
  return mode === 'array' || mode === 'multi' || mode === 'multiple' ? 'array' : 'single';
}

function getDifyWorkflowIssueTypeMode() {
  const mode = safeText(process.env.DIFY_WORKFLOW_ISSUE_TYPE_MODE || 'legacy').toLowerCase();
  return mode === 'laiyifen' || mode === 'fine' || mode === 'category' ? 'laiyifen' : 'legacy';
}

function getDifyWorkflowResponseMode() {
  const mode = safeText(process.env.DIFY_WORKFLOW_RESPONSE_MODE || 'streaming').toLowerCase();
  return mode === 'blocking' ? 'blocking' : 'streaming';
}

function getDifyWorkflowRuntime() {
  const apiUrl = normalizeDifyApiUrl(process.env.DIFY_WORKFLOW_API_URL || process.env.DIFY_API_URL);
  const apiKey = safeText(process.env.DIFY_WORKFLOW_API_KEY || process.env.DIFY_API_KEY);
  if (!apiUrl || !apiKey) {
    return null;
  }
  return {
    agentId: 'dify-workflow',
    label: process.env.DIFY_WORKFLOW_LABEL || '智能客服分流助手 Workflow',
    apiUrl,
    apiKey,
    source: process.env.DIFY_WORKFLOW_API_KEY ? 'DIFY_WORKFLOW_API_KEY' : 'DIFY_API_KEY'
  };
}

function getDifyRuntime(agentId = 'agent-knowledge') {
  const definition = difyAgentEnvMap[agentId] || difyAgentEnvMap['agent-knowledge'];
  const apiUrl = normalizeDifyApiUrl(process.env[definition.apiUrlEnv]);
  const apiKey = safeText(process.env[definition.apiKeyEnv] || process.env.DIFY_API_KEY);
  if (!apiUrl || !apiKey) {
    return null;
  }
  return {
    agentId,
    label: definition.label,
    apiUrl,
    apiKey,
    source: process.env[definition.apiKeyEnv] ? definition.apiKeyEnv : 'DIFY_API_KEY'
  };
}

function getDifyRuntimeStatus() {
  const workflowRuntime = getDifyWorkflowRuntime();
  return [
    {
      agentId: 'dify-workflow',
      label: workflowRuntime?.label || '智能客服分流助手 Workflow',
      connected: Boolean(workflowRuntime),
      apiUrl: workflowRuntime?.apiUrl || '',
      credentialSource: workflowRuntime?.source || '',
      appMode: getDifyAppMode(),
      inputKey: getDifyWorkflowInputKey()
    },
    ...Object.keys(difyAgentEnvMap).map((agentId) => {
      const runtime = getDifyRuntime(agentId);
      return {
        agentId,
        label: difyAgentEnvMap[agentId].label,
        connected: Boolean(runtime),
        apiUrl: runtime?.apiUrl || '',
        credentialSource: runtime?.source || '',
        appMode: 'chat'
      };
    })
  ];
}

function getDeepSeekRuntime() {
  const apiUrl = safeText(process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com').replace(/\/$/, '');
  const apiKey = safeText(process.env.DEEPSEEK_API_KEY);
  const model = safeText(process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash');
  const visionModel = safeText(process.env.DEEPSEEK_VISION_MODEL || model);
  const enableImageUrl = safeText(process.env.DEEPSEEK_ENABLE_IMAGE_URL).toLowerCase() === 'true';
  if (!apiUrl || !apiKey) {
    return null;
  }
  return {
    apiUrl,
    apiKey,
    model,
    visionModel,
    enableImageUrl
  };
}

function getDeepSeekRuntimeStatus() {
  const runtime = getDeepSeekRuntime();
  return {
    connected: Boolean(runtime),
    keyConfigured: Boolean(runtime?.apiKey),
    apiUrl: runtime?.apiUrl || safeText(process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com').replace(/\/$/, ''),
    model: runtime?.model || safeText(process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash'),
    visionModel: runtime?.visionModel || safeText(process.env.DEEPSEEK_VISION_MODEL || process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash'),
    imageUrlEnabled: Boolean(runtime?.enableImageUrl)
  };
}

function getDifyDatasetRuntime() {
  const apiUrl = normalizeDifyApiUrl(process.env.DIFY_DATASET_API_URL || process.env.DIFY_API_URL);
  const apiKey = safeText(process.env.DIFY_DATASET_API_KEY);
  if (!apiUrl || !apiKey) {
    return null;
  }
  return {
    apiUrl,
    apiKey,
    source: 'DIFY_DATASET_API_KEY'
  };
}

function getDifyDatasetRuntimeStatus() {
  const runtime = getDifyDatasetRuntime();
  return {
    connected: Boolean(runtime),
    keyConfigured: Boolean(runtime?.apiKey),
    apiUrl: runtime?.apiUrl || normalizeDifyApiUrl(process.env.DIFY_DATASET_API_URL || process.env.DIFY_API_URL),
    credentialSource: runtime?.source || ''
  };
}

function hasAnyDifyRuntime() {
  return getDifyRuntimeStatus().some((item) => item.connected);
}

function getDifyUploadRuntimeGroups(mime) {
  const preferredAgentIds = isImageMime(mime)
    ? ['agent-file', 'agent-knowledge', 'agent-business']
    : ['agent-file', 'agent-knowledge', 'agent-business'];
  const groups = new Map();
  const addRuntime = (runtime, aliases) => {
    if (!runtime) return;
    const key = `${runtime.apiUrl}::${runtime.apiKey}`;
    if (!groups.has(key)) {
      groups.set(key, { runtime, aliases: [] });
    }
    groups.get(key).aliases.push(...aliases);
  };

  addRuntime(getDifyWorkflowRuntime(), ['dify-workflow']);

  for (const agentId of preferredAgentIds) {
    const runtime = getDifyRuntime(agentId);
    addRuntime(runtime, [agentId]);
  }

  return [...groups.values()];
}

function resolveDifyRuntime({ agentId, query, files = [], inputMode = 'text' }) {
  const targetAgentId = agentId || classifyIntent(query, files, inputMode).agentId || 'agent-knowledge';
  return getDifyRuntime(targetAgentId) || getDifyRuntime('agent-knowledge') || getDifyRuntime('agent-router');
}

const customerAiRemoteConfig = {
  openApiBase: (process.env.CUSTOMER_AI_OPENAPI_BASE || 'https://openapi.test.laiyifen.com/scm-customer-app-api').replace(/\/$/, ''),
  aiOpenApiBase: (process.env.CUSTOMER_AI_AI_OPENAPI_BASE || 'https://ai-openapi.test.laiyifen.com/consultant-ai-api').replace(/\/$/, ''),
  coreBase: (process.env.CUSTOMER_AI_CORE_BASE || 'https://customer-ai.test.laiyifen.com/scm-customer-core-server').replace(/\/$/, ''),
  fileBase: (process.env.CUSTOMER_AI_FILE_BASE || 'https://files.test.laiyifen.com').replace(/\/$/, ''),
  sseBase: (process.env.CUSTOMER_AI_SSE_BASE || 'https://customer-ai.test.laiyifen.com/scm-customer-core-server/sse').replace(/\/$/, ''),
  wsBase: (process.env.CUSTOMER_AI_WS_BASE || 'wss://customer-ai.test.laiyifen.com/scm-customer-core-server/ws').replace(/\/$/, ''),
  userId: process.env.CUSTOMER_AI_USER_ID || '7339931002',
  source: process.env.CUSTOMER_AI_SOURCE || 'GCDS',
  token: process.env.CUSTOMER_AI_TOKEN || 'token',
  userType: process.env.CUSTOMER_AI_USER_TYPE || '',
  clientId: process.env.CUSTOMER_AI_CLIENT_ID || '',
  secretKey: process.env.CUSTOMER_AI_SECRET_KEY || '',
  accessToken: process.env.CUSTOMER_AI_ACCESS_TOKEN || '',
  authToken: process.env.CUSTOMER_AI_AUTH_TOKEN || '',
  signAlgorithm: process.env.CUSTOMER_AI_SIGN_ALGORITHM || 'customer-ai-hmac-sha1',
  signTemplate: process.env.CUSTOMER_AI_SIGN_TEMPLATE || '',
  timeoutMs: Number(process.env.CUSTOMER_AI_TIMEOUT_MS || 12000),
  remoteAiEnabled: process.env.CUSTOMER_AI_REMOTE_AI_ENABLED === 'true',
  writeEnabled: process.env.CUSTOMER_AI_WRITE_ENABLED === 'true'
};

const customerAiEndpointRegistry = [
  {
    key: 'getApiToken',
    method: 'GET',
    mode: 'read',
    base: 'openApiBase',
    path: '/api/xt/app/basic/getApiToken',
    query: { token: '{token}' },
    description: '获取 AI 页面访问令牌'
  },
  {
    key: 'userInfo',
    method: 'GET',
    mode: 'read',
    base: 'openApiBase',
    path: '/api/xt/app/basic/getUserInfoByUserId',
    query: { userId: '{userId}' },
    description: '按用户 ID 获取用户信息'
  },
  {
    key: 'questionList',
    method: 'POST',
    mode: 'read',
    base: 'openApiBase',
    path: '/question/list',
    body: { pageSize: 10, curPage: 1, userType: '{userType}' },
    description: 'AI 快捷提问列表'
  },
  {
    key: 'quickQuestions',
    method: 'POST',
    mode: 'read',
    base: 'openApiBase',
    path: '/question/list',
    body: { pageSize: 10, curPage: 1, userType: '{userType}' },
    description: 'AI 快捷提问列表（兼容旧 key）'
  },
  {
    key: 'welcomeCheck',
    method: 'GET',
    mode: 'read',
    base: 'openApiBase',
    path: '/api/v1/ai-assistant/welcomeCheck',
    query: { userId: '{userId}' },
    description: 'AI 助手欢迎弹窗/引导检查'
  },
  {
    key: 'myWorkOrders',
    method: 'GET',
    mode: 'read',
    base: 'openApiBase',
    path: '/api/work/order/getMyList',
    query: { userId: '{userId}', curPage: 1, pageSize: 10 },
    description: '当前用户工单列表'
  },
  {
    key: 'workOrderDateList',
    method: 'GET',
    mode: 'read',
    base: 'openApiBase',
    path: '/api/work/order/item/getWorkOrderDateList',
    query: { workOrderNo: '{workOrderNo}', curPage: 1, pageSize: 999 },
    description: '工单消息/处理记录列表'
  },
  {
    key: 'sensitiveWordFilter',
    method: 'POST',
    mode: 'read',
    base: 'openApiBase',
    path: '/api/sensitiveWordFilter/filter',
    body: { content: '{content}' },
    description: '敏感词过滤'
  },
  {
    key: 'dictSrmF4',
    method: 'GET',
    mode: 'read',
    base: 'openApiBase',
    path: '/dict/queryByKey/SRM-F4',
    description: '工单问题类型字典'
  },
  {
    key: 'dictSrmF4Type',
    method: 'GET',
    mode: 'read',
    base: 'openApiBase',
    path: '/dict/queryByKey/SRM-F4-TYPE',
    description: '工单合作伙伴类型字典'
  },
  {
    key: 'dictSrmF4TypeItem',
    method: 'GET',
    mode: 'read',
    base: 'openApiBase',
    path: '/dict/queryByKey/SRM-F4-TYPE-ITEM',
    description: '工单类型明细字典'
  },
  {
    key: 'srmWorkOrderPageInfo',
    method: 'POST',
    mode: 'read',
    base: 'openApiBase',
    path: '/admin/srmWorkOrder/getPageInfo',
    body: { userId: '{userId}', curPage: 1, pageSize: 10, applyStatus: '' },
    description: 'SRM 工单分页列表'
  },
  {
    key: 'workOrderPageInfo',
    method: 'POST',
    mode: 'read',
    base: 'openApiBase',
    path: '/admin/srmWorkOrder/getPageInfo',
    body: { userId: '{userId}', curPage: 1, pageSize: 10, applyStatus: '' },
    description: 'SRM 工单分页列表（兼容旧 key）'
  },
  {
    key: 'srmWorkOrderDetail',
    method: 'POST',
    mode: 'read',
    base: 'openApiBase',
    path: '/admin/srmWorkOrder/srmWorkOrderDetail',
    body: { workOrderNo: '{workOrderNo}' },
    description: 'SRM 工单详情'
  },
  {
    key: 'provinceList',
    method: 'GET',
    mode: 'read',
    base: 'openApiBase',
    path: '/api/xt/app/basic/queryAllProvince',
    description: '省份/直辖市列表'
  },
  {
    key: 'cityList',
    method: 'GET',
    mode: 'read',
    base: 'openApiBase',
    path: '/api/xt/app/basic/queryAllCity/{provinceCode}',
    description: '城市列表'
  },
  {
    key: 'districtList',
    method: 'GET',
    mode: 'read',
    base: 'openApiBase',
    path: '/api/xt/app/basic/queryAllDistrict/{cityCode}',
    query: { provinceCode: '{provinceCode}' },
    description: '区县列表'
  },
  {
    key: 'commentHistory',
    method: 'GET',
    mode: 'read',
    base: 'aiOpenApiBase',
    path: '/api/comment/history',
    query: { userId: '{userId}', source: '{source}', isNew: 1, isDelete: 0 },
    description: 'AI 搜索/DeepSeek 历史对话'
  },
  {
    key: 'parseFile',
    method: 'POST',
    mode: 'read',
    remoteAi: true,
    base: 'aiOpenApiBase',
    path: '/api/parse/file',
    contentType: 'multipart',
    fileField: 'file',
    fields: { userId: '{userId}' },
    description: '原站 AI 文件解析/多模态识别（默认不用于本地回答链路）'
  },
  {
    key: 'getSessionWorkNo',
    method: 'POST',
    mode: 'write',
    base: 'openApiBase',
    path: '/api/message/getSessionWorkNo',
    body: { userId: '{userId}' },
    description: '创建/获取会话工单号'
  },
  {
    key: 'switchToManual',
    method: 'POST',
    mode: 'write',
    base: 'openApiBase',
    path: '/api/message/switchToManual',
    body: { userId: '{userId}' },
    description: '转人工客服'
  },
  {
    key: 'scoreWorkOrder',
    method: 'POST',
    mode: 'write',
    base: 'openApiBase',
    path: '/admin/workOrder/score',
    body: { workOrderNo: '{workOrderNo}', score: '{score}', channel: '{channel}' },
    description: '提交客服评价'
  },
  {
    key: 'workOrderItemPraise',
    method: 'POST',
    mode: 'write',
    base: 'openApiBase',
    path: '/api/work/order/item/praise',
    body: { praiseTag: '{praiseTag}', workItemId: '{workItemId}' },
    description: '客服消息点赞/标签评价'
  },
  {
    key: 'createSrmOrderAndUploadFile',
    method: 'POST',
    mode: 'write',
    base: 'openApiBase',
    path: '/admin/srmWorkOrder/createSrmOrderAndUploadFile',
    contentType: 'multipart',
    fileFieldPrefix: 'f',
    fields: { userId: '{userId}', isByHand: 1, workOrderNo: '{workOrderNo}' },
    description: '创建 SRM 工单并上传附件'
  },
  {
    key: 'commentRename',
    method: 'POST',
    mode: 'write',
    base: 'aiOpenApiBase',
    path: '/api/comment/rename',
    description: '重命名 AI 会话'
  },
  {
    key: 'commentDelete',
    method: 'POST',
    mode: 'write',
    base: 'aiOpenApiBase',
    path: '/api/comment/delete',
    description: '删除 AI 会话'
  },
  {
    key: 'commentSoftDelete',
    method: 'POST',
    mode: 'write',
    base: 'aiOpenApiBase',
    path: '/api/comment/softDelete',
    description: '软删除 DeepSeek 会话'
  },
  {
    key: 'commentUpDown',
    method: 'POST',
    mode: 'write',
    base: 'aiOpenApiBase',
    path: '/api/comment/upDown',
    description: 'AI 回复点赞/点踩'
  },
  {
    key: 'commentUpDownGet',
    method: 'GET',
    mode: 'write',
    base: 'aiOpenApiBase',
    path: '/api/comment/upDown',
    description: 'AI 回复点赞/点踩（GET 兼容）'
  },
  {
    key: 'sseChat',
    method: 'POST',
    mode: 'stream',
    remoteAi: true,
    base: 'aiOpenApiBase',
    path: '/sse/chat',
    description: '原站 AI 搜索/DeepSeek SSE 对话（默认禁用）'
  },
  {
    key: 'sseStop',
    method: 'GET',
    mode: 'write',
    remoteAi: true,
    base: 'aiOpenApiBase',
    path: '/sse/stop',
    query: { conversationId: '{conversationId}', userId: '{userId}' },
    description: '停止原站 DeepSeek/SSE 生成（默认禁用）'
  },
  {
    key: 'aiMessageSse',
    method: 'GET',
    mode: 'stream',
    remoteAi: true,
    base: 'coreBase',
    path: '/sse/getAiMessage/{sessionId}',
    description: '原站客服/AI 消息 SSE 推送（默认不作为本地 AI 回答源）'
  },
  {
    key: 'userWebSocket',
    method: 'GET',
    mode: 'ws',
    base: 'wsBase',
    path: '/userWebSocketHandle',
    query: { userId: '{userId}' },
    description: '用户消息 WebSocket 通道'
  }
];

function isCustomerAiRemoteEnabled(force = false) {
  return force || process.env.CUSTOMER_AI_REMOTE_ENABLED === 'true';
}

function isCustomerAiRemoteAiEnabled() {
  return customerAiRemoteConfig.remoteAiEnabled;
}

function buildRemoteAiDisabledResult(endpoint, key) {
  return {
    key,
    description: endpoint.description,
    method: endpoint.method,
    mode: endpoint.mode,
    ok: false,
    status: 0,
    skipped: true,
    error: '原站 AI 生成/解析接口已登记但默认禁用；当前 AI 回答链路使用本地配置的 Dify/Qwen。若只做接口逆向调试，可显式开启 CUSTOMER_AI_REMOTE_AI_ENABLED=true。'
  };
}

function resolveCustomerAiParam(value, params = {}) {
  if (typeof value !== 'string') return value;
  return value.replace(/\{(\w+)\}/g, (_match, key) => {
    if (params[key] !== undefined) return String(params[key]);
    if (customerAiRemoteConfig[key] !== undefined) return String(customerAiRemoteConfig[key]);
    return '';
  });
}

function resolveCustomerAiPayload(value, params = {}) {
  if (Array.isArray(value)) return value.map((item) => resolveCustomerAiPayload(item, params));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, resolveCustomerAiPayload(item, params)])
    );
  }
  return resolveCustomerAiParam(value, params);
}

function getCustomerAiDefaultQueryKeys(endpoint) {
  const keys = new Set(Object.keys(endpoint.query || {}));
  for (const match of String(endpoint.path || '').matchAll(/\{(\w+)\}/g)) {
    keys.add(match[1]);
  }
  return keys;
}

function buildCustomerAiUrl(endpoint, params = {}, options = {}) {
  const base = customerAiRemoteConfig[endpoint.base];
  const pathValue = resolveCustomerAiParam(endpoint.path, params);
  const url = new URL(`${base}${pathValue}`);
  for (const [key, value] of Object.entries(endpoint.query || {})) {
    url.searchParams.set(key, String(resolveCustomerAiParam(value, params)));
  }
  if (options.includeExtraQuery) {
    const knownKeys = getCustomerAiDefaultQueryKeys(endpoint);
    for (const [key, value] of Object.entries(params || {})) {
      if (
        value === undefined ||
        value === null ||
        value === '' ||
        knownKeys.has(key) ||
        ['body', 'files'].includes(key)
      ) {
        continue;
      }
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function getCustomerAiEndpoint(key) {
  return customerAiEndpointRegistry.find((endpoint) => endpoint.key === key);
}

function filterCustomerAiSignParams(searchParams) {
  return [...searchParams.entries()]
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

function getCustomerAiCanonicalPath(url, { includeSearch = false } = {}) {
  const parsedUrl = new URL(url);
  return `${parsedUrl.pathname}${includeSearch ? parsedUrl.search : ''}`;
}

function buildCustomerAiGatewaySign({ method, url, bodyText = '', contentType = '' }, timestamp) {
  const parsedUrl = new URL(url);
  const normalizedMethod = (method || 'GET').toUpperCase();
  const canonicalPath = getCustomerAiCanonicalPath(url);
  const queryText = filterCustomerAiSignParams(parsedUrl.searchParams);
  const headerText = `x-co-client:${customerAiRemoteConfig.clientId}\nx-co-timestamp:${timestamp}`;
  let signText = '';

  if (contentType.includes('multipart/form-data')) {
    signText = queryText
      ? `${normalizedMethod}\n${canonicalPath}\n${queryText}\n${headerText}`
      : `${normalizedMethod}\n${canonicalPath}\n${headerText}`;
  } else if (normalizedMethod === 'GET') {
    signText = queryText
      ? `${normalizedMethod}\n${canonicalPath}\n${queryText}\n${headerText}`
      : `${normalizedMethod}\n${canonicalPath}\n${headerText}`;
  } else if (queryText) {
    signText = `${normalizedMethod}\n${canonicalPath}\n${queryText}\n${headerText}`;
  } else {
    const bodyMd5 = crypto.createHash('md5').update(bodyText || 'null').digest('hex').toUpperCase();
    signText = `${normalizedMethod}\n${canonicalPath}\n${headerText}`;
    if (bodyMd5) {
      signText += `\n${bodyMd5}`;
    }
  }

  return crypto.createHmac('sha1', customerAiRemoteConfig.secretKey).update(signText).digest('base64');
}

function applyCustomerAiAuthHeaders(headers, { method, url, bodyText = '', contentType = '' } = {}) {
  if (customerAiRemoteConfig.clientId) {
    headers['X-Co-Client'] = customerAiRemoteConfig.clientId;
  }
  if (customerAiRemoteConfig.accessToken) {
    headers['X-Co-AccessToken'] = customerAiRemoteConfig.accessToken;
    headers.token = customerAiRemoteConfig.accessToken;
  }
  if (customerAiRemoteConfig.authToken) {
    headers.Authorization = customerAiRemoteConfig.authToken.startsWith('Bearer ')
      ? customerAiRemoteConfig.authToken
      : `Bearer ${customerAiRemoteConfig.authToken}`;
    headers['x-auth-token'] = customerAiRemoteConfig.authToken;
  }
  if (customerAiRemoteConfig.clientId && customerAiRemoteConfig.secretKey) {
    const timestamp = Date.now().toString();
    const algorithm = customerAiRemoteConfig.signAlgorithm.toLowerCase();
    const canonical = customerAiRemoteConfig.signTemplate
      ? customerAiRemoteConfig.signTemplate
          .replaceAll('{client}', customerAiRemoteConfig.clientId)
          .replaceAll('{timestamp}', timestamp)
          .replaceAll('{secret}', customerAiRemoteConfig.secretKey)
          .replaceAll('{method}', method || '')
          .replaceAll('{path}', getCustomerAiCanonicalPath(url))
          .replaceAll('{query}', new URL(url).searchParams.toString())
          .replaceAll('{body}', bodyText)
      : '';
    const sign = algorithm === 'customer-ai-hmac-sha1' || algorithm === 'laiyifen-hmac-sha1'
      ? buildCustomerAiGatewaySign({ method, url, bodyText, contentType }, timestamp)
      : algorithm.startsWith('hmac-')
        ? crypto
            .createHmac(algorithm.replace(/^hmac-/, ''), customerAiRemoteConfig.secretKey)
            .update(canonical)
            .digest('base64')
        : crypto.createHash(algorithm).update(canonical).digest('hex').toUpperCase();
    headers['X-Co-TimeStamp'] = timestamp;
    headers['X-Co-Sign'] = sign;
  }
}

function mergeCustomerAiBody(endpoint, params = {}, body) {
  const defaultBody = endpoint.body ? resolveCustomerAiPayload(endpoint.body, params) : {};
  if (body === undefined || body === null || Object.keys(body || {}).length === 0) {
    return defaultBody;
  }
  return {
    ...defaultBody,
    ...resolveCustomerAiPayload(body, { ...params, ...body })
  };
}

function buildCustomerAiMultipartBody(endpoint, params = {}, body = {}, files = []) {
  const form = new FormData();
  const fields = {
    ...(endpoint.fields ? resolveCustomerAiPayload(endpoint.fields, params) : {}),
    ...resolveCustomerAiPayload(body || {}, { ...params, ...(body || {}) })
  };
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null && value !== '') {
      form.append(key, String(value));
    }
  }
  files.forEach((file, index) => {
    const fieldName = endpoint.fileFieldPrefix
      ? `${endpoint.fileFieldPrefix}${index + 1}`
      : endpoint.fileField || 'file';
    const buffer = fs.readFileSync(file.path);
    const blob = new Blob([buffer], { type: file.mimetype || 'application/octet-stream' });
    form.append(fieldName, blob, normalizeUploadFileName(file.originalname || file.filename || `file-${index + 1}`));
  });
  return form;
}

async function callCustomerAiEndpoint(key, { params = {}, body, files = [], force = false, stream = false } = {}) {
  const endpoint = getCustomerAiEndpoint(key);
  if (!endpoint) {
    return { key, ok: false, status: 404, error: 'Unknown customer AI endpoint' };
  }
  if (!isCustomerAiRemoteEnabled(force)) {
    return { key, ok: false, status: 0, skipped: true, error: 'CUSTOMER_AI_REMOTE_ENABLED is not true' };
  }
  if (endpoint.remoteAi && !isCustomerAiRemoteAiEnabled()) {
    return buildRemoteAiDisabledResult(endpoint, key);
  }
  if (endpoint.mode === 'write' && !customerAiRemoteConfig.writeEnabled) {
    return { key, ok: false, status: 0, skipped: true, error: '写接口已登记，但 CUSTOMER_AI_WRITE_ENABLED 未开启' };
  }
  if ((endpoint.mode === 'stream' || endpoint.mode === 'ws') && !stream) {
    const url = buildCustomerAiUrl(endpoint, params, { includeExtraQuery: endpoint.method === 'GET' });
    return {
      key,
      description: endpoint.description,
      method: endpoint.method,
      mode: endpoint.mode,
      url,
      ok: true,
      status: 0,
      skipped: true,
      error: endpoint.mode === 'ws' ? 'WebSocket 已登记，请由前端或专用流式代理建立连接。' : 'SSE/流式接口已登记，默认不在聚合接口中拉流。'
    };
  }

  const url = buildCustomerAiUrl(endpoint, params, { includeExtraQuery: endpoint.method === 'GET' });
  const headers = {
    ...customerAiRequestHeaders,
    Accept: 'application/json, text/plain, */*'
  };
  const options = { method: endpoint.method, headers };
  let bodyText = '';
  if (endpoint.contentType === 'multipart' && endpoint.method !== 'GET') {
    options.body = buildCustomerAiMultipartBody(endpoint, params, body, files);
  } else if (endpoint.method !== 'GET') {
    const payload = mergeCustomerAiBody(endpoint, params, body);
    bodyText = JSON.stringify(payload);
    headers['Content-Type'] = 'application/json';
    options.body = bodyText;
  }
  applyCustomerAiAuthHeaders(headers, {
    method: endpoint.method,
    url,
    bodyText,
    contentType: endpoint.contentType === 'multipart' ? 'multipart/form-data' : headers['Content-Type'] || ''
  });
  const response = await fetchWithTimeout(url, options, customerAiRemoteConfig.timeoutMs);
  let data = null;
  if (response.text) {
    try {
      data = JSON.parse(response.text);
    } catch {
      data = response.text.slice(0, 1000);
    }
  }
  const businessCode = data && typeof data === 'object' && data.code !== undefined ? String(data.code) : '';
  const businessOk = !businessCode || ['0', '200', '000000', 'SUCCESS', 'success'].includes(businessCode);
  const error = response.error || (!businessOk ? data?.msg || data?.message || `业务错误码 ${businessCode}` : '');
  return {
    key,
    description: endpoint.description,
    method: endpoint.method,
    mode: endpoint.mode,
    url,
    ok: response.ok && businessOk,
    status: response.status,
    contentType: response.contentType,
    error,
    businessCode,
    data
  };
}

function firstArray(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  const keys = ['records', 'rows', 'list', 'items', 'data', 'result', 'content'];
  for (const key of keys) {
    const result = firstArray(value[key]);
    if (result.length) return result;
  }
  return [];
}

function normalizeRemoteQuickQuestions(payload) {
  return firstArray(payload)
    .map((item, index) => ({
      id: `remote-qq-${item.id || item.questionId || 'item'}-${index}`,
      title: item.title || item.question || item.content || item.name || item.label || '',
      identity: item.identity || item.userType || '供应商',
      sort: Number(item.sort || item.order || index + 1),
      enabled: item.enabled !== false && item.status !== 0,
      agent: item.agent || 'agent-knowledge'
    }))
    .filter((item) => item.title);
}

function normalizeRemoteTickets(payload) {
  return firstArray(payload).map((item, index) => ({
    id: item.workOrderNo || item.orderNo || item.id || `REMOTE-TK-${index + 1}`,
    title: item.title || item.questionTitle || item.problemTitle || item.summary || '远端工单',
    userName: item.userName || item.createName || item.name || '远端用户',
    phone: item.phone || item.mobile || '-',
    identity: item.identity || item.userType || '供应商',
    channel: item.channel || '共创',
    priority: item.priority || 'P2',
    category: item.category || item.typeName || '远端工单',
    status: item.statusName || item.status || '处理中',
    currentStaffId: item.currentStaffId || '',
    currentStaff: item.currentStaff || item.serviceName || item.customerServiceName || '-',
    rating: item.rating || item.score || '-',
    serviceStartedAt: item.serviceStartedAt || item.createTime || '-',
    feishuStatus: item.feishuStatus || '-',
    read: Boolean(item.read || item.isRead),
    summary: item.summary || item.content || item.description || '',
    createdAt: item.createdAt || item.createTime || now(),
    updatedAt: item.updatedAt || item.updateTime || item.createTime || now(),
    transferLogs: []
  }));
}

function normalizeRemoteHistories(payload) {
  return firstArray(payload).map((item, index) => {
    const messages = firstArray(item.messages || item.commentList || item.records || item.detailList).map((message, msgIndex) => ({
      id: `remote-history-${index}-${message.id || msgIndex}`,
      role: message.role || (message.userType === 'AI' ? 'assistant' : message.userType === 'customerService' ? 'staff' : 'user'),
      sender: message.sender || message.userName || message.nickName || '远端',
      text: message.text || message.content || message.answer || message.question || '',
      createdAt: message.createdAt || message.createTime || now()
    }));
    return {
      id: `remote-history-${item.id || item.sessionId || index}`,
      title: item.title || item.question || item.content || `远端历史对话 ${index + 1}`,
      type: item.type === 'service' ? 'service' : 'ai',
      identity: item.identity || item.userType || '供应商',
      channel: item.source || item.channel || '共创',
      status: item.statusName || item.status || '已结束',
      staffName: item.staffName || item.customerServiceName,
      ticketId: item.workOrderNo || item.ticketId,
      updatedAt: item.updatedAt || item.updateTime || item.createTime || now(),
      messages: messages.length ? messages : [
        {
          id: `remote-history-${index}-0`,
          role: 'assistant',
          sender: '小伊',
          text: item.answer || item.content || item.question || '远端历史记录',
          createdAt: item.createTime || now()
        }
      ]
    };
  });
}

async function getCustomerAiRemoteBootstrap(force = false) {
  const keys = [
    'quickQuestions',
    'commentHistory',
    'myWorkOrders',
    'userInfo',
    'welcomeCheck',
    'dictSrmF4',
    'dictSrmF4Type',
    'dictSrmF4TypeItem',
    'provinceList',
    'workOrderPageInfo',
    'srmWorkOrderPageInfo'
  ];
  const results = await Promise.all(keys.map((key) => callCustomerAiEndpoint(key, { force })));
  const byKey = Object.fromEntries(results.map((result) => [result.key, result]));
  return {
    ok: results.some((result) => result.ok),
    results,
    quickQuestions: byKey.quickQuestions?.ok ? normalizeRemoteQuickQuestions(byKey.quickQuestions.data) : [],
    histories: byKey.commentHistory?.ok ? normalizeRemoteHistories(byKey.commentHistory.data) : [],
    tickets: byKey.myWorkOrders?.ok ? normalizeRemoteTickets(byKey.myWorkOrders.data) : []
  };
}

function toAbsoluteUrl(value, baseUrl) {
  if (!value || value.startsWith('data:') || value.startsWith('blob:')) return null;
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        ...customerAiRequestHeaders,
        ...(options.headers || {})
      }
    });
    const contentType = response.headers.get('content-type') || '';
    const text = options.method === 'HEAD' || options.method === 'OPTIONS' ? '' : await response.text();
    return {
      ok: response.ok,
      status: response.status,
      url: response.url,
      contentType,
      text
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      url,
      contentType: '',
      text: '',
      error: error.message
    };
  } finally {
    clearTimeout(timer);
  }
}

function extractAssetUrls(html, baseUrl) {
  const assets = new Set();
  for (const match of html.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)) {
    const absolute = toAbsoluteUrl(match[1], baseUrl);
    if (absolute && /\.(js|css)(\?|#|$)/i.test(absolute)) {
      assets.add(absolute);
    }
  }
  return [...assets];
}

function extractApiCandidates(text, baseUrl) {
  const candidates = new Set();
  const patterns = [
    /["'`](https?:\/\/[^"'`\s]+)["'`]/g,
    /["'`]((?:\/|\.\/|\.\.\/)[^"'`\s]*(?:api|chat|ai|mcp|workflow|conversation|message|upload|file|knowledge|dify)[^"'`\s]*)["'`]/gi,
    /\bbaseURL\s*[:=]\s*["'`]([^"'`]+)["'`]/gi,
    /\burl\s*[:=]\s*["'`]([^"'`]+)["'`]/gi
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const raw = match[1];
      if (!raw || raw.includes('{') || raw.includes('}') || raw.includes('${')) continue;
      const absolute = toAbsoluteUrl(raw, baseUrl);
      if (absolute && /api|chat|ai|mcp|workflow|conversation|message|upload|file|knowledge|dify/i.test(absolute)) {
        candidates.add(absolute);
      }
    }
  }

  return [...candidates];
}

async function uploadFileToDify(reqFile, userId, runtime = getDifyRuntime('agent-knowledge')) {
  if (!runtime) {
    return null;
  }

  const form = new FormData();
  const fileBuffer = fs.readFileSync(reqFile.path);
  const fileBlob = new Blob([fileBuffer], { type: reqFile.mimetype || 'application/octet-stream' });
  form.append('file', fileBlob, normalizeUploadFileName(reqFile.originalname));
  form.append('type', detectDifyFileType(reqFile.mimetype));
  form.append('user', `${process.env.DIFY_USER_PREFIX || 'laiyifen'}-${userId}`);

  const response = await fetch(`${runtime.apiUrl}/files/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${runtime.apiKey}`
    },
    body: form
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${runtime.label} file upload failed ${response.status}: ${text.slice(0, 240)}`);
  }
  let parsed = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    return { raw: text };
  }
  return parsed;
}

async function uploadFileToDifyAgents(reqFile, userId) {
  const groups = getDifyUploadRuntimeGroups(reqFile.mimetype);
  if (groups.length === 0) {
    return {
      primaryFileId: null,
      fileIdsByAgent: {},
      uploadErrors: []
    };
  }

  const settled = await Promise.allSettled(
    groups.map(async (group) => ({
      group,
      result: await uploadFileToDify(reqFile, userId, group.runtime)
    }))
  );
  const fileIdsByAgent = {};
  const uploadErrors = [];

  for (const item of settled) {
    if (item.status === 'rejected') {
      uploadErrors.push(item.reason?.message || 'Dify 文件上传失败');
      continue;
    }
    const difyUpload = item.value.result;
    const difyFileId = difyUpload
      ? difyUpload.id || difyUpload.upload_file_id || difyUpload?.data?.id || difyUpload?.file?.id || difyUpload?.id_file
      : null;
    if (!difyFileId) {
      uploadErrors.push(`${item.value.group.runtime.label} 未返回 upload_file_id`);
      continue;
    }
    for (const alias of item.value.group.aliases) {
      fileIdsByAgent[alias] = difyFileId;
    }
  }

  return {
    primaryFileId:
      fileIdsByAgent['dify-workflow'] ||
      fileIdsByAgent['agent-file'] ||
      fileIdsByAgent['agent-knowledge'] ||
      Object.values(fileIdsByAgent)[0] ||
      null,
    fileIdsByAgent,
    uploadErrors
  };
}

async function extractImageTextWithLocalOcr(reqFile) {
  if (!isImageMime(reqFile?.mimetype)) {
    return '';
  }
  const scriptPath = path.join(process.cwd(), 'scripts', 'ocr-image.swift');
  if (!fs.existsSync(scriptPath)) {
    return '';
  }
  try {
    const { stdout } = await execFileAsync('/usr/bin/swift', [scriptPath, reqFile.path], {
      timeout: 30000,
      maxBuffer: 1024 * 1024 * 4
    });
    return safeText(stdout).slice(0, 4000);
  } catch (error) {
    console.warn('[ocr:fallback]', sanitizeExternalError(error.message));
    return '';
  }
}

const agents = [
  {
    id: 'agent-router',
    name: '意图路由 Agent',
    owner: 'AI平台',
    status: 'online',
    duty: '识别用户身份、问题分类、优先级与是否需要转人工',
    api: 'router'
  },
  {
    id: 'agent-knowledge',
    name: '知识库 Agent',
    owner: '共创客服',
    status: 'online',
    duty: '制度、流程、平台使用、常见问题',
    api: 'dify'
  },
  {
    id: 'agent-business',
    name: '业务数据 Agent',
    owner: '业务中台',
    status: 'standby',
    duty: '供应商、加盟商、经销商、工单、待办数据查询',
    api: 'internal-api'
  },
  {
    id: 'agent-file',
    name: '附件理解 Agent',
    owner: 'AI平台',
    status: 'online',
    duty: '图片、PDF、Excel、截图识别与脱敏',
    api: 'multimodal'
  },
  {
    id: 'agent-feishu',
    name: '飞书客服 Agent',
    owner: '客服运营',
    status: 'online',
    duty: '飞书通知、群机器人、客服接入、转派',
    api: 'feishu'
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

let quickQuestions = [
  {
    id: 'qq-001',
    title: '供应商入驻后下一步做什么？',
    identity: '供应商',
    sort: 1,
    enabled: true,
    agent: 'agent-knowledge'
  },
  {
    id: 'qq-002',
    title: '查看今日待办和合同授权状态',
    identity: '供应商',
    sort: 2,
    enabled: true,
    agent: 'agent-business'
  },
  {
    id: 'qq-003',
    title: '商机报名后如何继续操作？',
    identity: '加盟商',
    sort: 1,
    enabled: true,
    agent: 'agent-knowledge'
  },
  {
    id: 'qq-004',
    title: '门店社区长如何查看今日待办？',
    identity: '加盟商',
    sort: 2,
    enabled: true,
    agent: 'agent-business'
  },
  {
    id: 'qq-005',
    title: '客服工单如何转派给业务同事？',
    identity: '员工',
    sort: 1,
    enabled: true,
    agent: 'agent-feishu'
  },
  {
    id: 'qq-006',
    title: '经销商合同授权信息怎么查？',
    identity: '经销商',
    sort: 1,
    enabled: true,
    agent: 'agent-business'
  }
];

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

const serviceHours = {
  enabled: true,
  workdays: '周一至周五',
  start: '09:00',
  end: '18:00',
  offHoursMessage: '人工客服服务时间在工作日9:00-18:00，请稍后在此时间段内联系人工客服。'
};

function classifyIntent(text = '', files = [], inputMode = 'text') {
  const normalized = safeText(text).toLowerCase();
  if (inputMode === 'multimodal' || files.some((item) => isImageMime(item?.mime)) || files.some((item) => !item?.mime || !isImageMime(item.mime))) {
    return { category: '附件图片文件识别', priority: 'P1', agentId: 'agent-file', confidence: 0.88 };
  }
  if (/图片|截图|上传|文件|pdf|excel|附件|ocr|识别|页面理解/.test(normalized)) {
    return { category: '附件图片文件识别', priority: 'P1', agentId: 'agent-file', confidence: 0.86 };
  }
  if (/卡死|故障|bug|报错|加载失败|按钮.*(无效|不可用)|接口错误|功能缺陷|ai.*(异常|错误)|无法提交|无法发送/.test(text)) {
    return { category: '系统异常与缺陷', priority: 'P0', agentId: 'agent-router', confidence: 0.86 };
  }
  if (/登录|忘记密码|密码|手机号|账号|账户|绑定|角色|权限|看不到.*菜单|没有.*权限/.test(text)) {
    return { category: '账号权限与登录', priority: 'P0', agentId: 'agent-business', confidence: 0.86 };
  }
  if (/转人工|人工客服|客服|工单|评价服务|服务时间/.test(text)) {
    return { category: '工单与人工客服', priority: 'P0', agentId: 'agent-feishu', confidence: 0.86 };
  }
  if (/合同|结算|授权|电子签章|签章|付款|发票|财务联系人/.test(text)) {
    return { category: '合同授权与结算', priority: 'P1', agentId: 'agent-business', confidence: 0.84 };
  }
  if (/供应商|入驻|sap|商务联系人|财务联系人|合同联系人/.test(text)) {
    return { category: '供应商入驻', priority: 'P1', agentId: 'agent-business', confidence: 0.85 };
  }
  if (/加盟|门店|商机|报名/.test(text)) {
    return { category: '加盟商商机与门店运营', priority: 'P1', agentId: 'agent-business', confidence: 0.82 };
  }
  if (/经销商|经销|渠道|订单|商务联系人/.test(text)) {
    return { category: '经销商业务问题', priority: 'P1', agentId: 'agent-business', confidence: 0.8 };
  }
  if (/入口|在哪里|在哪|怎么操作|下一步|跳转|待办|今日待办|菜单|审批|查询|状态/.test(text)) {
    return { category: '菜单定位与操作引导', priority: 'P2', agentId: 'agent-knowledge', confidence: 0.78 };
  }
  if (normalized.includes('feishu') || /飞书|机器人|群/.test(text)) {
    return { category: '工单与人工客服', priority: 'P1', agentId: 'agent-feishu', confidence: 0.78 };
  }
  return { category: '其他问题', priority: normalized.length ? 'P3' : 'P3', agentId: 'agent-knowledge', confidence: normalized.length > 10 ? 0.62 : 0.42 };
}

function normalizeWorkflowIssueType(intent = {}, query = '') {
  const category = safeText(intent.category) || '其他问题';
  const text = safeText(query);
  if (getDifyWorkflowIssueTypeMode() === 'laiyifen') {
    return category;
  }
  if (/系统异常|技术|缺陷|附件|图片|文件|账号|权限|登录|菜单|操作|入口/.test(category)) {
    return '技术问题';
  }
  if (/账单|付款|发票|财务|结算/.test(text) || /^账单/.test(category)) {
    return '账单问题';
  }
  return '其他咨询';
}

function deriveDifySearchType(intent = {}, files = [], inputMode = 'text') {
  const category = safeText(intent.category);
  if (normalizeInputMode(inputMode) === 'multimodal' || files.length > 0 || /附件|图片|文件/.test(category)) {
    return 'file';
  }
  if (/工单|人工客服/.test(category)) {
    return 'support';
  }
  return 'chat';
}

function normalizeWorkflowUrgencyLevel(priority = '') {
  if (priority === 'P0') return '高';
  if (priority === 'P1') return '中';
  if (priority === 'P2' || priority === 'P3') return '低';
  return '未选择';
}

function getAttachmentType(file = {}) {
  if (!file?.mime) return '未知';
  if (isImageMime(file.mime)) return 'image';
  if (file.mime.includes('video/')) return 'video';
  return 'document';
}

function summarizeWorkflowAttachments(files = []) {
  const fileList = Array.isArray(files) ? files : [];
  const attachments = fileList.map((file) => ({
    file,
    type: getAttachmentType(file)
  }));
  const imageOrVideo = attachments.filter((item) => ['image', 'video'].includes(item.type)).map((item) => item.file);
  const documents = attachments.filter((item) => item.type === 'document').map((item) => item.file);
  const unknown = attachments.filter((item) => item.type === '未知').map((item) => item.file);
  return {
    files: fileList,
    hasFiles: fileList.length > 0,
    hasImageOrVideo: imageOrVideo.length > 0,
    hasDocument: documents.length > 0,
    imageOrVideoCount: imageOrVideo.length,
    documentCount: documents.length,
    unknownCount: unknown.length,
    unknown,
    imageOrVideo,
    documents
  };
}

function classifyWorkflowRoute(text = '', files = [], inputMode = 'text', context = {}) {
  const normalized = safeText(text).toLowerCase();
  const routeCandidates = ['handoff', 'task', 'analytics', 'knowledge'];
  const normalizedMode = normalizeInputMode(inputMode);
  const attachmentProfile =
    context?.attachmentProfile ||
    summarizeWorkflowAttachments(files);
  const hasImageOrVideo = attachmentProfile.hasImageOrVideo || files.some((item) => ['image', 'video'].includes(getAttachmentType(item)));
  const hasFiles = attachmentProfile.hasFiles || files.length > 0;
  if (!normalized) {
    if (hasFiles) {
      return {
        route: 'knowledge',
        routeLabel: workflowRouteConfig.knowledge.label,
        confidence: 0.55,
        matched: hasFiles ? 'empty_with_attachment' : 'empty',
        fallback: true
      };
    }
    return {
      route: 'knowledge',
      routeLabel: workflowRouteConfig.knowledge.label,
      confidence: 0.55,
      matched: '',
      fallback: true
    };
  }
  for (const route of routeCandidates) {
    const config = workflowRouteConfig[route];
    const matched = config?.patterns?.find((pattern) => pattern.test(normalized));
    if (matched) {
      return {
        route,
        routeLabel: config.label,
        confidence: route === 'task' ? 0.82 : route === 'handoff' ? 0.96 : 0.78,
        matched: matched.toString(),
        fallback: false
      };
    }
  }
  if (hasImageOrVideo || normalizedMode === 'multimodal' || /截图|照片|界面|页面/.test(normalized)) {
    return {
      route: 'knowledge',
      routeLabel: workflowRouteConfig.knowledge.label,
      confidence: 0.88,
      matched: 'multimodal',
      fallback: true
    };
  }
  return {
    route: 'knowledge',
    routeLabel: workflowRouteConfig.knowledge.label,
    confidence: 0.62,
    matched: 'default',
    fallback: true
  };
}

function buildAgent1FileBlocks(files = []) {
  return files.map((item, index) => {
    const type = getAttachmentType(item);
    return {
      type: type === 'image' ? 'screen_block' : 'document_block',
      title: `${type === 'image' ? '截图/图片块' : '文档块'} ${index + 1}`,
      source_span: sourceSpanFromFile(item, index),
      confidence: type === 'document' ? 0.72 : 0.84
    };
  });
}

function buildAgent1StructuredMarkdown(files = [], query = '', identity = '供应商') {
  const rows = files.map((file, index) => {
    const type = getAttachmentType(file);
    const extracted = safeText(file.extractedText || file.ocrText || '') || '未返回可解析文字';
    const source = file.originalName || file.name || `附件 ${index + 1}`;
    return `
## ${type === 'image' ? '页面结构块' : '文档块'}: ${source}
- 类型：${type}
- 大小：${Math.max(0, Math.round((file.size || 0) / 1024))} KB
- 摘要：${extracted.slice(0, 360)}
`;
  });

  return `# 页面识别结果\n\n## 用户上下文\n- 用户角色：${identity}\n- 查询内容：${safeText(query) || '空'}\n\n## 识别分块\n${rows.length ? rows.join('\n') : '未检测到可解析附件。'}`;
}

function buildWorkflowProfile(identity = '供应商', userId = 'demo-user', remoteProfile = null) {
  const baseProfile = {
    userId,
    identity,
    role: identity,
    permissionLevel: identity === '员工' ? '高' : '中',
    scopes: ['ai', 'common', 'todo-view'],
    availableScenes: ['知识问答', '待办查询', '工单反馈', '商机报名', '合同授权', '订单跟进'],
    confidence: 0.85
  };
  if (!remoteProfile) return baseProfile;
  const mapped = {
    userId: remoteProfile.id || remoteProfile.userId || userId,
    identity: remoteProfile.identity || identity,
    role: remoteProfile.role || identity,
    permissionLevel: remoteProfile.permissionLevel || baseProfile.permissionLevel,
    scopes: Array.isArray(remoteProfile.scopes) && remoteProfile.scopes.length ? remoteProfile.scopes : baseProfile.scopes,
    availableScenes: Array.isArray(remoteProfile.availableScenes) && remoteProfile.availableScenes.length
      ? remoteProfile.availableScenes
      : baseProfile.availableScenes,
    confidence: 0.9
  };
  return { ...baseProfile, ...mapped };
}

function mergeWorkflowReasons(baseReasons = [], ...moreReasons) {
  const merged = [];
  const list = [...baseReasons, ...moreReasons.filter(Boolean)];
  for (const reason of list) {
    if (!reason || merged.includes(reason)) continue;
    merged.push(reason);
  }
  return merged;
}

function parseTaskExecutionIntent(text = '') {
  const normalized = safeText(text).toLowerCase();
  const actionMatch =
    /提交|新建|修改|更新|删除|导出|审批|同意|驳回|执行|创建|变更/.exec(normalized);
  const targetMatch = /(工单|订单|待办|申请|页面|流程|业务)(?:号|单)?[:：\s]*([\w-]{3,})/.exec(normalized);
  const targetNameMatch = /(订单|工单|待办|申请|流程|页面|商机)(?:\s*(?:查询|提交|操作|审批|修改|创建|删除)[\s\S]{0,12})?/.exec(normalized);
  const action = actionMatch ? actionMatch[0] : '未知动作';
  const targetId = targetMatch ? targetMatch[2] : '';
  const targetType = targetMatch ? targetMatch[1] : targetNameMatch ? targetNameMatch[1] : '';
  const required = [];
  if (!action) required.push('操作动作');
  if (!targetType && !targetId) required.push('目标对象');
  return {
    action,
    targetType: targetType || '未知对象',
    targetId: targetId || '',
    required
  };
}

function buildAgent4Workflow({ text, identity, inputMode, files = [], translation = {}, translationNormalized, difyEnabled }) {
  const normalized = safeText(text).toLowerCase();
  const traceId = makeId('trace');
  const createdAt = now();
  const safeMode = normalizeTranslation(translationNormalized).enabled ? 'translation' : 'default';
  const normalizedMode = normalizeInputMode(inputMode);
  const attachmentProfile = summarizeWorkflowAttachments(files);
  const routeHint = classifyWorkflowRoute(text, files, normalizedMode, { attachmentProfile });
  const routeForTrace = routeHint.route || 'knowledge';
  const routeStopNode =
    routeForTrace === 'task'
      ? 'R'
      : routeForTrace === 'analytics'
        ? 'K'
        : routeForTrace === 'handoff'
          ? 'U'
          : 'X';
  const routeExecutionPath = markWorkflowPathDoneUntil(
    collectWorkflowExecutionPath(routeForTrace, attachmentProfile),
    routeStopNode
  );
  const hasImage = attachmentProfile.hasImageOrVideo;
  const hasDocument = attachmentProfile.hasDocument;
  const attachmentMode = hasImage ? 'multimodal' : hasDocument ? 'document' : 'text';
  const pageTypeHeuristic = /审批|待办|商机|订单/.test(normalized) ? '业务管理页' : /首页|菜单|页面|弹窗/.test(normalized) ? '流程页面' : '未知页面';
  const actor = identity;
  const confidenceBase = attachmentMode === 'multimodal' ? 0.84 : 0.6;
  const evidenceIds = files.map((item) => item?.id || item?.name).filter(Boolean);
  const structuredBlocks = buildAgent1FileBlocks(files);
  const intent = classifyIntent(text, files, normalizedMode);
  const highRiskKeywords = workflowConfig.highRiskKeywords.test(normalized);
  const needsExternalAction = /查询|查询一下|待办|审批|工单|操作/.test(normalized);
  const roleConflict = isRoleSceneConflict(text, actor);
  const actionPlan = [];
  const safetyReasons = [];
  const plannedConfidence = [];
  const actionPolicy = {
    knowledge: { tool: 'dify.knowledge', reason: '文本/知识库路径' },
    multimodal: { tool: 'dify.vision', reason: '视觉结构化路径' },
    mcp: { tool: 'business.mcp', reason: '业务接口路径' },
    ticket: { tool: 'ticket.create', reason: '工单处理路径' },
    chat: { tool: 'mock.chat', reason: '文本直接回答路径' },
    external: { tool: 'external.redirect', reason: '外部跳转路径' }
  };

  if (needsExternalAction || intent.category === '附件识别') {
    actionPlan.push({ action: 'knowledge', description: '先调用知识库/文档判断页面含义与流程规则', confidence: 0.86 });
    plannedConfidence.push(0.86);
  }
  if (intent.category === '附件识别') {
    actionPlan.push({ action: 'multimodal', description: '先将截图结构化为 Markdown，抽取关键字段与状态', confidence: 0.74 });
    plannedConfidence.push(0.74);
  }
  if (intent.agentId === 'agent-business' || /待办|审批|工单/.test(normalized)) {
    actionPlan.push({ action: 'mcp', description: '按身份路由调用业务接口校验工单/待办/订单状态', confidence: 0.8 });
    plannedConfidence.push(0.8);
  }
  if (/转人工/.test(normalized)) {
    actionPlan.push({ action: 'ticket', description: '触发人工工单入口，保留上下文', confidence: 0.92 });
    plannedConfidence.push(0.92);
  }
  if (/外部跳转|跳转到|打开.*链接|第三方|淘宝|京东/.test(normalized) && !/不跳转|不要跳转|无需跳转|别跳转/.test(normalized)) {
    actionPlan.push({ action: 'external', description: '外部跳转前需进行安全确认与归因记录', confidence: 0.71 });
    plannedConfidence.push(0.71);
  }
  if (actionPlan.length === 0) {
    actionPlan.push({ action: 'chat', description: '先行直接文本回复并补充澄清建议', confidence: 0.77 });
    plannedConfidence.push(0.77);
  }

  if (!difyEnabled && actionPlan.some((item) => ['multimodal', 'mcp', 'ticket', 'external'].includes(item.action))) {
    safetyReasons.push('Dify/MCP 未配置，当前仅支持安全文本层级执行');
  }
  if (highRiskKeywords) {
    safetyReasons.push('识别到高风险意图（变更/外部/导出/跳转相关）');
  }
  if (roleConflict) {
    safetyReasons.push(`页面角色判断与当前身份“${actor}”不一致，需二次确认`);
  }
  if (intent.confidence < workflowConfig.confidenceThreshold && actionPlan.some((item) => item.action !== 'chat' && item.action !== 'knowledge')) {
    safetyReasons.push('意图置信度低于阈值，需进一步澄清');
  }

  const whitelistOk = actionPlan.every((item) => workflowConfig.actionWhitelist.includes(item.action));
  const planConfidence = plannedConfidence.length ? Math.max(...plannedConfidence) : 0.5;
  const requiresToolExecution = actionPlan.some((item) => item.action !== 'chat' && item.action !== 'knowledge');
  const lowConfidenceToolExecution = intent.confidence < workflowConfig.confidenceThreshold && requiresToolExecution;
  const requiresConfirmation =
    highRiskKeywords ||
    roleConflict ||
    (normalizedMode === 'multimodal' && structuredBlocks.length === 0) ||
    actionPlan.some((item) => item.action === 'external');
  const overallConfidence = normalizeConfidence(
    confidenceBase * 0.32 + clamp01(intent.confidence) * 0.4 + clamp01(planConfidence) * 0.28
  );
  const needsClarify = normalizedMode === 'multimodal' && files.length === 0
    ? '请补充截图并确保图片清晰'
    : lowConfidenceToolExecution
      ? '请补充页面名称、关键字段和目标动作'
      : '';

  return {
    trace_id: traceId,
    trace_version: workflowConfig.version,
    created_at: createdAt,
    status: requiresConfirmation ? 'blocked' : 'approved',
    input_summary: {
      actor,
      input_mode: normalizedMode,
      source_language: normalizeLanguage(translationNormalized?.sourceLanguage || 'auto'),
      target_language: normalizeLanguage(translationNormalized?.targetLanguage || 'zh-CN'),
      translation_state: safeMode,
      attachment_count: files.length,
      requires_visual_payload: normalizedMode === 'multimodal' || attachmentProfile.hasImageOrVideo
    },
    agent1_multimodal: {
      page_type: pageTypeHeuristic,
      context:
        attachmentMode === 'multimodal'
          ? '图像语义理解已命中'
          : attachmentMode === 'document'
            ? '文档提取上下文已加载'
            : '未命中视觉/文档附件',
      confidence:
        attachmentMode === 'multimodal'
          ? normalizeConfidence(confidenceBase)
          : attachmentMode === 'document'
            ? normalizeConfidence(Math.max(confidenceBase - 0.08, 0.58))
            : normalizeConfidence(Math.max(confidenceBase - 0.1, 0.38)),
      evidence_ids: evidenceIds,
      structured_blocks: structuredBlocks,
      ambiguity: roleConflict || lowConfidenceToolExecution ? 'high' : 'medium'
    },
    agent2_intent: {
      category: intent.category,
      priority: intent.priority,
      confidence: normalizeConfidence(intent.confidence),
      tool: intent.agentId,
      rationale: `基于文本与附件上下文判断为“${intent.category}”；当前走“${intent.agentId}”。`,
      explanation: `意图依据：关键词 ${intent.category}、身份 ${identity}、模式 ${normalizedMode}`
    },
    agent3_execution: {
      plan: actionPlan,
      action_policy: actionPlan.map((item) => ({
        ...item,
        tool: actionPolicy[item.action]?.tool || 'unknown',
        whitelist_ok: workflowConfig.actionWhitelist.includes(item.action)
      })),
      whitelist_ok: whitelistOk,
      can_execute: !requiresConfirmation && whitelistOk,
      confidence: normalizeConfidence(planConfidence),
      risk_assessment: getPriorityFromConfidence(overallConfidence)
    },
    agent4_security: {
      requires_confirmation: requiresConfirmation,
      requires_clarify: Boolean(needsClarify),
      risk_level: highRiskKeywords ? 'high' : getPriorityFromConfidence(overallConfidence),
      reasons: safetyReasons,
      confirmation_template: {
        action_object: intent.category,
        impact_scope: actionPlan.map((item) => item.action).join('、') || '默认说明',
        risk_level: highRiskKeywords ? 'high' : getPriorityFromConfidence(overallConfidence),
        rollback_possible: /删除|修改|导出|外部/.test(normalized) ? '可能需人工撤销' : '通常可回滚'
      },
      policy_version: workflowConfig.version,
      can_return: !requiresConfirmation || normalized.includes('确认')
    },
    execution_path: routeExecutionPath,
    resolution: {
      needs_confirmation: requiresConfirmation,
      confidence: overallConfidence,
      ambiguity: roleConflict || lowConfidenceToolExecution ? 'high' : 'low',
      recommended_actions: [needsClarify, ...(safetyReasons.length ? [`风险原因：${safetyReasons.join('；')}`] : [])].filter(Boolean),
      fallback: needsClarify || '按常规执行'
    }
  };
}

async function resolveWorkflowProfile(identity = '供应商', session = {}) {
  const userId = safeText(session.userId || session.user_id || customerAiRemoteConfig.userId || 'demo-user');
  const identityNormalized = safeText(identity) || '供应商';
  if (isCustomerAiRemoteEnabled(false)) {
    const remoteProfile = await callCustomerAiEndpoint('userInfo', {
      params: {
        userId
      }
    });
    if (remoteProfile?.ok && remoteProfile.data) {
      return buildWorkflowProfile(identityNormalized, userId, firstArray(remoteProfile.data)[0] || remoteProfile.data);
    }
  }
  return buildWorkflowProfile(identityNormalized, userId);
}

function collectWorkflowExecutionPath(route = 'knowledge', attachmentContext = {}) {
  const context = attachmentContext || {};
  const path = [
    {
      node_id: 'A',
      name: 'Start',
      status: 'done'
    },
    {
      node_id: 'B',
      name: 'HTTP 获取用户画像与权限',
      status: 'pending'
    },
    {
      node_id: 'C',
      name: '是否有文件',
      status: 'pending'
    }
  ];
  if (context.hasFiles) {
    path.push({
      node_id: 'D',
      name: '文件类型判断',
      status: 'pending'
    });
    if (context.hasImageOrVideo) {
      path.push({
        node_id: 'E',
        name: 'LLM Vision',
        status: 'pending'
      });
    }
    if (context.hasDocument) {
      path.push({
        node_id: 'F',
        name: 'Document Extractor',
        status: 'pending'
      });
    }
  }
  path.push({
    node_id: 'G',
    name: '问题分类与路由',
    status: 'pending'
  });
  path.push({
    node_id: route === 'knowledge' ? 'H1' : route === 'analytics' ? 'H2' : route === 'task' ? 'H3' : 'H4',
    name: `Route ${workflowRouteConfig[route]?.label || '知识问答'}`,
    status: 'pending'
  });

  if (route === 'knowledge') {
    path.push({
      node_id: 'I',
      name: '知识问答',
      status: 'pending'
    });
    path.push({
      node_id: 'J',
      name: '知识问答生成',
      status: 'pending'
    });
  } else if (route === 'analytics') {
    path.push({
      node_id: 'K',
      name: 'HTTP 获取权限校验',
      status: 'pending'
    });
    path.push({
      node_id: 'L',
      name: '业务数据查询',
      status: 'pending'
    });
    path.push({
      node_id: 'M',
      name: 'LLM 数据解释',
      status: 'pending'
    });
  } else if (route === 'task') {
    path.push({
      node_id: 'N',
      name: '参数抽取',
      status: 'pending'
    });
    path.push({
      node_id: 'O',
      name: '字段完整校验',
      status: 'pending'
    });
    path.push({
      node_id: 'Q',
      name: '执行预览',
      status: 'pending'
    });
    path.push({
      node_id: 'R',
      name: '请求用户确认',
      status: 'pending'
    });
  } else {
    path.push({
      node_id: 'S',
      name: '转人工',
      status: 'pending'
    });
    path.push({
      node_id: 'T',
      name: '飞书通知客服',
      status: 'pending'
    });
    path.push({
      node_id: 'U',
      name: '人工已接入',
      status: 'pending'
    });
  }

  path.push({
    node_id: 'V',
    name: 'Variable Aggregator',
    status: 'pending'
  });
  path.push({
    node_id: 'W',
    name: 'LLM 统一回复整理',
    status: 'pending'
  });
  path.push({
    node_id: 'X',
    name: 'Answer 返回前端',
    status: 'pending'
  });
  return path;
}

function markWorkflowPathDone(path = [], idxStart = 0) {
  for (let index = 0; index < path.length; index += 1) {
    if (index <= idxStart) {
      path[index].status = 'done';
    } else {
      path[index].status = 'pending';
    }
  }
  return path;
}

function markWorkflowPathDoneUntil(path = [], stopNodeId = 'X') {
  const stopIndex = Array.isArray(path) ? path.findIndex((item) => item.node_id === stopNodeId) : -1;
  if (stopIndex === -1) {
    return markWorkflowPathDone(path, path.length - 1);
  }
  return markWorkflowPathDone(path, stopIndex);
}

async function queryWorkflowDataForIdentity(routeIntent = {}, profile = {}) {
  const queryRoute = routeIntent.route || 'analytics';
  const scope = /待办|todo|待处理/.test(routeIntent.query || '') ? 'todo' : /工单/.test(routeIntent.query || '') ? 'workOrder' : 'order';
  if (isCustomerAiRemoteEnabled(false)) {
    const dataResult = await callCustomerAiEndpoint('myWorkOrders', {
      params: {
        userId: profile.userId || customerAiRemoteConfig.userId,
        curPage: 1,
        pageSize: 5
      },
      force: false
    });
    if (dataResult?.ok && dataResult.data) {
      const rows = firstArray(dataResult.data).slice(0, 5);
      return rows.map((item, index) => ({
        序号: index + 1,
        状态: item.statusName || item.status || '未知',
        单号: item.orderNo || item.workOrderNo || item.id || '-',
        描述: item.title || item.questionTitle || item.question || '待办记录',
        负责人: item.currentStaff || item.assignee || '-'
      }));
    }
  }
  const sourceRows =
    scope === 'todo'
      ? tickets.slice(0, 5).map((item, index) => ({
          序号: index + 1,
          状态: item.status,
          单号: item.id,
          描述: item.title,
          负责人: item.currentStaff
        }))
      : [];
  return sourceRows;
}

async function runWorkflowKnowledgeNode(context = {}) {
  const { trace, text, identity, files, inputMode, profile, session, attachmentContext } = context;
  const executionPath = collectWorkflowExecutionPath('knowledge', attachmentContext);
  const intent = classifyIntent(text, files, inputMode);
  const baseReply = buildKnowledgeReply(text, identity, files, inputMode);
  let result = null;
  let source = 'mock';
  try {
    const difyResult = await callDify({
      query: `${text}\n\n用户角色：${profile?.identity || identity}\n画像可信度：${Math.round((profile?.confidence || 0.6) * 100)}%`,
      session,
      identity,
      files,
      inputMode,
      translation: context.translation,
      agentId: intent.agentId
    });
    if (difyResult) {
      result = {
        ...difyResult,
        category: difyResult.category || '知识问答',
        priority: difyResult.priority || 'P2'
      };
      source = 'dify';
    }
  } catch (error) {
    result = {
      ...mockReply(text, identity, files, { inputMode, translation: context.translation }),
      category: baseReply?.category || '知识问答',
      priority: baseReply?.priority || 'P2'
    };
  }
  if (!result) {
    const fallback = mockReply(text, identity, files, { inputMode, translation: context.translation });
    result = {
      category: fallback.category || baseReply?.category || '知识问答',
      priority: fallback.priority || 'P2',
      ...fallback
    };
  }
  return {
    route: 'knowledge',
    source,
    requiresConfirmation: false,
    result,
    confidence: Math.max(trace.agent2_intent.confidence, 0.6),
    tracePath: markWorkflowPathDoneUntil(executionPath, 'X')
  };
}

async function runWorkflowDataNode(context = {}) {
  const { text, identity, trace, profile, session, attachmentContext } = context;
  const executionPath = collectWorkflowExecutionPath('analytics', attachmentContext);
  const routeIntent = {
    route: 'analytics',
    query: text
  };
  const dataRows = await queryWorkflowDataForIdentity(routeIntent, profile);
  const profileScope = profile.scopes || [];
  if (!profileScope.includes('业务查询') && !profileScope.includes('数据') && profile.permissionLevel !== '高') {
    return {
      route: 'analytics',
      source: 'mock',
      requiresConfirmation: true,
      reason: '用户画像未返回数据查询权限',
      result: {
        category: '数据分析',
        priority: 'P1',
        reply:
          '当前角色画像未满足数据查询权限，或你当前环境尚未完成权限白名单配置。请切换到“转人工客服”由后台确认数据权限。',
        agent: agents[0],
        citations: [
          {
            label: '风险控制',
            value: '权限校验未通过'
          }
        ]
      },
      tracePath: markWorkflowPathDoneUntil(executionPath, 'K')
    };
  }

  const textRows = dataRows.map((row) => `- ${row.序号}. ${row.描述}（${row.状态}）`).join('\n') || '暂无可读数据';
  const explainPrompt = `用户身份：${identity}\n画像：${profile.scopes?.join(',') || '默认场景'}\n查询结果:\n${textRows}`;
  let explainResult;
  let source = 'mock';
  try {
    const deepSeek = await callDeepSeek({ query: `请基于以下结果给出简短业务分析：\n${explainPrompt}`, identity, files: [], inputMode: 'text' });
    explainResult = deepSeek;
    source = 'deepseek';
  } catch (error) {
    explainResult = {
      reply:
        `已完成「${workflowRouteConfig.analytics.label}」路径。\n\n` +
        `原始数据（示例）:\n${textRows}\n\n` +
        '已完成字段抽取与风险归因，当前建议先核验状态字段变化，再结合审批链路确认。\n\n如需继续操作，发送完整目标对象与预期动作。',
      agent: agents[2],
      citations: [
        {
          label: '数据字段',
          value: textRows
        }
      ]
    };
  }

  return {
    route: 'analytics',
    source,
    requiresConfirmation: false,
    result: {
      category: '数据分析',
      priority: 'P1',
      ...explainResult,
      actions: buildSupportActions()
    },
    confidence: Math.max(trace.agent2_intent.confidence, 0.6),
    tracePath: markWorkflowPathDoneUntil(executionPath, 'X')
  };
}

function buildTaskPreview(taskIntent = {}) {
  const action = taskIntent.action || '未识别';
  const target = taskIntent.targetType || '未识别';
  const targetId = taskIntent.targetId || '未识别';
  return [
    '【任务执行预览】',
    `动作：${action}`,
    `对象：${target}`,
    `编号：${targetId}`,
    '参数：用户侧已确认参数来自上下文，待确认是否执行。',
    '风险：中高（涉及变更/写入或状态修改）'
  ].join('\n');
}

function buildTaskExecutionResult({ text, identity, taskIntent, traceId, executed = false }) {
  const action = taskIntent.action || '未知动作';
  const target = taskIntent.targetType || '未知对象';
  const targetId = taskIntent.targetId || '未识别';
  return {
    category: '任务执行',
    priority: 'P1',
    reply: executed
      ? `执行完成。\n\n动作：${action}\n对象：${target}\n编号：${targetId}\n说明：已按「${text}」执行预览通过，系统将同步到业务入口。\n\n执行记录 ID：${traceId}`
      : buildTaskPreview(taskIntent),
    agent: {
      id: 'agent-business',
      name: '任务执行编排器',
      owner: 'workflow-task',
      status: 'online',
      duty: '参数校验与任务预览',
      api: '/api/chat/message task'
    },
    citations: [
      {
        label: '执行对象',
        value: `${target} / ${targetId}`
      }
    ],
    actions: []
  };
}

async function runWorkflowTaskNode(context = {}) {
  const { text, trace, session, profile = {}, confirmTurn = false, consumePendingTraceId = '', attachmentContext } = context;
  const executionPath = collectWorkflowExecutionPath('task', attachmentContext);
  const taskIntent = parseTaskExecutionIntent(text);
  const pending = session?.workflowPending;
  const cachedResult = buildTaskExecutionResult({ text, identity: context.identity, taskIntent, traceId: trace.trace_id });

  if (confirmTurn && pending && pending.route === 'task' && pending.trace_id === consumePendingTraceId) {
    session.workflowPending = null;
    return {
      route: 'task',
      source: 'mock',
      requiresConfirmation: false,
      result: {
        ...buildTaskExecutionResult({
          text,
          identity: context.identity,
          taskIntent: pending.plan || taskIntent,
          traceId: pending.trace_id,
          executed: true
        }),
        priority: 'P0'
      },
      tracePath: markWorkflowPathDoneUntil(executionPath, 'X')
    };
  }

  if (taskIntent.required.length > 0 || !taskIntent.targetId) {
    if (session) {
      session.workflowPending = {
        route: 'task',
        trace_id: trace.trace_id,
        plan: taskIntent,
        text,
        trace: trace,
        createdAt: now()
      };
    }
    const preview = buildTaskExecutionResult({ text, identity: context.identity, taskIntent, traceId: trace.trace_id });
    return {
      route: 'task',
      source: 'mock',
      requiresConfirmation: true,
      reason: '任务执行缺少关键参数',
      result: {
        ...preview,
        priority: 'P2',
        reply: `${preview.reply}\n\n请补充关键参数：${taskIntent.required.join('、') || '操作目标与编号'}。`,
      },
      tracePath: markWorkflowPathDoneUntil(executionPath, 'P')
    };
  }

  if (session) {
    session.workflowPending = {
      route: 'task',
      trace_id: trace.trace_id,
      plan: taskIntent,
      text,
      trace: trace,
      createdAt: now()
    };
  }

  return {
    route: 'task',
    source: 'mock',
    requiresConfirmation: true,
    result: {
      ...cachedResult,
      priority: 'P1',
      reply: `${cachedResult.reply}\n\n请确认是否立即执行。`
    },
    tracePath: markWorkflowPathDoneUntil(executionPath, 'R')
  };
}

function createWorkflowTicket({ title, identity, userName = '演示用户', phone = '13800000000', summary = '', category = '工单与人工客服' }) {
  const intent = classifyIntent(title, [], 'text');
  const staff = pickStaff(intent.category);
  const nowText = new Date().toLocaleString('zh-CN', { hour12: false });
  return {
    id: `TK-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${String(tickets.length + 1).padStart(3, '0')}`,
    title,
    userName,
    phone,
    identity,
    channel: '共创',
    priority: intent.priority || 'P1',
    category,
    status: '待处理',
    currentStaffId: staff.id,
    currentStaff: staff.name,
    rating: '-',
    serviceStartedAt: nowText,
    feishuStatus: '待通知',
    read: false,
    summary: summary || 'AI 助手转人工生成工单，已保留当前对话上下文。',
    createdAt: nowText,
    updatedAt: nowText,
    transferLogs: []
  };
}

function pushWorkflowTicketHistory(ticket) {
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
        }
      ]
    },
    ...conversationHistories
  ].slice(0, 20);
}

async function runWorkflowHandoffNode(context = {}) {
  const { text, identity, session, trace, profile = {}, attachmentContext } = context;
  const executionPath = collectWorkflowExecutionPath('handoff', attachmentContext);
  const userName = profile.userName || '演示用户';
  const ticket = createWorkflowTicket({
    title: safeText(text).slice(0, 56) || '用户转人工咨询',
    identity,
    userName,
    phone: profile.phone || '13800000000',
    summary: `小伊会话转人工：${text}`,
    category: '工单与人工客服'
  });
  tickets = [ticket, ...tickets];
  pushWorkflowTicketHistory(ticket);
  const notice = await notifyFeishu(ticket, '新工单生成');
  ticket.feishuStatus = notice.ok ? '已通知' : '通知失败';
  if (session) {
    session.workflowTicketId = ticket.id;
  }
  return {
    route: 'handoff',
    source: 'mock',
    requiresConfirmation: false,
    result: {
      category: '转人工',
      priority: ticket.priority,
      reply:
        `已触发转人工并生成工单 ${ticket.id}，已推送至飞书。\n\n` +
        `当前处理人：${ticket.currentStaff}，建议在服务端保持上下文继续。\n\n飞书通知状态：${ticket.feishuStatus}。`,
      agent: {
        id: 'agent-feishu',
        name: 'AI转人工编排',
        owner: 'workflow-handoff',
        status: 'online',
        duty: '工单创建与飞书通知',
        api: '/api/tickets'
      },
      citations: [
        {
          label: '工单编号',
          value: ticket.id
        }
      ],
      actions: [
        {
          type: 'ticket',
          label: '查看工单'
        }
      ]
    },
    tracePath: markWorkflowPathDoneUntil(executionPath, 'X')
  };
}

async function runWorkflowOrchestrator(context = {}) {
  const {
    text,
    identity = '供应商',
    files = [],
    inputMode = 'text',
    session = {},
    translation = {},
    trace = { agent2_intent: { confidence: 0.5 } }
  } = context;

  const attachmentContext = summarizeWorkflowAttachments(files);
  const route = classifyWorkflowRoute(text, files, inputMode, { attachmentProfile: attachmentContext });
  const normalizedText = safeText(text);
  const profile = await resolveWorkflowProfile(identity, session);
  const contextWithProfile = {
    text,
    normalizedText,
    identity,
    files,
    inputMode,
    session,
    translation,
    trace,
    profile,
    route,
    attachmentContext,
    hasImageOrVideo: attachmentContext.hasImageOrVideo
  };

  if (route.route === 'knowledge') {
    return runWorkflowKnowledgeNode(contextWithProfile);
  }
  if (route.route === 'analytics') {
    return runWorkflowDataNode(contextWithProfile);
  }
  if (route.route === 'task') {
    return runWorkflowTaskNode(contextWithProfile);
  }
  if (route.route === 'handoff') {
    return runWorkflowHandoffNode(contextWithProfile);
  }

  return runWorkflowKnowledgeNode(contextWithProfile);
}

function pickStaff(category) {
  const available = supportStaff.find(
    (staff) => staff.status === 'online' && staff.categories.some((item) => category.includes(item) || item.includes(category))
  );
  return available || supportStaff.find((staff) => staff.id === 'cs-001');
}

function buildSupportActions() {
  return [
    {
      type: 'ticket',
      label: '转人工客服'
    }
  ];
}

function buildNoAnswerReply(reason = '当前暂时没有找到可直接回答的问题答案。') {
  return `${reason}\n\n建议您：\n1. 点击「转人工客服」进行在线咨询；\n2. 如果有意见、建议或需要后台核验，也可以提交工单，我们会尽快处理和回复。\n\n感谢您的咨询！`;
}

function buildKnowledgeReply(query, identity, files = [], inputMode = 'text') {
  const normalized = safeText(query).toLowerCase();
  const hasFiles = files.length > 0;

  if (/后台数据|看一下后台|看.*后台|实时数据|真实数据|数据库/.test(normalized)) {
    return {
      category: '业务查询',
      priority: 'P1',
      reply: buildNoAnswerReply('非常抱歉，当前暂时无法直接查看后台实时数据。')
    };
  }

  if (/今日待办|待办|合同授权状态|工单状态|订单状态|审批状态|查.*状态|查询.*状态/.test(normalized)) {
    return {
      category: '业务查询',
      priority: 'P1',
      reply:
        `结论：当前 AI 暂不能直接读取您的实时后台状态。\n\n`
        + `处理建议：\n1. 请先在共创平台首页查看「今日待办」或对应业务模块；\n2. 如果合同授权、工单或审批状态入口不可见，通常需要核验账号角色、主体绑定和菜单权限；\n3. 若您希望客服协助核验，请点击「转人工客服」。\n\n`
        + `需要补充：账号、用户身份、问题页面名称或截图。`
    };
  }

  if (/手机号|忘记密码|忘记手机号|密码/.test(normalized)) {
    return {
      category: '账号权限',
      priority: 'P1',
      reply:
        `结论：这类问题通常需要先走账号身份校验。\n\n`
        + `处理步骤：\n1. 在登录页优先使用「忘记密码」或手机号验证入口；\n2. 如果手机号已变更或无法接收验证码，需要联系平台客服核验身份后处理；\n3. 请准备账号、姓名、合作伙伴类型和可验证的联系方式。\n\n`
        + `如果无法自行完成，建议点击「转人工客服」。`
    };
  }

  if (/供应商入驻前|入驻前|准备哪些资料|准备.*资料|资料/.test(normalized)) {
    return {
      category: '供应商入驻',
      priority: 'P1',
      reply:
        `结论：供应商入驻前建议先准备企业主体、联系人和业务资质资料。\n\n`
        + `常见资料包括：\n1. 公司基础信息、营业执照、统一社会信用代码；\n2. 商务联系人、财务联系人、合同授权人信息；\n3. 银行账户、开票/税务信息；\n4. 合作业务相关资质或授权文件；\n5. 平台要求补充的其他证明材料。\n\n`
        + `如果不确定资料是否完整，建议转人工核验。`
    };
  }

  if (/供应商类型|类型如何选择|类型选择/.test(normalized)) {
    return {
      category: '供应商入驻',
      priority: 'P2',
      reply:
        `结论：供应商类型应按实际合作内容选择。\n\n`
        + `处理步骤：\n1. 如果是商品供货，选择与商品/采购相关的供应商类型；\n2. 如果是服务、设备、工程或其他非商品合作，选择对应业务类型；\n3. 若类型选择会影响合同、结算或资质审核，请先不要随意提交，建议转人工确认。\n\n`
        + `需要补充：合作内容、公司名称、拟供商品或服务范围。`
    };
  }

  if (/供应商入驻后|入驻后|下一步|合同授权入口|授权入口/.test(normalized)) {
    return {
      category: '供应商入驻',
      priority: 'P1',
      reply:
        `结论：入驻通过后，通常需要继续完善资料并确认合同授权入口。\n\n`
        + `处理步骤：\n1. 回到首页查看待办、合同授权或资料补充入口；\n2. 确认商务联系人、财务联系人、合同授权人是否已维护；\n3. 如果合同授权入口不可见，优先核验账号角色、供应商主体绑定和菜单权限；\n4. 仍无法处理时，建议转人工客服核验。\n\n`
        + `需要补充：账号、供应商名称/SAP 编码、当前页面截图。`
    };
  }

  if (/加盟|商机|报名|门店|社区长|美食顾问/.test(normalized)) {
    return {
      category: '加盟运营',
      priority: 'P1',
      reply:
        `结论：加盟相关问题通常需要结合报名阶段和门店资料状态处理。\n\n`
        + `处理步骤：\n1. 先查看首页待办或商机报名详情；\n2. 根据提示补充意向城市、资金证明、联系人和门店资料；\n3. 如果已报名但没有下一步入口，请转人工核验报名状态。\n\n`
        + `需要补充：加盟商账号、报名时间、当前页面截图。`
    };
  }

  if (/转人工|人工客服|客服|工单|评价服务/.test(normalized)) {
    return {
      category: '工单与人工客服',
      priority: 'P1',
      reply:
        `结论：您可以在当前对话直接转人工，转人工后不会跳转页面。\n\n`
        + `说明：\n1. 人工客服服务时间为周一至周五 09:00-18:00；\n2. 转人工后，客服后台回复会直接出现在当前对话；\n3. 工单转派仅客服后台可操作，用户端只查看处理状态和评价服务。`
    };
  }

  if (/图片|截图|上传|文件|pdf|excel|附件|识别|ocr/.test(normalized) || inputMode === 'multimodal' || hasFiles) {
    return {
      category: '附件识别',
      priority: 'P1',
      reply: hasFiles
        ? `结论：已收到您上传的附件。\n\n处理方式：\n1. 图片会优先通过多模态模型直接识别；\n2. 如果多模态模型未接通，系统会提示配置问题，不会默认用 OCR 冒充识图；\n3. 若需要人工核验，请点击「转人工客服」。`
        : `请先上传图片、截图或文件，我再帮您判断页面问题或资料内容。`
    };
  }

  return null;
}

function mockReply(query, identity = '供应商', files = [], options = {}) {
  const { inputMode = 'text', translation = {} } = options;
  const intent = classifyIntent(query, files, inputMode);
  const agent = agents.find((item) => item.id === intent.agentId) || agents[0];
  const knowledgeReply = buildKnowledgeReply(query, identity, files, inputMode);
  const translationState = {
    ...normalizeTranslation(translation),
    sourceLanguageLabel: languageLabelMap[(normalizeTranslation(translation).sourceLanguage || 'auto')] || '自动识别',
    targetLanguageLabel: languageLabelMap[(normalizeTranslation(translation).targetLanguage || 'zh-CN')] || '中文'
  };
  const translationTip = translationState.enabled
    ? `\n\n语言转换配置：${translationState.sourceLanguageLabel} -> ${translationState.targetLanguageLabel}（已下发给工具链）。`
    : '';
  const reply = knowledgeReply
    ? `${knowledgeReply.reply}${translationTip}`
    : `${buildNoAnswerReply('非常抱歉，当前暂时没有找到相关问题的答案。')}${translationTip}`;

  return {
    reply,
    category: knowledgeReply?.category || intent.category,
    priority: knowledgeReply?.priority || intent.priority,
    agent,
    citations: [
      {
        label: '参考范围',
        value: '共创平台常见问题'
      }
    ],
    actions: buildSupportActions()
  };
}

function buildDifyFilePayload(files = [], runtime) {
  return (files || []).filter((file) => Boolean(file.difyFileId)).map((file) => ({
    type: file.mime?.startsWith('image/') ? 'image' : 'document',
    transfer_method: 'local_file',
    upload_file_id: file.difyFileIds?.[runtime.agentId] || file.difyFileIds?.['dify-workflow'] || file.difyFileId
  }));
}

function buildDifyWorkflowFileInput(files = [], runtime) {
  const payload = buildDifyFilePayload(files, runtime);
  if (getDifyWorkflowFilesInputMode() === 'array') {
    return payload;
  }
  return payload[0] || null;
}

function extractWorkflowOutputText(data = {}) {
  const outputs = data?.data?.outputs || data?.outputs || {};
  if (typeof outputs === 'string' && outputs.trim()) return outputs.trim();

  const directKeys = ['answer', 'text', 'output', 'result', 'reply', 'response'];
  for (const key of directKeys) {
    if (typeof outputs?.[key] === 'string' && outputs[key].trim()) {
      return outputs[key].trim();
    }
  }

  const collect = (value) => {
    if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
    if (Array.isArray(value)) return value.flatMap(collect);
    if (value && typeof value === 'object') return Object.values(value).flatMap(collect);
    return [];
  };
  return collect(outputs)[0] || data.answer || '';
}

function parseDifySseChunk(chunk = '') {
  const lines = String(chunk).split(/\r?\n/);
  const dataLines = [];
  for (const line of lines) {
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim());
    }
  }
  if (dataLines.length === 0) return null;
  const raw = dataLines.join('\n').trim();
  if (!raw || raw === '[DONE]') return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeDifyWorkflowNodeEvent(event = {}) {
  const data = event.data || {};
  const nodeId = data.node_id || data.id || '';
  const title = data.title || data.node_title || event.event || 'Workflow';
  if (!nodeId && !title) return null;
  return {
    id: nodeId || `${event.event}-${title}`,
    title,
    type: data.node_type || event.event || 'workflow',
    status: data.status || (event.event === 'node_started' ? 'running' : 'succeeded'),
    index: Number.isFinite(Number(data.index)) ? Number(data.index) : null,
    elapsedTime: typeof data.elapsed_time === 'number' ? data.elapsed_time : null
  };
}

function upsertWorkflowNode(nodes = [], node = {}) {
  if (!node?.id) return nodes;
  const index = nodes.findIndex((item) => item.id === node.id);
  if (index >= 0) {
    nodes[index] = { ...nodes[index], ...node };
  } else {
    nodes.push(node);
  }
  return nodes;
}

async function readDifyWorkflowStream(response) {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Dify workflow streaming response has no readable body');
  }
  const decoder = new TextDecoder();
  let buffer = '';
  let streamedText = '';
  let finalEvent = null;
  let pausedEvent = null;
  const events = [];
  const nodes = [];

  const handleEvent = (event) => {
    if (!event?.event) return;
    events.push(event);
    if (event.event === 'workflow_started') {
      upsertWorkflowNode(nodes, {
        id: event.data?.workflow_id || event.workflow_run_id || 'workflow-started',
        title: 'Workflow 开始',
        type: 'workflow',
        status: 'succeeded',
        index: 0
      });
      return;
    }
    if (event.event === 'node_started' || event.event === 'node_finished') {
      const node = normalizeDifyWorkflowNodeEvent(event);
      if (node) upsertWorkflowNode(nodes, node);
      return;
    }
    if (event.event === 'text_chunk') {
      streamedText += safeText(event.data?.text || '');
      return;
    }
    if (event.event === 'human_input_required' || event.event === 'workflow_paused') {
      pausedEvent = event;
      return;
    }
    if (event.event === 'workflow_finished') {
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

  return {
    reply: streamedText || extractWorkflowOutputText(finalEvent || {}),
    finalEvent,
    pausedEvent,
    workflowRunId: finalEvent?.workflow_run_id || pausedEvent?.workflow_run_id || events.find((item) => item.workflow_run_id)?.workflow_run_id || '',
    taskId: finalEvent?.task_id || pausedEvent?.task_id || events.find((item) => item.task_id)?.task_id || '',
    nodes: nodes
      .filter((node) => node.title)
      .sort((a, b) => {
        if (a.index === null && b.index === null) return 0;
        if (a.index === null) return 1;
        if (b.index === null) return -1;
        return a.index - b.index;
      })
      .slice(0, 8),
    eventCount: events.length
  };
}

function sanitizeAssistantReply(value = '') {
  const raw = safeText(value);
  if (!raw) return '';
  const cleaned = raw
    .replace(/<think(?:ing)?[^>]*>[\s\S]*?<\/think(?:ing)?>/gi, '\n')
    .replace(/<\/?think(?:ing)?[^>]*>/gi, '')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return cleaned || '我已完成分析，但当前未生成可直接展示的答案。请补充具体问题，或转人工客服继续处理。';
}

function buildDifyResult({ query, files, inputMode, runtime, reply, category, priority, citationValue, workflowEvents }) {
  const intent = classifyIntent(query, files, inputMode);
  const agent =
    runtime.agentId === 'dify-workflow'
      ? {
          id: 'dify-workflow',
          name: runtime.label,
          owner: 'Dify Workflow',
          status: 'online',
          duty: '问题分类器 -> 技术/账单/其他 LLM',
          api: '/workflows/run'
        }
      : agents.find((item) => item.id === runtime.agentId) || agents.find((item) => item.id === intent.agentId) || agents[1];
  return {
    reply: sanitizeAssistantReply(reply),
    category: category || intent.category,
    priority: priority || intent.priority,
    agent,
    citations: [
      {
        label: runtime.label,
        value: citationValue
      },
      {
        label: runtime.agentId === 'dify-workflow' ? 'Workflow 输入' : '智能体路由',
        value: runtime.agentId === 'dify-workflow' ? getDifyWorkflowInputKey() : runtime.agentId
      }
    ],
    actions: [
      {
        type: 'ticket',
        label: '生成客服工单'
      }
    ],
    workflowEvents
  };
}

function sanitizeExternalError(value = '') {
  return String(value)
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer ***')
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, 'sk-***')
    .slice(0, 500);
}

function isTransientDifyError(message = '') {
  const text = String(message);
  if (/invalid upload file|incorrect model credentials|unauthorized|forbidden|not_workflow_app/i.test(text)) {
    return false;
  }
  return /ChunkedEncodingError|Response ended prematurely|PluginInvokeError|ECONNRESET|ETIMEDOUT|fetch failed|network|timeout/i.test(text);
}

function buildDeepSeekSystemPrompt(identity = '供应商') {
  return [
    '你是来伊份共创平台的 AI 客服助手“小伊”。',
    `当前用户身份：${identity}。`,
    '回答要求：用中文，简洁、客服式、可执行；优先给结论和步骤；不要编造后台数据；不能确认的信息提示转人工或提交工单。',
    '格式要求：不要使用 emoji；不要使用营销化语气；少用 Markdown 粗体，保持后台客服系统可读。',
    '业务边界：供应商入驻、合同授权、账号权限、加盟商商机报名、今日待办、工单与人工客服、附件上传和脱敏识别。',
    '规则：转人工不会跳转页面；人工客服服务时间为周一至周五 09:00-18:00；工单转派只能由客服后台操作。'
  ].join('\n');
}

function normalizeDeepSeekPriority(intent, query = '') {
  if (intent.priority !== 'P0') {
    return intent.priority;
  }
  if (intent.category === '系统异常与缺陷' || intent.category === '账号权限与登录' || intent.category === '工单与人工客服') {
    return 'P0';
  }
  if (/卡死|故障|bug|报错|无法|投诉|转人工|人工客服|紧急|权限|服务中断|加载失败|按钮.*(无效|不可用)|接口错误/.test(query)) {
    return 'P0';
  }
  return 'P1';
}

function buildDeepSeekResult({ query, identity, files = [], inputMode = 'text', reply, runtime }) {
  const intent = classifyIntent(query, files, inputMode);
  return {
    reply: sanitizeAssistantReply(reply),
    category: intent.category,
    priority: normalizeDeepSeekPriority(intent, query),
    agent: {
      id: 'deepseek',
      name: 'DeepSeek 客服助手',
      owner: 'DeepSeek API',
      status: 'online',
      duty: 'Dify 未返回时的智能回复兜底',
      api: '/chat/completions'
    },
    citations: [
      {
        label: '模型',
        value: runtime.model
      }
    ],
    actions: buildSupportActions()
  };
}

function resolveLocalUploadPath(file = {}) {
  const name = path.basename(file.name || file.url || '');
  if (!name) return '';
  const fullPath = path.join(uploadDir, name);
  return fullPath.startsWith(uploadDir) ? fullPath : '';
}

function fileToImageContent(file = {}) {
  if (!isImageMime(file.mime)) return null;
  const fullPath = resolveLocalUploadPath(file);
  if (!fullPath || !fs.existsSync(fullPath)) return null;
  const buffer = fs.readFileSync(fullPath);
  return {
    type: 'image_url',
    image_url: {
      url: `data:${file.mime};base64,${buffer.toString('base64')}`
    }
  };
}

function hasImageFiles(files = []) {
  return Array.isArray(files) && files.some((file) => isImageMime(file?.mime));
}

function shouldUseDirectMultimodalForPayload({ query = '', files = [], inputMode = 'text' } = {}) {
  return shouldUseDifyDirectMultimodal() && hasImageFiles(files) && (normalizeInputMode(inputMode) === 'multimodal' || isVisionRequest(query));
}

function isDirectMultimodalUnavailableError(message = '') {
  return /DIFY_MULTIMODAL_UNAVAILABLE|Incorrect model credentials|invalid upload file|image_url|vision|multimodal|Tongyi|model credentials/i.test(
    String(message)
  );
}

function buildModelFileContext(files = [], options = {}) {
  if (!Array.isArray(files) || files.length === 0) return '';
  const includeExtractedText = options.includeExtractedText ?? shouldUseLocalOcr();
  const rows = files.map((file, index) => {
    const fileName = file.originalName || file.name || `附件${index + 1}`;
    const mime = file.mime || 'unknown';
    const difyState = file.difyFileId ? '已上传到 Dify，可作为多模态文件输入' : '仅本地接收，未拿到 Dify 文件 ID';
    const extracted = includeExtractedText
      ? safeText(file.ocrText || (file.extractedText || '').replace(/^图片已上传，本地 OCR 已识别到以下界面文字：\n?/, ''))
      : '';
    return `- ${fileName}（${mime}）：${difyState}${extracted ? `\n  本地提取内容：${extracted.slice(0, 1800)}` : ''}`;
  });
  return `\n\n已上传附件上下文：\n${rows.join('\n')}`;
}

function buildModelQuery(query, files = []) {
  const attachmentRouteHint = Array.isArray(files) && files.length > 0
    ? '\n\n【路由提示】本次请求包含上传附件，必须优先进入“附件多模态识别”分支，由多模态模型直接查看文件内容。'
    : '';
  return `${query}${attachmentRouteHint}${buildModelFileContext(files, { includeExtractedText: shouldUseLocalOcr() })}`;
}

function buildReasoningSummary({ trace, source, files = [], result, fallbackReason = '' }) {
  const imageCount = files.filter((file) => isImageMime(file?.mime)).length;
  const documentCount = files.length - imageCount;
  const workflowEvents = Array.isArray(result?.workflowEvents?.nodes) ? result.workflowEvents.nodes : [];
  return {
    title: 'AI 处理结果',
    source,
    sourceLabel: source === 'deepseek' ? 'DeepSeek' : 'AI 服务',
    model: result?.citations?.find((item) => item.label === '模型')?.value || result?.agent?.owner || '',
    summary: [
      `问题类型：${trace.agent2_intent.category}，优先级 ${result?.priority || trace.agent2_intent.priority}。`,
      trace.status === 'blocked'
        ? '当前需要确认后才能继续处理。'
        : trace.agent4_security.risk_level === 'high'
          ? '当前请求风险较高，系统已采用谨慎处理方式。'
          : '已完成问题判断，可以继续处理当前请求。',
      imageCount > 0 ? `已结合 ${imageCount} 张图片一起分析。` : '',
      documentCount > 0 ? `已结合 ${documentCount} 个附件作为上下文。` : ''
    ].filter(Boolean),
    evidence: {
      attachmentCount: files.length,
      imageCount,
      inputMode: trace.input_summary.input_mode,
      pageType: trace.agent1_multimodal.page_type,
      confidence: trace.resolution?.confidence || trace.agent2_intent.confidence,
      canExecute: trace.agent3_execution.can_execute,
      blocked: trace.status === 'blocked',
      reasons: trace.agent4_security.reasons,
      fallbackReason
    },
    workflowEvents
  };
}

async function callDeepSeek({ query, identity = '供应商', files = [], inputMode = 'text' }) {
  const runtime = getDeepSeekRuntime();
  if (!runtime) {
    return null;
  }

  const imageContents = runtime.enableImageUrl ? files.map(fileToImageContent).filter(Boolean) : [];
  const fileContext = files.length
    ? `${buildModelFileContext(files, { includeExtractedText: shouldUseLocalOcr() })}\n${
        imageContents.length > 0
          ? '图片已作为视觉输入随请求发送，请识别界面关键信息。'
          : '当前 DeepSeek 接口未接收图片视觉输入；不要声称已经完整读取图片内容。'
      }`
    : '';
  const userContent =
    imageContents.length > 0
      ? [
          {
            type: 'text',
            text: `${query}${fileContext}\n\n请先识别图片中的产品界面、页面模块、按钮、待办或错误信息，再结合用户问题给出操作建议。`
          },
          ...imageContents
        ]
      : `${query}${fileContext}`;

  const response = await fetch(`${runtime.apiUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${runtime.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: imageContents.length > 0 ? runtime.visionModel : runtime.model,
      messages: [
        {
          role: 'system',
          content: buildDeepSeekSystemPrompt(identity)
        },
        {
          role: 'user',
          content: userContent
        }
      ],
      stream: false,
      thinking: {
        type: 'disabled'
      },
      temperature: 0.2
    })
  });

  const rawText = await response.text();
  if (!response.ok) {
    throw new Error(`DeepSeek request failed ${response.status}: ${sanitizeExternalError(rawText)}`);
  }

  let data = {};
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(`DeepSeek returned non-JSON response: ${sanitizeExternalError(rawText)}`);
  }

  const reply = safeText(data?.choices?.[0]?.message?.content);
  if (!reply) {
    throw new Error('DeepSeek returned empty answer');
  }

  return buildDeepSeekResult({
    query,
    identity,
    files,
    inputMode,
    reply,
    runtime
  });
}

async function callDifyWorkflow({ query, session, identity, files, inputMode = 'text', translation = {} }) {
  const runtime = getDifyWorkflowRuntime();
  if (!runtime) {
    return null;
  }
  const normalizedTranslation = normalizeTranslation(translation);
  const languageInputs = {
    source_language: normalizedTranslation.sourceLanguage,
    target_language: normalizedTranslation.targetLanguage,
    translation_enabled: normalizedTranslation.enabled
  };
  const inputModeValue = normalizeInputMode(inputMode);
  const intent = classifyIntent(query, files, inputModeValue);
  const usableFiles = buildDifyFilePayload(files, runtime);
  const modelQuery = buildModelQuery(query, files);
  const issueType = normalizeWorkflowIssueType(intent, query);
  const inputs = {
    [getDifyWorkflowInputKey()]: modelQuery,
    customer_issue_original: query,
    issue_type: issueType,
    issue_category: intent.category,
    search_type: deriveDifySearchType(intent, files, inputModeValue),
    customer_identity: identity,
    identity,
    urgency_level: normalizeWorkflowUrgencyLevel(intent.priority),
    source: 'laiyifen-ai-prototype',
    input_mode: inputModeValue,
    ...languageInputs
  };
  const filesInputKey = getDifyWorkflowFilesInputKey();
  if (filesInputKey && usableFiles.length > 0) {
    inputs[filesInputKey] = buildDifyWorkflowFileInput(files, runtime);
  }
  const body = {
    inputs,
    response_mode: getDifyWorkflowResponseMode(),
    user: getDifyRequestUser()
  };

  const maxAttempts = Math.max(1, Math.min(5, Number(process.env.DIFY_WORKFLOW_MAX_RETRIES || 3)));
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const res = await fetch(`${runtime.apiUrl}/workflows/run`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${runtime.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Dify workflow request failed ${res.status}: ${text.slice(0, 240)}`);
      }

      if (body.response_mode === 'streaming') {
        const streamResult = await readDifyWorkflowStream(res);
        if (streamResult.pausedEvent) {
          throw new Error('Dify workflow paused for human input. Please handle Human-in-the-Loop form before continuing.');
        }
        if (streamResult.finalEvent?.data?.status === 'failed' || streamResult.finalEvent?.data?.error) {
          throw new Error(`Dify workflow run failed: ${streamResult.finalEvent?.data?.error || streamResult.finalEvent?.data?.status}`);
        }
        const reply = streamResult.reply || extractWorkflowOutputText(streamResult.finalEvent || {});
        if (!reply) {
          throw new Error('Dify workflow streaming returned empty output. Please check text_chunk or output node mapping.');
        }
        return buildDifyResult({
          query,
          files,
          inputMode: inputModeValue,
          runtime,
          reply,
          citationValue: streamResult.workflowRunId || streamResult.taskId || 'streaming workflow',
          workflowEvents: streamResult
        });
      }

      const data = await res.json();
      if (data?.data?.status === 'failed' || data?.data?.error) {
        throw new Error(`Dify workflow run failed: ${data?.data?.error || data?.data?.status}`);
      }
      const reply = extractWorkflowOutputText(data);
      if (!reply) {
        throw new Error('Dify workflow returned empty output. Please check the end node output variable.');
      }
      return buildDifyResult({
        query,
        files,
        inputMode: inputModeValue,
        runtime,
        reply,
        citationValue: data?.data?.workflow_id || data?.workflow_run_id || data?.data?.id || 'blocking workflow',
        workflowEvents: {
          nodes: [
            {
              id: data?.data?.workflow_id || data?.data?.id || 'workflow',
              title: 'Workflow 完成',
              type: 'workflow',
              status: data?.data?.status || 'succeeded',
              index: 0,
              elapsedTime: data?.data?.elapsed_time || null
            }
          ],
          workflowRunId: data?.workflow_run_id || data?.data?.id || '',
          taskId: data?.task_id || '',
          eventCount: 1
        }
      });
    } catch (error) {
      lastError = error;
      if (body.response_mode === 'streaming' && !/human input|paused/i.test(error.message)) {
        console.warn('[dify:streaming-fallback]', sanitizeExternalError(error.message));
        body.response_mode = 'blocking';
        continue;
      }
      if (attempt >= maxAttempts || !isTransientDifyError(error.message)) {
        throw error;
      }
      await sleep(500 * attempt);
    }
  }
  throw lastError || new Error('Dify workflow request failed');
}

async function callDifyChat({ query, session, identity, files, inputMode = 'text', translation = {}, agentId }) {
  const runtime = resolveDifyRuntime({ agentId, query, files, inputMode });
  if (!runtime) {
    return null;
  }
  const normalizedTranslation = normalizeTranslation(translation);
  const languageInputs = {
    source_language: normalizedTranslation.sourceLanguage,
    target_language: normalizedTranslation.targetLanguage,
    translation_enabled: normalizedTranslation.enabled
  };
  const inputModeValue = normalizeInputMode(inputMode);
  const usableFiles = buildDifyFilePayload(files, runtime);
  session.difyConversations = session.difyConversations || {};
  const body = {
    inputs: {
      identity,
      source: 'laiyifen-ai-prototype',
      input_mode: inputModeValue,
      agent_id: runtime.agentId,
      agent_name: runtime.label,
      ...languageInputs
    },
    query,
    response_mode: 'blocking',
    conversation_id: session.difyConversations[runtime.agentId] || session.difyConversationId || '',
    user: getDifyRequestUser(),
    files: usableFiles
  };

  const res = await fetch(`${runtime.apiUrl}/chat-messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${runtime.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Dify chat request failed ${res.status}: ${text.slice(0, 240)}`);
  }

  const data = await res.json();
  if (data.conversation_id) {
    session.difyConversations[runtime.agentId] = data.conversation_id;
    session.difyConversationId = data.conversation_id;
  }
  return buildDifyResult({
    query,
    files,
    inputMode: inputModeValue,
    runtime,
    reply: data.answer || 'Dify 已返回空答案，请检查应用编排。',
    citationValue: data.conversation_id || 'blocking chat response'
  });
}

async function callDify(payload) {
  const mode = getDifyAppMode();
  const workflowOwnsFiles = Boolean(getDifyWorkflowFilesInputKey()) && (mode === 'workflow' || mode === 'auto');
  if (shouldUseDirectMultimodalForPayload(payload) && !workflowOwnsFiles) {
    try {
      return await callDifyChat({ ...payload, agentId: 'agent-file' });
    } catch (error) {
      if (shouldRequireDirectMultimodal()) {
        throw new Error(`DIFY_MULTIMODAL_UNAVAILABLE: ${sanitizeExternalError(error.message)}`);
      }
      console.warn('[dify:multimodal-fallback]', sanitizeExternalError(error.message));
    }
  }

  if (mode === 'chat') {
    return callDifyChat(payload);
  }
  if (mode === 'auto') {
    try {
      return await callDifyWorkflow(payload);
    } catch (error) {
      if (/404|405|not found|workflow/i.test(error.message)) {
        try {
          return await callDifyChat(payload);
        } catch (fallbackError) {
          throw new Error(
            `Dify Workflow 未接通：${error.message.slice(0, 180)}；Chat 回退也失败：${fallbackError.message.slice(0, 180)}`
          );
        }
      }
      throw error;
    }
  }
  return callDifyWorkflow(payload);
}

function buildDifyDebugRecommendation(workflowResult, chatResult) {
  if (workflowResult?.ok) {
    return 'Workflow 已可用，建议将 DIFY_APP_MODE 固定为 workflow。';
  }
  if (/not_workflow_app/i.test(workflowResult?.error || '')) {
    return '当前 API Key 不是该 Workflow 应用的 Key。请在 Dify「智能客服分流助手」访问 API 页面获取对应 App Key，填入 DIFY_WORKFLOW_API_KEY 或替换 DIFY_API_KEY。';
  }
  if (/Incorrect model credentials|model credentials|credentials/i.test(chatResult?.error || workflowResult?.error || '')) {
    return 'Dify 应用已收到请求，但模型供应商凭证不可用。请在 Dify 模型供应商配置中检查通义/DeepSeek 等模型 Key。';
  }
  if (/output|输出节点|empty|空答案/i.test(workflowResult?.reply || workflowResult?.error || '')) {
    return 'Workflow 执行到输出层但未拿到文本。请检查 Dify「输出」节点是否映射了 LLM 节点 text。';
  }
  return '请先确认 Dify App Key、Workflow 是否已发布、模型供应商凭证和输出节点变量映射。';
}

function getIntegrationSourceStatus() {
  return {
    dataSource: {
      source: 'customer-ai-remote',
      label: '原站共创/客服数据接口',
      enabled: isCustomerAiRemoteEnabled(false),
      endpointCount: customerAiEndpointRegistry.filter((endpoint) => !endpoint.remoteAi).length,
      writeEnabled: customerAiRemoteConfig.writeEnabled
    },
    aiSource: {
      source: 'own-dify-qwen',
      label: '自有 Dify/Qwen 智能体',
      connected: hasAnyDifyRuntime(),
      appMode: getDifyAppMode(),
      modelProfile: safeText(process.env.DIFY_MODEL_PROFILE || 'qwen'),
      directMultimodal: shouldUseDifyDirectMultimodal(),
      strictMultimodal: shouldRequireDirectMultimodal(),
      localOcrEnabled: shouldUseLocalOcr()
    },
    originalAiSource: {
      source: 'customer-ai-remote-ai',
      label: '原站 AI 搜索/解析/流式接口',
      enabled: isCustomerAiRemoteAiEnabled(),
      endpointCount: customerAiEndpointRegistry.filter((endpoint) => endpoint.remoteAi).length,
      usage: isCustomerAiRemoteAiEnabled() ? 'debug-only' : 'disabled'
    }
  };
}

async function runDifyDebugProbe({ text = '请用一句话回复：智能客服分流助手调试成功', identity = '供应商', agentId = 'agent-knowledge' } = {}) {
  const testSession = {
    id: makeId('dify-debug'),
    userId: 'dify-debug-user',
    identity,
    messages: [],
    difyConversations: {},
    createdAt: now(),
    updatedAt: now()
  };
  const basePayload = {
    query: text,
    session: testSession,
    identity,
    files: [],
    inputMode: 'text',
    translation: {},
    agentId
  };
  const workflowRuntime = getDifyWorkflowRuntime();
  const workflow = {
    configured: Boolean(workflowRuntime),
    route: `${workflowRuntime?.apiUrl || ''}/workflows/run`,
    inputKey: getDifyWorkflowInputKey(),
    filesInputKey: getDifyWorkflowFilesInputKey(),
    filesInputMode: getDifyWorkflowFilesInputMode(),
    issueTypeMode: getDifyWorkflowIssueTypeMode(),
    ok: false,
    reply: '',
    error: ''
  };
  if (workflowRuntime) {
    try {
      const result = await callDifyWorkflow(basePayload);
      workflow.ok = Boolean(result);
      workflow.reply = result?.reply || '';
    } catch (error) {
      workflow.error = error.message.slice(0, 500);
    }
  }

  const chatRuntime = resolveDifyRuntime({ agentId, query: text, files: [], inputMode: 'text' });
  const chat = {
    configured: Boolean(chatRuntime),
    route: `${chatRuntime?.apiUrl || ''}/chat-messages`,
    ok: false,
    reply: '',
    error: ''
  };
  if (chatRuntime) {
    try {
      const result = await callDifyChat(basePayload);
      chat.ok = Boolean(result);
      chat.reply = result?.reply || '';
    } catch (error) {
      chat.error = error.message.slice(0, 500);
    }
  }

  return {
    mode: getDifyAppMode(),
    workflow,
    chat,
    recommendation: buildDifyDebugRecommendation(workflow, chat)
  };
}

async function notifyFeishu(ticket, reason = '新工单生成') {
  const webhook = process.env.FEISHU_WEBHOOK_URL;
  const payload = {
    msg_type: 'interactive',
    card: {
      header: {
        title: {
          tag: 'plain_text',
          content: `${reason}: ${ticket.id}`
        }
      },
      elements: [
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `**${ticket.title}**\n分类：${ticket.category}｜优先级：${ticket.priority}｜用户：${ticket.userName}（${ticket.identity}）`
          }
        }
      ]
    }
  };

  if (!webhook) {
    return {
      ok: true,
      mocked: true,
      payload
    };
  }

  const res = await fetch(webhook, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  return {
    ok: res.ok,
    status: res.status,
    mocked: false
  };
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    dify: hasAnyDifyRuntime(),
    difyAgents: getDifyRuntimeStatus(),
    deepseek: getDeepSeekRuntimeStatus(),
    datasets: getDifyDatasetRuntimeStatus(),
    integrationSources: getIntegrationSourceStatus(),
    feishu: Boolean(process.env.FEISHU_WEBHOOK_URL),
    time: now()
  });
});

app.get('/api/integration/sources', (_req, res) => {
  res.json({
    ok: true,
    ...getIntegrationSourceStatus()
  });
});

app.get('/api/deepseek/runtime', (_req, res) => {
  res.json({
    ok: true,
    deepseek: getDeepSeekRuntimeStatus()
  });
});

app.post('/api/deepseek/test', async (req, res) => {
  const text = safeText(req.body?.text) || '请用一句话回复：DeepSeek 接入测试成功';
  try {
    const result = await callDeepSeek({
      query: text,
      identity: safeText(req.body?.identity) || '供应商',
      files: [],
      inputMode: 'text'
    });
    if (!result) {
      res.status(400).json({
        ok: false,
        message: 'DeepSeek 未配置，请检查 DEEPSEEK_API_URL、DEEPSEEK_API_KEY、DEEPSEEK_MODEL。'
      });
      return;
    }
    res.json({
      ok: true,
      model: getDeepSeekRuntimeStatus().model,
      reply: result.reply
    });
  } catch (error) {
    res.status(502).json({
      ok: false,
      message: sanitizeExternalError(error.message)
    });
  }
});

app.get('/api/datasets/debug', async (req, res) => {
  const runtime = getDifyDatasetRuntime();
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
  if (!runtime) {
    res.status(400).json({
      ok: false,
      message: 'Dify 数据集 API 未配置。数据集列表不能使用 App Key，请在 Dify 知识库/数据集 API Key 中生成 Key 后填入 DIFY_DATASET_API_KEY。',
      datasets: getDifyDatasetRuntimeStatus()
    });
    return;
  }

  const route = `${runtime.apiUrl}/datasets?page=${page}&limit=${limit}`;
  try {
    const response = await fetch(route, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${runtime.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    const rawText = await response.text();
    let data = {};
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { raw: sanitizeExternalError(rawText) };
    }

    if (!response.ok) {
      res.status(502).json({
        ok: false,
        status: response.status,
        route,
        datasets: getDifyDatasetRuntimeStatus(),
        message: sanitizeExternalError(rawText)
      });
      return;
    }

    const rows = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
    res.json({
      ok: true,
      status: response.status,
      route,
      page,
      limit,
      total: data?.total ?? rows.length,
      has_more: Boolean(data?.has_more),
      datasets: rows.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description || '',
        permission: item.permission || '',
        data_source_type: item.data_source_type || item.data_source?.type || '',
        indexing_technique: item.indexing_technique || '',
        document_count: item.document_count ?? item.document_count_limit ?? 0,
        word_count: item.word_count ?? 0,
        app_count: item.app_count ?? 0,
        created_at: item.created_at,
        updated_at: item.updated_at
      })),
      raw_shape: {
        keys: data && typeof data === 'object' ? Object.keys(data) : [],
        itemKeys: rows[0] ? Object.keys(rows[0]) : []
      }
    });
  } catch (error) {
    res.status(502).json({
      ok: false,
      route,
      datasets: getDifyDatasetRuntimeStatus(),
      message: sanitizeExternalError(error.message)
    });
  }
});

async function buildBootstrapPayload({ includeRemote = false } = {}) {
  const payload = {
    quickQuestions,
    tickets,
    conversationHistories,
    agents,
    supportStaff,
    serviceHours,
    difyConnected: hasAnyDifyRuntime(),
    integrationSources: getIntegrationSourceStatus(),
    customerAiRemote: {
      enabled: includeRemote,
      ok: false,
      endpoints: customerAiEndpointRegistry.length,
      remoteAiEnabled: isCustomerAiRemoteAiEnabled()
    }
  };

  if (!includeRemote) {
    return payload;
  }

  const remote = await getCustomerAiRemoteBootstrap(false);
  return {
    ...payload,
    quickQuestions: remote.quickQuestions.length ? remote.quickQuestions : payload.quickQuestions,
    tickets: remote.tickets.length ? remote.tickets : payload.tickets,
    conversationHistories: remote.histories.length ? remote.histories : payload.conversationHistories,
    customerAiRemote: {
      enabled: true,
      ok: remote.ok,
      endpoints: customerAiEndpointRegistry.length,
      remoteAiEnabled: isCustomerAiRemoteAiEnabled(),
      successfulReads: remote.results.filter((item) => item.ok).length,
      failedReads: remote.results.filter((item) => !item.ok).length
    }
  };
}

app.get('/api/bootstrap', async (_req, res) => {
  res.json(await buildBootstrapPayload({ includeRemote: isCustomerAiRemoteEnabled(false) }));
});

app.get('/api/agents/runtime', (_req, res) => {
  res.json({
    connected: hasAnyDifyRuntime(),
    agents: getDifyRuntimeStatus()
  });
});

app.get('/api/dify/workflow/debug', async (req, res) => {
  try {
    const result = await runDifyDebugProbe({
      text: req.query.text || undefined,
      identity: req.query.identity || '供应商',
      agentId: req.query.agentId || 'agent-knowledge'
    });
    res.json({
      ok: result.workflow.ok || result.chat.ok,
      ...result
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: error.message.slice(0, 500)
    });
  }
});

app.post('/api/dify/workflow/debug', async (req, res) => {
  try {
    const result = await runDifyDebugProbe({
      text: req.body.text,
      identity: req.body.identity || '供应商',
      agentId: req.body.agentId || 'agent-knowledge'
    });
    res.json({
      ok: result.workflow.ok || result.chat.ok,
      ...result
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: error.message.slice(0, 500)
    });
  }
});

app.get('/api/customer-ai/endpoints', (_req, res) => {
  res.json({
    pageUrl: defaultCustomerAiPageUrl,
    remoteEnabled: isCustomerAiRemoteEnabled(false),
    remoteAiEnabled: isCustomerAiRemoteAiEnabled(),
    writeEnabled: customerAiRemoteConfig.writeEnabled,
    config: {
      openApiBase: customerAiRemoteConfig.openApiBase,
      aiOpenApiBase: customerAiRemoteConfig.aiOpenApiBase,
      coreBase: customerAiRemoteConfig.coreBase,
      fileBase: customerAiRemoteConfig.fileBase,
      sseBase: customerAiRemoteConfig.sseBase,
      wsBase: customerAiRemoteConfig.wsBase,
      userId: customerAiRemoteConfig.userId,
      source: customerAiRemoteConfig.source,
      tokenConfigured: Boolean(process.env.CUSTOMER_AI_TOKEN),
      clientIdConfigured: Boolean(customerAiRemoteConfig.clientId),
      secretKeyConfigured: Boolean(customerAiRemoteConfig.secretKey),
      accessTokenConfigured: Boolean(customerAiRemoteConfig.accessToken),
      authTokenConfigured: Boolean(customerAiRemoteConfig.authToken),
      signAlgorithm: customerAiRemoteConfig.signAlgorithm,
      signTemplateConfigured: Boolean(process.env.CUSTOMER_AI_SIGN_TEMPLATE),
      remoteAiEnabled: isCustomerAiRemoteAiEnabled()
    },
    endpoints: customerAiEndpointRegistry.map((endpoint) => ({
      key: endpoint.key,
      method: endpoint.method,
      mode: endpoint.mode,
      base: endpoint.base,
      remoteAi: Boolean(endpoint.remoteAi),
      contentType: endpoint.contentType || 'json',
      description: endpoint.description,
      url: buildCustomerAiUrl(endpoint)
    }))
  });
});

app.get('/api/customer-ai/remote/bootstrap', async (req, res) => {
  const force = req.query.force === '1' || req.query.force === 'true';
  const remote = await getCustomerAiRemoteBootstrap(force);
  res.json({
    ok: remote.ok,
    enabled: isCustomerAiRemoteEnabled(force),
    quickQuestions: remote.quickQuestions,
    tickets: remote.tickets,
    conversationHistories: remote.histories,
    results: remote.results.map((result) => ({
      key: result.key,
      description: result.description,
      method: result.method,
      mode: result.mode,
      url: result.url,
      ok: result.ok,
      status: result.status,
      businessCode: result.businessCode || '',
      skipped: result.skipped || false,
      error: result.error || '',
      dataPreview: typeof result.data === 'string' ? result.data.slice(0, 200) : result.data ? JSON.stringify(result.data).slice(0, 300) : ''
    }))
  });
});

app.all('/api/customer-ai/remote/:key', upload.any(), async (req, res) => {
  const force = req.query.force === '1' || req.query.force === 'true';
  const stream = req.query.stream === '1' || req.query.stream === 'true';
  const params = { ...req.query, ...req.body };
  delete params.force;
  delete params.stream;
  const result = await callCustomerAiEndpoint(req.params.key, {
    params,
    body: req.method === 'GET' ? undefined : req.body,
    files: Array.isArray(req.files) ? req.files : [],
    stream,
    force
  });
  res.status(result.status && result.status >= 400 ? result.status : 200).json(result);
});

app.post('/api/agents/:id/test', async (req, res) => {
  const agentId = req.params.id;
  const runtime = getDifyRuntime(agentId);
  if (!runtime) {
    res.status(404).json({
      ok: false,
      agentId,
      message: '该智能体未配置 Dify API URL 或 API Key。'
    });
    return;
  }

  const testSession = {
    id: makeId('agent-test'),
    userId: 'agent-runtime-test',
    identity: req.body.identity || '供应商',
    messages: [],
    difyConversations: {},
    createdAt: now(),
    updatedAt: now()
  };

  try {
    const result = await callDify({
      query: req.body.text || '请用一句话回复：智能体连接测试成功',
      session: testSession,
      identity: testSession.identity,
      files: [],
      inputMode: 'text',
      translation: {},
      agentId
    });
    res.json({
      ok: true,
      agentId,
      label: runtime.label,
      reply: result?.reply || '',
      conversationId: testSession.difyConversations?.[agentId] ? 'present' : ''
    });
  } catch (error) {
    res.status(502).json({
      ok: false,
      agentId,
      label: runtime.label,
      message: error.message.slice(0, 300)
    });
  }
});

app.get('/api/quick-questions', (_req, res) => {
  res.json(quickQuestions.sort((a, b) => a.identity.localeCompare(b.identity, 'zh') || a.sort - b.sort));
});

app.get('/api/workflow/audits', (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 200);
  const traceId = safeText(req.query.trace_id);
  const filtered = traceId ? workflowAudits.filter((item) => item.trace_id === traceId) : workflowAudits;
  res.json({
    total: filtered.length,
    items: filtered.slice(-limit).reverse()
  });
});

app.get('/api/customer-ai/inspect', async (req, res) => {
  const pageUrl = safeText(req.query.url) || defaultCustomerAiPageUrl;
  const page = await fetchWithTimeout(pageUrl);
  const assets = page.ok ? extractAssetUrls(page.text, page.url || pageUrl).slice(0, 40) : [];
  const apiCandidates = new Set(page.ok ? extractApiCandidates(page.text, page.url || pageUrl) : []);
  const assetResults = [];

  for (const assetUrl of assets.slice(0, 20)) {
    const asset = await fetchWithTimeout(assetUrl);
    assetResults.push({
      url: assetUrl,
      ok: asset.ok,
      status: asset.status,
      contentType: asset.contentType,
      error: asset.error || ''
    });
    if (asset.ok && /javascript|text|json/i.test(asset.contentType)) {
      extractApiCandidates(asset.text, asset.url || assetUrl).forEach((item) => apiCandidates.add(item));
    }
  }

  const candidates = [...apiCandidates].slice(0, 80);
  const probes = [];
  for (const candidate of candidates.slice(0, 30)) {
    const probe = await fetchWithTimeout(candidate, { method: 'OPTIONS' }, 8000);
    probes.push({
      url: candidate,
      ok: probe.ok,
      status: probe.status,
      contentType: probe.contentType,
      error: probe.error || ''
    });
  }

  res.json({
    page: {
      url: pageUrl,
      finalUrl: page.url,
      ok: page.ok,
      status: page.status,
      contentType: page.contentType,
      error: page.error || ''
    },
    assets: assetResults,
    candidates,
    probes,
    note: page.ok
      ? '仅执行静态资源读取和 OPTIONS 探测，未提交业务写操作。'
      : '页面入口当前不可达，请先确认内网/VPN/代理/token。'
  });
});

app.post('/api/quick-questions', (req, res) => {
  const item = {
    id: makeId('qq'),
    title: req.body.title,
    identity: req.body.identity || '供应商',
    sort: Number(req.body.sort || quickQuestions.length + 1),
    enabled: req.body.enabled !== false,
    agent: req.body.agent || 'agent-knowledge'
  };
  quickQuestions.push(item);
  res.status(201).json(item);
});

app.patch('/api/quick-questions/:id', (req, res) => {
  const item = quickQuestions.find((question) => question.id === req.params.id);
  if (!item) {
    res.status(404).json({ error: 'Quick question not found' });
    return;
  }
  Object.assign(item, req.body);
  res.json(item);
});

app.post('/api/chat/start', (req, res) => {
  const session = {
    id: makeId('session'),
    userId: req.body.userId || 'demo-user',
    identity: req.body.identity || '供应商',
    messages: [],
    difyConversations: {},
    createdAt: now(),
    updatedAt: now()
  };
  sessions.set(session.id, session);
  res.status(201).json(session);
});

app.post('/api/chat/message', async (req, res) => {
  const { sessionId, text, identity = '供应商', files = [], inputMode = 'text', translation = {} } = req.body;
  const normalizedInputMode = normalizeInputMode(inputMode);
  const normalizedTranslation = normalizeTranslation(translation);
  const requiresVisionInput = isVisionRequest(text) || normalizedInputMode === 'multimodal';
  if (!text || typeof text !== 'string') {
    res.status(400).json({ error: 'Message text is required' });
    return;
  }
  const uploadedFiles = Array.isArray(files) ? files : [];
  const unsupportedFiles = uploadedFiles.filter((item) => !item?.difyFileId && Boolean(item?.originalName));
  const hasImageAttachment = uploadedFiles.some((item) => isImageMime(item?.mime));
  const userMessage = {
    id: makeId('msg'),
    role: 'user',
    text,
    files: uploadedFiles,
    createdAt: now()
  };
  let session = sessions.get(sessionId);
  if (!session) {
    session = {
      id: makeId('session'),
      userId: 'demo-user',
      identity,
      messages: [],
      difyConversations: {},
      createdAt: now(),
      updatedAt: now()
    };
    sessions.set(session.id, session);
  }

  const workflowTrace = buildAgent4Workflow({
    text,
    identity,
    inputMode: normalizedInputMode,
    files: uploadedFiles,
    translation: normalizedTranslation,
    translationNormalized: normalizedTranslation,
    difyEnabled: hasAnyDifyRuntime()
  });
  const isConfirmRequest = workflowConfig.confirmKeywords.test(safeText(text).toLowerCase());
  const lastNeedConfirm = [...session.messages].reverse().find(
    (message) =>
      message.role === 'assistant' &&
      message?.agentTrace?.agent4_security?.requires_confirmation &&
      message?.agentTrace?.trace_id
  );
  const canConsumeTaskConfirm =
    isConfirmRequest &&
    session.workflowPending &&
    session.workflowPending.route === 'task' &&
    lastNeedConfirm?.agentTrace?.trace_id &&
    session.workflowPending.trace_id === lastNeedConfirm.agentTrace.trace_id;
  const pushWorkflowAudit = (trace) => {
    workflowAudits.push({
      trace_id: trace.trace_id,
      sessionId: session.id,
      identity,
      text,
      createdAt: trace.created_at,
      status: trace.status,
      requiresConfirmation: trace.agent4_security.requires_confirmation,
      intent: trace.agent2_intent.category,
      riskLevel: trace.agent4_security.risk_level,
      confirmationTemplate: trace.agent4_security.confirmation_template
    });
    if (workflowAudits.length > 2000) {
      workflowAudits.shift();
    }
  };
  const buildConfirmMessage = (trace, execution = {}, reasonText = '') => {
    const routeName = execution.route || 'unknown';
    const resultHint = execution.result?.reply || '';
    const reasons = mergeWorkflowReasons(trace.agent4_security.reasons || [], reasonText, execution.reason);
    const template = trace.agent4_security.confirmation_template;
    return {
      id: makeId('msg'),
      role: 'assistant',
      text:
        `当前请求已进入安全确认流程（分支：${routeName}）。\n\n` +
        (resultHint ? `${resultHint}\n\n` : '') +
        `风险等级：${trace.agent4_security.risk_level}\n` +
        `确认模板：操作对象=${template.action_object}；影响范围=${template.impact_scope}；是否可回滚=${template.rollback_possible}\n\n` +
        `原因：${reasons.length ? reasons.join('；') : trace.resolution?.fallback || '未提供明确原因'}\n\n` +
        `请回复“确认执行”以继续。`,
      category: execution.route === 'task' ? '任务执行确认' : '高风险控制',
      priority: trace.agent4_security.risk_level === 'high' ? 'P0' : 'P1',
      agent: agents[0],
      citations: [
        {
          label: '处理链路',
          value: trace.trace_id
        }
      ],
      actions: [],
      source: 'mock',
      agentTrace: trace,
      reasoning: buildReasoningSummary({
        trace,
        source: 'mock',
        files: uploadedFiles,
        result: { priority: 'P1', agent: agents[0] },
        fallbackReason: execution.reason || '执行分支需要用户确认。'
      }),
      createdAt: now()
    };
  };

  if (requiresVisionInput && workflowTrace.input_summary.requires_visual_payload && !hasImageAttachment) {
    res.status(422).json({
      code: 'MISSING_VISION_INPUT',
      message: '检测到该问题为视觉理解场景，请先上传图片、截图或相关文件后再提问。'
    });
    return;
  }

  if (canConsumeTaskConfirm) {
    session.messages.push(userMessage);
    const pending = session.workflowPending;
    const pendingTrace = pending?.trace || workflowTrace;
    const execution = await runWorkflowTaskNode({
      text: pending?.text || text,
      trace: pendingTrace,
      identity,
      files: uploadedFiles,
      session,
      confirmTurn: true,
      consumePendingTraceId: pending.trace_id
    });
    const finalTrace = {
      ...pendingTrace,
      status: execution.requiresConfirmation ? 'blocked' : 'approved',
      agent4_security: {
        ...pendingTrace.agent4_security,
        requires_confirmation: execution.requiresConfirmation,
        reasons: execution.reason
          ? mergeWorkflowReasons(pendingTrace.agent4_security.reasons || [], execution.reason)
          : pendingTrace.agent4_security.reasons
      }
    };
    if (execution.tracePath) {
      finalTrace.execution_path = execution.tracePath;
    }
    pushWorkflowAudit(finalTrace);
    if (execution.requiresConfirmation) {
      const confirmMessage = buildConfirmMessage(finalTrace, execution, execution.reason);
      session.messages.push(confirmMessage);
      session.updatedAt = now();
      res.json({
        sessionId: session.id,
        message: confirmMessage,
        pendingTicket: false
      });
      return;
    }
    const result = execution.result;
    const source = execution.source || 'mock';
    const assistantMessage = {
      id: makeId('msg'),
      role: 'assistant',
      text: result.reply || '任务已执行。',
      category: result.category,
      priority: result.priority,
      agent: result.agent,
      citations: result.citations,
      actions: result.actions,
      agentTrace: finalTrace,
      reasoning: buildReasoningSummary({
        trace: finalTrace,
        source,
        files: uploadedFiles,
        result,
        fallbackReason: ''
      }),
      source,
      createdAt: now()
    };
    session.messages.push(assistantMessage);
    session.updatedAt = now();
    res.json({
      sessionId: session.id,
      message: assistantMessage,
      pendingTicket: result.priority === 'P0'
    });
    return;
  }

  if (workflowTrace.agent4_security.requires_confirmation) {
    const confirmMessage = buildConfirmMessage(workflowTrace);
    const finalTrace = {
      ...workflowTrace,
      status: 'blocked'
    };
    pushWorkflowAudit(finalTrace);
    session.messages.push(confirmMessage);
    session.updatedAt = now();
    res.json({
      sessionId: session.id,
      message: confirmMessage,
      pendingTicket: false
    });
    return;
  }

  if (!workflowTrace.agent3_execution.whitelist_ok) {
    const blockedMessage = {
      id: makeId('msg'),
      role: 'assistant',
      text: `执行动作不在白名单内，已阻断：${workflowTrace.agent3_execution.plan.map((item) => item.action).join('、')}。请使用可用能力路径重试。`,
      category: '安全拦截',
      priority: 'P2',
      agent: agents[0],
      citations: [
        {
          label: '处理链路',
          value: workflowTrace.trace_id
        }
      ],
      actions: [],
      source: 'mock',
      agentTrace: workflowTrace,
      reasoning: buildReasoningSummary({
        trace: workflowTrace,
        source: 'mock',
        files: uploadedFiles,
        result: { priority: 'P2', agent: agents[0] },
        fallbackReason: '执行动作未进入白名单。'
      }),
      createdAt: now()
    };
    const finalTrace = {
      ...workflowTrace,
      status: 'blocked'
    };
    pushWorkflowAudit(finalTrace);
    session.messages.push(blockedMessage);
    session.updatedAt = now();
    res.status(403).json({
      sessionId: session.id,
      message: blockedMessage,
      pendingTicket: false
    });
    return;
  }

  session.messages.push(userMessage);
  pushWorkflowAudit(workflowTrace);

  try {
    const execution = await runWorkflowOrchestrator({
      text,
      identity,
      files: uploadedFiles,
      inputMode: normalizedInputMode,
      session,
      translation: normalizedTranslation,
      trace: workflowTrace
    });
    if (!execution || !execution.result) {
      throw new Error('工作流执行分支未返回结果');
    }
    if (execution.requiresConfirmation) {
      const finalTrace = {
        ...workflowTrace,
        status: 'blocked',
        execution_path: execution.tracePath || workflowTrace.execution_path || [],
      agent4_security: {
        ...workflowTrace.agent4_security,
        requires_confirmation: true,
        reasons: execution.reason
          ? mergeWorkflowReasons(workflowTrace.agent4_security.reasons || [], execution.reason)
          : workflowTrace.agent4_security.reasons
      }
    };
      pushWorkflowAudit(finalTrace);
      const confirmMessage = buildConfirmMessage(finalTrace, execution, execution.reason);
      session.messages.push(confirmMessage);
      session.updatedAt = now();
      res.json({
        sessionId: session.id,
        message: confirmMessage,
        pendingTicket: false
      });
      return;
    }

    const result = execution.result;
    const source = execution.source || 'mock';
    const finalTrace = {
      ...workflowTrace,
      status: 'approved',
      execution_path: execution.tracePath || workflowTrace.execution_path || [],
      agent3_execution: {
        ...workflowTrace.agent3_execution,
        can_execute: true
      }
    };
    const assistantMessage = {
      id: makeId('msg'),
      role: 'assistant',
      text:
        unsupportedFiles.length > 0 && source !== 'mock'
          ? `${result.reply}\n\n说明：检测到 ${unsupportedFiles.length} 个附件暂未进入模型识别，已先按文本上下文和附件信息处理。`
          : result.reply,
      category: result.category,
      priority: result.priority,
      agent: result.agent,
      citations: result.citations,
      actions: result.actions,
      agentTrace: finalTrace,
      reasoning: buildReasoningSummary({
        trace: finalTrace,
        source,
        files: uploadedFiles,
        result,
        fallbackReason: ''
      }),
      source,
      createdAt: now()
    };
    session.messages.push(assistantMessage);
    session.updatedAt = now();
    res.json({
      sessionId: session.id,
      message: assistantMessage,
      pendingTicket: result.priority === 'P0'
    });
  } catch (error) {
    console.warn('[workflow:fallback]', error.message);
    if (
      hasImageAttachment &&
      shouldRequireDirectMultimodal() &&
      isDirectMultimodalUnavailableError(error.message) &&
      !shouldUseLocalOcr()
    ) {
      const fallbackMessage = sanitizeExternalError(error.message).replace(/^DIFY_MULTIMODAL_UNAVAILABLE:\s*/, '');
      const assistantMessage = {
        id: makeId('msg'),
        role: 'assistant',
        text:
          `图片已上传，但当前多模态 AI 还没有接通，暂时不能直接查看图片内容。\n\n`
          + `需要处理：\n`
          + `1. 在 Dify 中为接收图片的 Chat/Workflow 配置支持视觉的模型；\n`
          + `2. 确认该模型供应商的 API Key 有效；\n`
          + `3. 图片提问会通过 Dify files 传入模型，不再默认走 OCR。`,
        category: '附件图片文件识别',
        priority: 'P1',
        agent: {
          id: 'dify-multimodal',
          name: 'Dify 多模态识别',
          owner: 'Dify files',
          status: 'offline',
          duty: '图片原文件识别',
          api: '/chat-messages files'
        },
        citations: [
          {
            label: '处理方式',
            value: 'Dify files 多模态直传'
          }
        ],
        actions: buildSupportActions(),
        agentTrace: workflowTrace,
        reasoning: buildReasoningSummary({
          trace: workflowTrace,
          source: 'fallback',
          files: uploadedFiles,
          result: { priority: 'P1', agent: { owner: 'Dify files' } },
          fallbackReason: `多模态模型凭证或视觉能力未接通，已停止使用 OCR 兜底。${fallbackMessage ? `原因：${fallbackMessage}` : ''}`
        }),
        source: 'fallback',
        createdAt: now()
      };
      session.messages.push(assistantMessage);
      session.updatedAt = now();
      const fallbackTrace = {
        ...workflowTrace,
        status: 'blocked'
      };
      pushWorkflowAudit(fallbackTrace);
      res.json({
        sessionId: session.id,
        message: assistantMessage,
        pendingTicket: false
      });
      return;
    }
    const attachmentHint =
      unsupportedFiles.length > 0
        ? `\n\n说明：已收到 ${unsupportedFiles.length} 个附件。当前会先按文本上下文和附件信息处理，后续可接入模型识别获取更精确结果。`
        : '';
    let fallback = null;
    let source = 'fallback';
    try {
      fallback = await callDeepSeek({
        query: text,
        identity,
        files: uploadedFiles,
        inputMode: normalizedInputMode
      });
      source = 'deepseek';
    } catch (deepSeekError) {
      console.warn('[deepseek:fallback]', sanitizeExternalError(deepSeekError.message));
    }
    if (!fallback) {
      fallback = mockReply(text, identity, files, { inputMode: normalizedInputMode, translation: normalizedTranslation });
    }
    const fallbackTrace = {
      ...workflowTrace,
      status: source === 'mock' ? 'approved' : 'approved'
    };
    pushWorkflowAudit(fallbackTrace);
    const assistantMessage = {
      id: makeId('msg'),
      role: 'assistant',
      text: `${fallback.reply}${attachmentHint}`,
      category: fallback.category,
      priority: fallback.priority,
      agent: fallback.agent,
      citations: fallback.citations,
      actions: fallback.actions,
      agentTrace: fallbackTrace,
      reasoning: buildReasoningSummary({
        trace: fallbackTrace,
        source,
        files: uploadedFiles,
        result: fallback,
        fallbackReason: sanitizeExternalError(error.message)
      }),
      source,
      createdAt: now()
    };
    session.messages.push(assistantMessage);
    session.updatedAt = now();
    res.json({
      sessionId: session.id,
      message: assistantMessage,
      pendingTicket: fallback.priority === 'P0'
    });
  }
});

function buildUploadExtractedText(reqFile, primaryFileId, ocrText = '') {
  if (isImageMime(reqFile.mimetype)) {
    if (shouldUseLocalOcr() && ocrText) {
      return `图片已上传，多模态优先；本地 OCR 兜底已识别到以下文字：\n${ocrText}`;
    }
    return primaryFileId ? '图片已上传，将直接提交给多模态 AI 识别。' : '图片已上传，本地已接收；当前未拿到 Dify 文件 ID。';
  }
  return primaryFileId ? '文档已上传，可用于文件内容分析。' : '文档已上传，本地已接收；当前可先按文件名称和问题描述辅助处理。';
}

app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'File is required' });
    return;
  }

  const userId = 'user';
  const [difySettled, ocrSettled] = await Promise.allSettled([
    uploadFileToDifyAgents(req.file, userId),
    shouldUseLocalOcr() ? extractImageTextWithLocalOcr(req.file) : Promise.resolve('')
  ]);
  const difyResult =
    difySettled.status === 'fulfilled'
      ? difySettled.value
      : {
          primaryFileId: null,
          fileIdsByAgent: {},
          uploadErrors: [sanitizeExternalError(difySettled.reason?.message || 'Dify 文件上传失败')]
        };
  const ocrText = shouldUseLocalOcr() && ocrSettled.status === 'fulfilled' ? ocrSettled.value : '';
  const responseFile = {
    id: makeId('file'),
    originalName: normalizeUploadFileName(req.file.originalname),
    name: req.file.filename,
    mime: req.file.mimetype,
    size: req.file.size,
    url: `/uploads/${req.file.filename}`,
    extractedText: buildUploadExtractedText(req.file, difyResult.primaryFileId, ocrText),
    ocrText,
    analysisMode: isImageMime(req.file.mimetype) ? 'multimodal-direct' : 'file',
    difyFileId: difyResult.primaryFileId,
    difyFileIds: difyResult.fileIdsByAgent,
    difyUploadErrors: difyResult.uploadErrors
  };
  res.status(201).json(responseFile);
});

app.get('/api/tickets', (_req, res) => {
  res.json(tickets);
});

app.post('/api/tickets', async (req, res) => {
  const intent = classifyIntent(req.body.title || req.body.summary || '');
  const staff = pickStaff(intent.category);
  const ticket = {
    id: `TK-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${String(tickets.length + 1).padStart(3, '0')}`,
    title: req.body.title || '用户请求转人工',
    userName: req.body.userName || '演示用户',
    phone: req.body.phone || '138****0000',
    identity: req.body.identity || '供应商',
    channel: req.body.channel || '共创',
    priority: req.body.priority || intent.priority,
    category: req.body.category || intent.category,
    status: '待处理',
    currentStaffId: staff.id,
    currentStaff: staff.name,
    rating: '-',
    serviceStartedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    feishuStatus: '待通知',
    read: false,
    summary: req.body.summary || 'AI 助手转人工生成工单，已保留当前对话上下文。',
    createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    updatedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    transferLogs: []
  };
  tickets = [ticket, ...tickets];
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
          text: '您好，已收到您的问题，我会结合 AI 助手上下文继续处理。',
          createdAt: ticket.serviceStartedAt
        }
      ]
    },
    ...conversationHistories
  ].slice(0, 20);
  const notice = await notifyFeishu(ticket, '新工单生成');
  ticket.feishuStatus = notice.ok ? '已通知' : '通知失败';
  res.status(201).json(ticket);
});

app.patch('/api/tickets/:id', (req, res) => {
  const ticket = tickets.find((item) => item.id === req.params.id);
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }
  Object.assign(ticket, req.body, {
    updatedAt: new Date().toLocaleString('zh-CN', { hour12: false })
  });
  res.json(ticket);
});

app.post('/api/tickets/:id/messages', async (req, res) => {
  const ticket = tickets.find((item) => item.id === req.params.id);
  const text = safeText(req.body.text);
  if (!ticket) {
    res.status(404).json({ message: '工单不存在。' });
    return;
  }
  if (!text) {
    res.status(400).json({ message: '消息内容不能为空。' });
    return;
  }

  const now = new Date().toLocaleString('zh-CN', { hour12: false });
  ticket.status = '处理中';
  ticket.read = true;
  ticket.updatedAt = now;

  const userMessage = {
    id: makeId('history-msg'),
    role: 'user',
    sender: ticket.userName || '用户',
    text,
    createdAt: now
  };
  const staffMessage = {
    id: makeId('ticket-msg'),
    role: 'staff',
    sender: ticket.currentStaff,
    text: `已收到，我会基于工单 ${ticket.id} 继续处理。${text.length > 36 ? `你补充的问题是：${text.slice(0, 36)}...` : `你补充的问题是：${text}`}`,
    createdAt: now
  };

  let history = conversationHistories.find((item) => item.ticketId === ticket.id);
  if (!history) {
    history = {
      id: `history-${ticket.id}`,
      title: `转人工：${ticket.title}`,
      type: 'service',
      identity: ticket.identity,
      channel: ticket.channel,
      status: ticket.status,
      staffName: ticket.currentStaff,
      ticketId: ticket.id,
      updatedAt: now,
      messages: []
    };
  }
  history.status = ticket.status;
  history.staffName = ticket.currentStaff;
  history.updatedAt = now;
  history.messages = [...history.messages, userMessage, staffMessage];
  conversationHistories = [
    history,
    ...conversationHistories.filter((item) => item.id !== history.id)
  ].slice(0, 20);

  const notice = await notifyFeishu(ticket, '用户追加人工消息');
  ticket.feishuStatus = notice.ok ? '已通知' : '通知失败';
  res.json({ ticket, message: staffMessage });
});

app.post('/api/tickets/:id/transfer', async (req, res) => {
  if (req.body.actorRole !== 'support') {
    res.status(403).json({ message: '仅客服人员可转派工单。' });
    return;
  }

  const ticket = tickets.find((item) => item.id === req.params.id);
  const staff = supportStaff.find((item) => item.id === req.body.staffId);
  if (!ticket || !staff) {
    res.status(404).json({ message: '工单或目标客服不存在。' });
    return;
  }
  ticket.transferLogs.push({
    from: ticket.currentStaff,
    to: staff.name,
    reason: req.body.reason || '客服主动转派',
    at: new Date().toLocaleString('zh-CN', { hour12: false })
  });
  ticket.currentStaffId = staff.id;
  ticket.currentStaff = staff.name;
  ticket.status = '已转派';
  ticket.updatedAt = new Date().toLocaleString('zh-CN', { hour12: false });
  const notice = await notifyFeishu(ticket, '工单转派');
  ticket.feishuStatus = notice.ok ? '已通知' : '通知失败';
  res.json(ticket);
});

app.get('/api/agents', (_req, res) => {
  res.json({ agents, supportStaff });
});

app.post('/api/feishu/notify', async (req, res) => {
  const ticket = tickets.find((item) => item.id === req.body.ticketId) || tickets[0];
  const notice = await notifyFeishu(ticket, req.body.reason || '手动通知');
  res.json(notice);
});

app.listen(port, () => {
  console.log(`AI assistant API listening on http://localhost:${port}`);
});
