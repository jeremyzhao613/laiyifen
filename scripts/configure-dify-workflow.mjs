import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const appId = process.env.DIFY_TARGET_APP_ID || 'fe5dac19-eff4-411c-867c-af86d00c5932';
const dbContainer = process.env.DIFY_DB_CONTAINER || 'docker-db_postgres-1';
const dbUser = process.env.DIFY_DB_USER || 'postgres';
const dbName = process.env.DIFY_DB_NAME || 'dify';
const backupDir = path.resolve('dify-backups');
const modelProfile = (process.env.DIFY_MODEL_PROFILE || 'qwen').toLowerCase();
const qwenProvider = process.env.DIFY_QWEN_PROVIDER || 'langgenius/tongyi/tongyi';
const qwenTextModel = process.env.DIFY_QWEN_TEXT_MODEL || 'qwen3.5-flash';
const qwenVisionModel = process.env.DIFY_QWEN_VISION_MODEL || 'qwen-vl-plus';
const qwenClassifierModel = process.env.DIFY_QWEN_CLASSIFIER_MODEL || qwenTextModel;
const deepseekProvider = process.env.DIFY_DEEPSEEK_PROVIDER || 'langgenius/deepseek/deepseek';
const deepseekTextModel = process.env.DIFY_DEEPSEEK_TEXT_MODEL || 'deepseek-v4-flash';
const shouldUseDeepSeekText = modelProfile === 'deepseek' || modelProfile === 'hybrid';
const shouldUseQwenVision = modelProfile !== 'deepseek';

function psql(sql) {
  return execFileSync(
    'docker',
    ['exec', '-i', dbContainer, 'psql', '-U', dbUser, '-d', dbName, '-t', '-A', '-v', 'ON_ERROR_STOP=1'],
    {
      input: sql,
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024
    }
  ).trim();
}

function quoteSql(value) {
  return String(value).replaceAll("'", "''");
}

function readDraftGraph() {
  const raw = psql(`select graph from workflows where app_id='${quoteSql(appId)}' and version='draft';`);
  if (!raw) {
    throw new Error(`Draft workflow not found for app ${appId}`);
  }
  return JSON.parse(raw);
}

function basePrompt() {
  return [
    '你是来伊份共创平台 AI 客服助手“小伊”。',
    '回答必须使用中文，语气专业、简洁、客服式。',
    '先给结论，再给操作步骤或需要补充的信息。',
    '不要编造后台状态、审核结果、付款结果、手机号、合同号、门店信息、订单信息或接口返回。',
    '涉及真实业务数据、状态、审批、导出或提交动作时，必须说明需要通过后端权限校验或转人工核验。',
    '人工客服服务时间为周一至周五 09:00-18:00。',
    '转人工后不跳转页面，人工客服后台回复会回到当前对话。',
    '工单转派只能由客服后台操作，用户端不提供转派入口。',
    '不要使用 emoji，不要输出 Markdown 表格。'
  ].join('\n');
}

function userPrompt() {
  return [
    '以下是用户的完整输入信息：',
    '联系人姓名：{{#1775752030903.customer_name#}}',
    '问题：{{#1775752030903.customer_issue#}}',
    '系统初判问题类型：{{#1775752030903.issue_type#}}',
    '客户类型：{{#1775752030903.customer_identity#}}',
    '联系人电话：{{#1775752030903.contact_phone#}}',
    '订单/合同/工单编号：{{#1775752030903.case_reference#}}',
    '紧急程度：{{#1775752030903.urgency_level#}}',
    '当前渠道：{{#1775752030903.channel#}}',
    '当前页面编码：{{#1775752030903.page_code#}}',
    '当前页面上下文：{{#1775752030903.page_context#}}',
    '输入模式：{{#1775752030903.input_mode#}}',
    '',
    '请基于上述信息回答。'
  ].join('\n');
}

function makeModelConfig(provider, name, completionParams = {}) {
  return {
    mode: 'chat',
    name,
    provider,
    completion_params: {
      temperature: 0.2,
      max_tokens: 1024,
      top_p: 0.8,
      ...completionParams
    }
  };
}

function getTextModelConfig(completionParams = {}) {
  return shouldUseDeepSeekText
    ? makeModelConfig(deepseekProvider, deepseekTextModel, completionParams)
    : makeModelConfig(qwenProvider, qwenTextModel, completionParams);
}

function getClassifierModelConfig(completionParams = {}) {
  const provider = shouldUseDeepSeekText ? deepseekProvider : qwenProvider;
  const name = shouldUseDeepSeekText ? deepseekTextModel : qwenClassifierModel;
  return {
    mode: 'chat',
    name,
    provider,
    completion_params: {
      temperature: 0,
      ...completionParams
    }
  };
}

function getVisionModelConfig(completionParams = {}) {
  return shouldUseQwenVision
    ? makeModelConfig(qwenProvider, qwenVisionModel, completionParams)
    : makeModelConfig(deepseekProvider, deepseekTextModel, completionParams);
}

function makeLlmNode(template, id, title, desc, systemPrompt, x, y, visionEnabled = false) {
  const node = JSON.parse(JSON.stringify(template));
  node.id = id;
  node.data.title = title;
  node.data.desc = desc;
  node.data.selected = false;
  node.data.vision = visionEnabled
    ? {
        enabled: true,
        configs: {
          variable_selector: ['1775752030903', 'customer_file'],
          detail: 'high'
        }
      }
    : { enabled: false };
  node.data.model = visionEnabled ? getVisionModelConfig() : getTextModelConfig();
  node.data.prompt_template = [
    {
      id: crypto.randomUUID(),
      role: 'system',
      text: `${basePrompt()}\n\n${systemPrompt}`
    },
    {
      id: crypto.randomUUID(),
      role: 'user',
      text: userPrompt()
    }
  ];
  node.position = { x, y };
  node.positionAbsolute = { x, y };
  node.width = 260;
  node.height = visionEnabled ? 150 : 130;
  return node;
}

function makeEdge(source, sourceType, sourceHandle, target, targetType) {
  return {
    id: `${source}-${sourceHandle}-${target}-target`,
    data: {
      isInLoop: false,
      sourceType,
      targetType,
      isInIteration: false
    },
    type: 'custom',
    source,
    target,
    zIndex: 0,
    selected: false,
    sourceHandle,
    targetHandle: 'target'
  };
}

function configureGraph(graph) {
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const start = nodesById.get('1775752030903');
  const classifier = nodesById.get('1775752097077');
  const llmTemplate =
    nodesById.get('1775753301122') ||
    graph.nodes.find((node) => node.data?.type === 'llm');
  const end = nodesById.get('1775752183779');

  if (!start || !classifier || !llmTemplate || !end) {
    throw new Error('Required base nodes are missing from the workflow graph');
  }

  const issueOptions = [
    '账号权限与登录',
    '菜单定位与操作引导',
    '供应商入驻',
    '合同授权与结算',
    '加盟商商机与门店运营',
    '经销商业务问题',
    '工单与人工客服',
    '附件图片文件识别',
    '系统异常与缺陷',
    '其他问题'
  ];

  start.data.title = '客户请求';
  start.data.desc = '共创平台 Web、APP、小程序或飞书侧发起的 AI 助手请求。';
  start.data.variables = [
    {
      hint: '用于回访与核验用户信息',
      type: 'text-input',
      label: '联系人姓名',
      default: '',
      options: [],
      required: false,
      variable: 'customer_name',
      placeholder: '如：王小明'
    },
    {
      hint: '请尽量包含现象、影响范围、页面位置与期望动作',
      type: 'paragraph',
      label: '问题详情（必填）',
      default: '',
      options: [],
      required: true,
      variable: 'customer_issue',
      placeholder: '例如：供应商入驻后找不到合同授权入口'
    },
    {
      hint: '后端初判分类，仅作为辅助参考，分类器仍以问题内容为准',
      type: 'select',
      label: '问题类型',
      default: '',
      options: issueOptions,
      required: false,
      variable: 'issue_type',
      placeholder: '请选择'
    },
    {
      hint: '用于角色化回答与权限判断',
      type: 'select',
      label: '客户类型',
      default: '未选择',
      options: ['未选择', '员工', '加盟商', '供应商', '经销商', '消费者', '其他'],
      required: false,
      variable: 'customer_identity',
      placeholder: '请选择'
    },
    {
      hint: '便于人工客服回访核实（可选）',
      type: 'text-input',
      label: '联系人电话',
      default: '',
      options: [],
      required: false,
      variable: 'contact_phone',
      placeholder: '例如：138****8888'
    },
    {
      hint: '有订单、合同、工单编号可加快核验（可选）',
      type: 'text-input',
      label: '订单/合同/工单编号（可选）',
      default: '',
      options: [],
      required: false,
      variable: 'case_reference',
      placeholder: '如有请填写'
    },
    {
      hint: '如问题紧急，请先说明（未提供可留空）',
      type: 'select',
      label: '紧急程度',
      default: '未选择',
      options: ['未选择', '高', '中', '低'],
      required: false,
      variable: 'urgency_level',
      placeholder: '请选择'
    },
    {
      hint: '共创Web、飞书、APP、小程序等',
      type: 'select',
      label: '渠道',
      default: '共创Web',
      options: ['共创Web', '飞书', 'APP', '小程序', '后台测试'],
      required: false,
      variable: 'channel',
      placeholder: '请选择'
    },
    {
      hint: '当前页面或菜单编码，用于菜单定位',
      type: 'text-input',
      label: '页面编码',
      default: '',
      options: [],
      required: false,
      variable: 'page_code',
      placeholder: '如：home、contract'
    },
    {
      hint: '当前页面状态、已选对象、表单上下文',
      type: 'paragraph',
      label: '页面上下文',
      default: '',
      options: [],
      required: false,
      variable: 'page_context',
      placeholder: '可由前端自动传入'
    },
    {
      hint: 'text / multimodal / voice',
      type: 'select',
      label: '输入模式',
      default: 'text',
      options: ['text', 'multimodal', 'voice'],
      required: false,
      variable: 'input_mode',
      placeholder: '请选择'
    },
    {
      hint: '图片、PDF、Excel、Word、音频、视频等附件。图片应交给多模态模型直接理解，不使用 OCR 伪装为识别结果。',
      type: 'file',
      label: '上传图片/文件',
      default: null,
      options: [],
      required: false,
      variable: 'customer_file',
      allowed_file_types: ['document', 'image', 'audio', 'video'],
      allowed_file_extensions: [],
      allowed_file_upload_methods: ['local_file', 'remote_url']
    }
  ];

  classifier.data.title = '总入口问题分类器';
  classifier.data.desc = '根据用户身份、问题文本、页面上下文和附件状态，将请求路由到对应能力分支。';
  classifier.data.model = getClassifierModelConfig();
  classifier.data.query_variable_selector = ['1775752030903', 'customer_issue'];
  classifier.data.classes = [
    { id: '1', name: '政策规则知识问答：公司政策、合作规则、活动规则、权限说明、FAQ、操作手册。' },
    { id: '2', name: '菜单定位与操作引导：功能入口、下一步操作、页面跳转、待办入口、合同入口、报名入口。' },
    { id: '3', name: '数据查询与分析：经营数据、订单、库存、叫货、对账、分润、费用、销售、指标异常。' },
    { id: '4', name: '任务执行与表单办理：表单填写、流程办理、进度追踪、导出、预约、报名、提交。' },
    { id: '5', name: '附件多模态识别：最高优先级；只要有上传附件、图片、截图、文件、PDF、Excel、Word、视频、线下表单、合同、票据、看图请求，必须选择本类。' },
    { id: '6', name: '工单与人工客服：转人工、工单状态、评价服务、客服回复、飞书通知、服务时间。' },
    { id: '7', name: '主动服务与节点提醒：今日待办、商机提醒、入驻后通知、合同订单结算节点、指标预警。' },
    { id: '8', name: '系统异常与缺陷：页面加载失败、系统卡死、按钮不可用、AI回答异常、接口错误、功能缺陷。' },
    { id: '9', name: '其他问题：无法归入以上分类、信息不足、闲聊或超出业务范围，需要兜底追问。' }
  ];
  classifier.data.instruction = [
    '只选择一个最匹配分类，不要输出解释。',
    '最高优先级：只要问题包含“已上传附件上下文”、Dify 文件、图片、截图、文件、PDF、Excel、视频、“看这张图”、“帮我看图”、input_mode=multimodal，必须选择“附件多模态识别”。',
    '有附件的问题即使同时询问入口、下一步、菜单、合同、待办，也必须先选择“附件多模态识别”，不要选择“菜单定位与操作引导”。',
    '优先根据 customer_issue 判断，issue_type 仅作辅助参考。',
    '涉及入口、在哪里、下一步、怎么操作、跳转、待办、合同授权入口，选择“菜单定位与操作引导”。',
    '涉及真实数据、状态、订单、库存、对账、分润、费用、指标，选择“数据查询与分析”。',
    '涉及提交、办理、导出、预约、报名、填表、审批，选择“任务执行与表单办理”。',
    '涉及图片、截图、文件、PDF、Excel、OCR、页面理解、信息提取，选择“附件多模态识别”。',
    '涉及转人工、工单、评价、客服回复、飞书，选择“工单与人工客服”。',
    '涉及每日待办、节点提醒、商机提醒、主动推送、指标预警，选择“主动服务与节点提醒”。',
    '涉及加载失败、卡死、按钮不可用、接口错误或 AI 回答异常，选择“系统异常与缺陷”。',
    '无法判断或信息不足时选择“其他问题”。'
  ].join('\n');
  classifier.data.instructions = classifier.data.instruction;
  classifier.width = 360;
  classifier.height = 820;

  const knowledge = makeLlmNode(
    llmTemplate,
    '202606300301',
    '知识与操作引导 LLM',
    '处理政策规则、系统操作、入口定位、供应商/加盟商/经销商常见流程。',
    [
      '你负责政策规则、FAQ、系统操作和菜单定位。',
      '针对不同身份给出对应路径：员工、加盟商、供应商、经销商。',
      '合同授权、入驻后下一步、今日待办等问题要先给常见入口，再说明如果看不到入口可能是权限或流程未完成。',
      '不能承诺真实状态；涉及状态核验时提示通过今日待办、合同管理或转人工确认。'
    ].join('\n'),
    1120,
    80
  );

  const data = makeLlmNode(
    llmTemplate,
    '202606300302',
    '数据分析 LLM',
    '处理经营数据、订单库存、对账分润、费用收入、指标预警等数据类问题。',
    [
      '你负责数据查询与数据解释类问题。',
      '如果没有后端数据结果，不要编造数字；应说明需要通过数仓/业务系统权限校验后查询。',
      '回答中要明确数据口径、权限边界、建议查询维度和下一步动作。',
      '跨主体、导出、敏感数据必须要求权限校验或用户确认。'
    ].join('\n'),
    1120,
    250
  );

  const task = makeLlmNode(
    llmTemplate,
    '202606300303',
    '任务执行 LLM',
    '处理表单填写、流程办理、菜单跳转、进度追踪、预约报名、导出提交等任务。',
    [
      '你负责任务执行和表单办理。',
      '所有修改、提交、导出、预约、报名、审批、合同签订等动作必须两段式：先预览影响范围，再由用户确认后执行。',
      '缺少字段时先追问，不直接提交。',
      '当前若没有后端执行结果，只能给执行计划和需要补充的信息。'
    ].join('\n'),
    1120,
    420
  );

  const file = makeLlmNode(
    llmTemplate,
    '202606300304',
    '多模态附件 LLM',
    '处理图片、视频、截图、PDF、Excel、合同、票据、线下表单和系统缺陷。',
    [
      '你负责多模态附件和系统异常类问题。',
      '图片、截图和视频应由多模态模型直接理解；不要声称“本地 OCR 已识别”。',
      '当前节点已经绑定 customer_file 作为视觉输入；如果能看到图片，请直接描述图片里的页面结构、按钮位置和关键信息。',
      '若模型运行时没有收到视觉内容，才如实说明“已收到附件，但当前模型未拿到视觉内容”。',
      '对于系统缺陷，要求补充账号、时间、页面、操作路径、截图，并建议生成 P0/P1 工单。'
    ].join('\n'),
    1120,
    590,
    true
  );

  const support = makeLlmNode(
    llmTemplate,
    '202606300305',
    '人工客服工单 LLM',
    '处理转人工、工单创建、客服分配、飞书通知、客服回复和评价服务。',
    [
      '你负责人工客服和工单类问题。',
      '用户要求转人工时，回复“已接入人工服务，当前对话继续，不跳转”。',
      '明确人工客服服务时间：周一至周五 09:00-18:00。',
      '非服务时间提示用户可先提交工单，服务时间内客服会继续回复。',
      '不要在用户端提供“转派客服”入口；转派只能由客服后台操作。'
    ].join('\n'),
    1120,
    780
  );

  const proactive = makeLlmNode(
    llmTemplate,
    '202606300306',
    '主动服务 LLM',
    '处理待办、节点通知、业务进度、商机提醒、指标预警和主动推送。',
    [
      '你负责主动服务类问题。',
      '围绕今日待办、入驻后下一步、商机报名后补充资料、合同订单结算节点、指标预警给出简短提醒和快捷入口建议。',
      '不要编造待办数量或业务状态；真实状态需要后端事件或数据接口返回。'
    ].join('\n'),
    1120,
    960
  );

  const fallback = makeLlmNode(
    llmTemplate,
    '202606300307',
    '兜底追问 LLM',
    '处理无法归类、信息不足或超出业务范围的问题。',
    [
      '你负责兜底追问。',
      '信息不足时先用 1-3 个问题追问关键字段，例如用户身份、页面、问题现象、订单/合同号。',
      '如果明显超出共创平台业务范围，应礼貌说明边界，并引导提交工单或转人工。'
    ].join('\n'),
    1120,
    1140
  );

  end.data.title = '输出';
  end.data.desc = '返回实际执行分支的最终回复。';
  end.data.outputs = [
    { variable: 'knowledge_answer', value_type: 'string', value_selector: [knowledge.id, 'text'] },
    { variable: 'data_answer', value_type: 'string', value_selector: [data.id, 'text'] },
    { variable: 'task_answer', value_type: 'string', value_selector: [task.id, 'text'] },
    { variable: 'file_answer', value_type: 'string', value_selector: [file.id, 'text'] },
    { variable: 'support_answer', value_type: 'string', value_selector: [support.id, 'text'] },
    { variable: 'proactive_answer', value_type: 'string', value_selector: [proactive.id, 'text'] },
    { variable: 'fallback_answer', value_type: 'string', value_selector: [fallback.id, 'text'] }
  ];
  end.position = { x: 1540, y: 520 };
  end.positionAbsolute = { x: 1540, y: 520 };

  const nextNodes = [
    start,
    classifier,
    knowledge,
    data,
    task,
    file,
    support,
    proactive,
    fallback,
    end
  ];

  const llmNodes = [knowledge, data, task, file, support, proactive, fallback];
  const nextEdges = [
    makeEdge(start.id, 'start', 'source', classifier.id, 'question-classifier'),
    makeEdge(classifier.id, 'question-classifier', '1', knowledge.id, 'llm'),
    makeEdge(classifier.id, 'question-classifier', '2', knowledge.id, 'llm'),
    makeEdge(classifier.id, 'question-classifier', '3', data.id, 'llm'),
    makeEdge(classifier.id, 'question-classifier', '4', task.id, 'llm'),
    makeEdge(classifier.id, 'question-classifier', '5', file.id, 'llm'),
    makeEdge(classifier.id, 'question-classifier', '6', support.id, 'llm'),
    makeEdge(classifier.id, 'question-classifier', '7', proactive.id, 'llm'),
    makeEdge(classifier.id, 'question-classifier', '8', file.id, 'llm'),
    makeEdge(classifier.id, 'question-classifier', '9', fallback.id, 'llm'),
    ...llmNodes.map((node) => makeEdge(node.id, 'llm', 'source', end.id, 'end'))
  ];

  return {
    ...graph,
    nodes: nextNodes,
    edges: nextEdges,
    viewport: graph.viewport || { x: 0, y: 0, zoom: 0.7 }
  };
}

function main() {
  fs.mkdirSync(backupDir, { recursive: true });
  const now = new Date();
  const stamp = now
    .toISOString()
    .replaceAll(':', '-')
    .replaceAll('.', '-');

  const current = readDraftGraph();
  const backupPath = path.join(backupDir, `workflow-${appId}-draft-before-2026-route-${stamp}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(current, null, 2));

  const graph = configureGraph(current);
  const graphJson = JSON.stringify(graph);
  const publishId = crypto.randomUUID();
  const version = now.toISOString().replace('T', ' ').replace('Z', '');

  const sql = `
begin;
update workflows
set graph = $dify_graph$${graphJson}$dify_graph$,
    updated_at = now()
where app_id = '${quoteSql(appId)}' and version = 'draft';

insert into workflows (
  id, tenant_id, app_id, type, version, graph, features, created_by, created_at,
  updated_by, updated_at, environment_variables, conversation_variables,
  marked_name, marked_comment, rag_pipeline_variables, kind
)
select
  '${publishId}'::uuid, tenant_id, app_id, type, '${quoteSql(version)}',
  $dify_graph$${graphJson}$dify_graph$, features, created_by, now(),
  updated_by, now(), environment_variables, conversation_variables,
  marked_name, marked_comment, rag_pipeline_variables, kind
from workflows
where app_id = '${quoteSql(appId)}' and version = 'draft';

update apps
set workflow_id = '${publishId}'::uuid,
    updated_at = now()
where id = '${quoteSql(appId)}';
commit;
`;

  psql(sql);
  const outputPath = path.join(backupDir, `workflow-${appId}-published-2026-route-${stamp}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(graph, null, 2));

  console.log(JSON.stringify({
    appId,
    draftUpdated: true,
    publishedWorkflowId: publishId,
    version,
    modelProfile,
    textProvider: shouldUseDeepSeekText ? deepseekProvider : qwenProvider,
    textModel: shouldUseDeepSeekText ? deepseekTextModel : qwenTextModel,
    visionProvider: shouldUseQwenVision ? qwenProvider : deepseekProvider,
    visionModel: shouldUseQwenVision ? qwenVisionModel : deepseekTextModel,
    classifierProvider: shouldUseDeepSeekText ? deepseekProvider : qwenProvider,
    classifierModel: shouldUseDeepSeekText ? deepseekTextModel : qwenClassifierModel,
    backupPath,
    outputPath,
    nodes: graph.nodes.length,
    edges: graph.edges.length
  }, null, 2));
}

main();
