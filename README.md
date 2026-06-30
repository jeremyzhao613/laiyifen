# 来伊份 AI 客服助手 小伊（前后端原型）

这是一个可运行的前后端 MVP，用于先完成页面设计、交互和接口骨架。Dify 调整期间，服务端会自动使用本地 mock 回复；Dify 配好后只需要补环境变量，前端调用路径不变。

## 功能范围

- 右下角 AI Launcher，支持小窗和 PC 展开模式。
- 按用户身份展示快捷提问：员工、加盟商、供应商、经销商。
- AI 聊天、发送中锁定、图片/文件上传、转人工。
- 工单列表：评价、手机号、转人工时间、当前客服、飞书通知、已读状态。
- 工单转派、完成状态更新、飞书通知 mock。
- 快捷问题后台配置：新增、排序、启停、绑定 Agent。
- 多 Agent 编排看板：路由、知识库、业务数据、附件理解、飞书客服。
- 服务端 Dify 适配层：未配置时自动降级 mock。

## 启动

```bash
npm install
npm run dev
```

默认地址：

- 前端：http://localhost:5173
- 后端：http://localhost:8788

### 临时内网穿透（双隧道 + 固定后端 API 地址）

适用于你要把前端发到公网、并强制让前端请求始终走云端后端地址（外网可访问）：

```bash
# 1) 先启动服务
npm run dev:api

# 2) 后端开隧道，记下 https://xxxx.trycloudflare.com
npx cloudflared tunnel --url http://127.0.0.1:8788

# 3) 前端开隧道，并注入 API 基址（可在新终端执行）
VITE_API_BASE_URL=https://xxxx.trycloudflare.com npm run dev:web
# 或先导出：export VITE_API_BASE_URL=https://xxxx.trycloudflare.com
npx cloudflared tunnel --url http://127.0.0.1:5173
```

说明：
- 这里 `VITE_API_BASE_URL` 会让前端所有 `/api/*` 与 `/uploads/*` 请求都直连到云端后端隧道。
- 这是临时隧道（quick tunnel），**每次重启都会变更域名**。你现在这条
  `https://regulated-discussed-translate-javascript.trycloudflare.com/` 失效时，不是项目坏了，而是这个域名过期/下线了，请直接用新域名重试并更新 `VITE_API_BASE_URL`。
- 如果你用的是 `npm run tunnel:front`，本地脚本使用的是 `cloudflared`，你也可以改成 `npx cloudflared` 避免全局未安装报错。

### 临时内网穿透（极速模式，单一隧道）

若你更在意速度，可直接走单一隧道：前端隧道暴露 `5173`，并利用 Vite 反向代理把 `/api/*` `/uploads/*` 转发到本机 `8788`。这样不需要再开后端隧道，少一次公网转发，通常更快、更稳定。

```bash
npm run tunnel:fast
```

命令会并行启动：
- `npm run dev:api`（后端 8788）
- `npm run dev:web`（前端 5173）
- `npm run tunnel:front`（前端隧道）

运行结束后访问终端输出的新隧道 HTTPS 地址即可。

### 长期稳定建议（推荐）

- 如果你需要固定公网地址，建议使用 Cloudflare 预留隧道（Named Tunnel）或直接走 Cloudflare Pages，不要依赖 quick tunnel 的 `*.trycloudflare.com` 临时域名。
- quick tunnel 仅用于临时联调；如你想继续用 tunnel 模式，建议同时使用:
  - 固定二级域名（`--hostname`）
  - 绑定到同一个 Cloudflare 账号中的自有域名

## Cloudflare 部署

### 一键本地发布（需要 API Token）

```bash
export CLOUDFLARE_API_TOKEN=你的Token
export CLOUDFLARE_PAGES_PROJECT=你的Pages项目名   # 例如：dify-assistant
CLOUDFLARE_PAGES_BRANCH=main ./scripts/deploy-cloudflare-pages.sh
# 或
CLOUDFLARE_PAGES_PROJECT=你的Pages项目名 ./scripts/deploy-cloudflare-pages.sh
```

成功后会输出 `https://<项目名>.pages.dev` 或你在 Pages 配置的自定义域。

Pages Functions 版本的 `/api/chat/message` 已支持直接调用 Dify/DeepSeek。未配置 AI Secret 时会自动降级为线上演示 Mock；配置后线上页面会优先调用 Dify，Dify 不可用时按配置降级 DeepSeek/Mock。

注意：Pages Functions 运行在 Cloudflare 云端，`DIFY_API_URL=http://localhost/v1` 只能用于本机 Node 后端调试，线上必须换成公网可访问的 Dify API 地址，例如 Dify Cloud 或你自托管 Dify 的 HTTPS 域名。否则线上会跳过 Dify，改走 DeepSeek/Mock 兜底。

```bash
# Dify Workflow 推荐配置
npx wrangler pages secret put DIFY_API_URL --project-name "$CLOUDFLARE_PAGES_PROJECT"
npx wrangler pages secret put DIFY_API_KEY --project-name "$CLOUDFLARE_PAGES_PROJECT"
npx wrangler pages secret put DIFY_APP_MODE --project-name "$CLOUDFLARE_PAGES_PROJECT"          # workflow
npx wrangler pages secret put DIFY_WORKFLOW_INPUT_KEY --project-name "$CLOUDFLARE_PAGES_PROJECT" # customer_issue
npx wrangler pages secret put DIFY_WORKFLOW_RESPONSE_MODE --project-name "$CLOUDFLARE_PAGES_PROJECT" # blocking 或 streaming

# 可选：Dify 异常时用 DeepSeek 兜底
npx wrangler pages secret put DEEPSEEK_API_KEY --project-name "$CLOUDFLARE_PAGES_PROJECT"
npx wrangler pages secret put DEEPSEEK_MODEL --project-name "$CLOUDFLARE_PAGES_PROJECT"
```

配置完成后重新部署，访问 `/api/health` 可查看当前线上 AI 模式。

### GitHub Action 自动发布（token 自动化）

推送到 `main` 分支后自动构建并部署到 Pages。需要在仓库 Secrets/Variables 中配置：

- `CLOUDFLARE_API_TOKEN`（建议 scope=Edit Cloudflare Workers，支持 Pages）
- `CLOUDFLARE_ACCOUNT_ID`（账户 ID）
- `CLOUDFLARE_PAGES_PROJECT`（Repo Variables，可选）

也可在 Action 中手动 `Run workflow` 触发 `workflow_dispatch`。

## Dify 接入

复制环境变量模板：

```bash
cp .env.example .env
```

当前本地 Dify workflow 页面显示 API Base URL 为 `http://localhost/v1`，应用输入字段为 `customer_issue`。填入：

```bash
DIFY_API_URL=http://localhost/v1
DIFY_API_KEY=你的服务端 Dify Workflow App Key
DIFY_APP_MODE=workflow
DIFY_WORKFLOW_INPUT_KEY=customer_issue
DIFY_WORKFLOW_ISSUE_TYPE_MODE=legacy
DIFY_WORKFLOW_RESPONSE_MODE=streaming
DIFY_WORKFLOW_MAX_RETRIES=3
DIFY_USER_PREFIX=laiyifen
```

当前脚本会优先把 Dify Workflow 节点配置为通义千问：

```bash
DIFY_MODEL_PROFILE=qwen
DIFY_QWEN_PROVIDER=langgenius/tongyi/tongyi
DIFY_QWEN_TEXT_MODEL=qwen3.5-flash
DIFY_QWEN_CLASSIFIER_MODEL=qwen3.5-flash
DIFY_QWEN_VISION_MODEL=qwen-vl-plus
DIFY_DEEPSEEK_PROVIDER=langgenius/deepseek/deepseek
DIFY_DEEPSEEK_TEXT_MODEL=deepseek-v4-flash
```

`DIFY_MODEL_PROFILE` 支持三档：

- `qwen`：分类、文本、多模态全部使用通义千问，要求 Dify 后台通义凭证有效。
- `hybrid`：分类和文本使用 DeepSeek，图片/视频/截图仍使用 Qwen-VL。适合通义视觉凭证待修复、但文本服务需要先可用的阶段。
- `deepseek`：全部使用 DeepSeek，只建议临时排障；图片不会获得真实视觉理解。

服务端默认按你当前的 Dify「智能客服分流助手」Workflow 调用：

```text
POST /workflows/run
inputs.customer_issue = 用户问题
response_mode = blocking
```

如果 Dify workflow 内后续新增文件输入变量，可设置：

```bash
DIFY_WORKFLOW_FILES_INPUT_KEY=customer_file
DIFY_WORKFLOW_FILES_INPUT_MODE=single
```

当前仍会把上传文件通过 Dify `/files/upload` 转成 `upload_file_id`。如果配置了 `DIFY_WORKFLOW_FILES_INPUT_KEY`，会把文件写入该 Workflow 输入变量；默认为单文件变量，若 Dify 使用多文件变量可改为 `DIFY_WORKFLOW_FILES_INPUT_MODE=array`。

如果先只接一个 Dify 应用，只填 `DIFY_API_URL`、`DIFY_API_KEY`、`DIFY_APP_MODE=workflow` 即可。服务端会把所有前端智能体入口落到这个 Workflow，由 Dify 里的“问题分类器”继续分流到技术、账单、其他咨询节点。

如果你在 Dify 里拆了多个智能体/App，可以按需填独立 Key：

```bash
DIFY_ROUTER_API_URL=https://api.dify.ai/v1
DIFY_ROUTER_API_KEY=意图路由Agent的AppKey
DIFY_KNOWLEDGE_API_URL=https://api.dify.ai/v1
DIFY_KNOWLEDGE_API_KEY=知识库Agent的AppKey
DIFY_BUSINESS_API_URL=https://api.dify.ai/v1
DIFY_BUSINESS_API_KEY=业务数据Agent的AppKey
DIFY_FILE_API_URL=https://api.dify.ai/v1
DIFY_FILE_API_KEY=附件理解Agent的AppKey
DIFY_FEISHU_API_URL=https://api.dify.ai/v1
DIFY_FEISHU_API_KEY=飞书客服Agent的AppKey
```

按 `onenov/Dify-for-AiSearch` 思路改造的 Dify 节点表和变量映射见：[docs/aisearch-inspired-dify-assistant.md](docs/aisearch-inspired-dify-assistant.md)。

未单独配置的智能体会自动回退到默认 `DIFY_API_KEY`。如果后续要改回 Dify Chat App，把模式切到：

```bash
DIFY_APP_MODE=chat
```

本机调试时如果还没换成 Workflow App Key，可临时使用：

```bash
DIFY_APP_MODE=auto
```

`auto` 会先尝试 `/workflows/run`，当 Dify 返回应用类型不匹配时再回退到 `/chat-messages`，并把两边的错误合并到后端日志/前端降级提示里。

## Qwen、DeepSeek 与数据集调试

推荐在 Dify 模型供应商中优先配置通义千问，文本分类和普通问答使用 `qwen3.5-flash`，图片/视频/截图识别使用 `qwen-vl-plus` 或 `qwen3-vl-flash`。本项目会把图片作为 Dify 文件变量传入视觉模型，不用本地 OCR 冒充识别。

如果 Dify 模型供应商还没调好，可以先接 DeepSeek 做智能兜底：

```bash
DEEPSEEK_API_URL=https://api.deepseek.com
DEEPSEEK_API_KEY=你的 DeepSeek Key
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_VISION_MODEL=deepseek-v4-flash
DEEPSEEK_ENABLE_IMAGE_URL=false
DIFY_DIRECT_MULTIMODAL=true
DIFY_MULTIMODAL_STRICT=true
ENABLE_LOCAL_OCR=false
```

聊天链路现在是：

1. 文本问题优先调用 Dify Workflow。
2. 图片/截图问题优先调用 Dify Chat 的 `files` 多模态输入，把 `upload_file_id` 直接传给模型。
3. 多模态模型未接通时会明确返回配置提示，不默认用 OCR 冒充识图。
4. 文本兜底调用 DeepSeek `/chat/completions`，DeepSeek 也不可用时回到本地来伊份 FAQ mock。

图片和截图默认不走本机 OCR。当前 DeepSeek 接口不直接接收 `image_url` 消息格式，因此图片识别应通过 Dify 中配置好的视觉模型完成。只有显式设置 `ENABLE_LOCAL_OCR=true` 时，后端才会启用本机 OCR 作为兜底。

数据集只读探测接口使用 Dify Knowledge Base API：

```bash
DIFY_DATASET_API_URL=http://localhost/v1
DIFY_DATASET_API_KEY=你的 Dify Knowledge Base API Key
```

本地调试接口：

- `GET /api/deepseek/runtime`：查看 DeepSeek 是否配置，不返回密钥。
- `POST /api/deepseek/test`：发送一条测试问题验证 DeepSeek。
- `GET /api/datasets/debug?page=1&limit=20`：读取 Dify 数据集列表。

Workflow 调用链路：

1. `POST /api/chat/message` 先生成本地 `agentTrace`
2. 执行本地安全校验、附件检查、转人工确认策略
3. 调用 Dify Workflow 的 `/workflows/run`，插件断流等瞬时错误会按 `DIFY_WORKFLOW_MAX_RETRIES` 重试
4. 传入 `inputs.customer_issue`、用户身份、输入模式和可用附件
5. 读取 Workflow 输出节点返回的 `text`/`answer`/`result`
6. Dify 不可用或模型凭证异常时自动降级 mock；终端用户不展示技术错误，调试细节通过 `/api/dify/workflow/debug` 查看

### 推荐 Dify Workflow 内容

当前页面还是 Dify 示例分类：技术问题、账单问题、其他咨询。建议按来伊份业务改成：

- `账号权限与菜单定位`：登录、账号绑定、角色权限、菜单入口、供应商/加盟商/员工/经销商身份识别。
- `供应商入驻与合同授权`：供应商入驻下一步、资料补充、合同授权入口、SAP 编码、商务/财务/合同联系人。
- `商机报名与加盟运营`：加盟商商机报名、今日待办、门店信息、社区长/美食顾问流程。
- `工单与人工客服`：转人工、客服服务时间、评价服务、工单状态、客服回复、转派仅客服可操作。
- `附件与多模态识别`：图片、PDF、Excel、截图识别，优先把原文件交给多模态模型识别，再做业务判断。

输出节点建议统一输出一个 `text` 字段，内容格式保持：

```text
结论：
处理步骤：
需要用户补充：
是否建议转人工：
```

完整节点配置和提示词见：[docs/dify-workflow-config.md](docs/dify-workflow-config.md)。

### 多模态图片与页面截图接入

前端会在 `/api/upload` 时自动调用 Dify 文件上传接口并拿到 `upload_file_id`：

- `POST /files/upload`：本地文件会先保存，Dify 可用时同步上传并回传 `difyFileId`；Dify 不可用时仍可继续本地兜底问答
- `POST /chat-messages`：图片/截图问题优先通过 Dify Chat 的 `files` 数组发送（`type: "image"`，`transfer_method: "local_file"`）
- `POST /workflows/run`：文本问题继续走 Workflow；如果你的 Workflow 已配置文件变量，也可以填写 `DIFY_WORKFLOW_FILES_INPUT_KEY`
- `POST /api/chat/message`：当用户请求为视觉理解场景且未上传图片时，返回 `422` 并要求先上传文件。

页面中保留网页文件上传入口，不再直接调用浏览器截图权限。

如果图片识别无效，请检查：

1. 在 Dify Chat App 或 Workflow 中配置了支持图片输入的模型，例如 Qwen-VL、GPT-4o、Gemini Vision 等
2. 对应模型供应商 API Key 有效，且 Dify 后台模型凭证测试通过
3. `DIFY_API_URL`/`DIFY_API_KEY` 有效，且 API key 有文件上传权限
4. 用户端“上传图片/文件”成功后显示 `多模态` 或 `已接收`
5. 如果看到“多模态 AI 还没有接通”，优先检查 Dify 里的视觉模型凭证，而不是前端上传逻辑。

前端不持有 Dify Key。所有 Dify 调用都经过 `server/index.js`，方便后续增加身份、权限、审计、限流和脱敏。

## 飞书接入

开发阶段可不填 `FEISHU_WEBHOOK_URL`，服务端会返回 mock 通知结果。

```bash
FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/...
COLLAB_PLATFORM_BASE_URL=https://scm.test.laiyifen.com/webadmin_vue/collaborationPlatform.html
COLLAB_PLATFORM_PUBLIC_BASE=https://www.laiyifen.com
```

正式要支持飞书群机器人收消息、@机器人回复、单聊申请、人工客服转接时，不建议只用 webhook；应接企业自建应用的事件订阅或长连接。

# 已提供接口

- `GET /api/bootstrap`
- `GET /api/health`
- `GET /api/agents/runtime`：查看每个智能体是否已配置 Dify Runtime
- `GET /api/integration/sources`：查看当前“原站数据 + 自有 AI”来源状态
- `GET /api/navigation/catalog`：查看当前菜单跳转链接目录，以及“原站不是前端直连数据库”的说明
- `GET /api/dify/workflow/debug`：同时探测 Dify Workflow 与 Chat 回退，返回路由、输入变量、错误和修复建议
- `POST /api/dify/workflow/debug`：提交自定义问题做 Dify 调试
- `POST /api/agents/:id/test`：逐个测试某个智能体的 Dify 连接和模型配置
- `GET /api/customer-ai/endpoints`：查看从测试站 AI 页面解析出的真实接口清单
- `GET /api/customer-ai/remote/bootstrap?force=1`：尝试读取测试站 AI 的快捷问题、历史对话、工单列表等只读数据
- `GET /api/customer-ai/real-data`：查看已经落盘的真实快捷问题、历史对话和工单数据
- `POST /api/customer-ai/real-data/refresh`：强制读取测试站只读数据并写入本地真实数据存储
- `ALL /api/customer-ai/remote/:key?force=1`：按接口 key 单独调试测试站接口，写接口仍受 `CUSTOMER_AI_WRITE_ENABLED` 控制
- `GET /api/customer-ai/inspect`：只读探测来伊份测试 AI 页面，提取静态资源和疑似接口路径
- `GET /api/workflow/audits`：查看最近工作流安全审计记录
- `POST /api/chat/start`
- `POST /api/chat/message`
- `POST /api/upload`
- `GET /api/tickets`
- `POST /api/tickets`
- `PATCH /api/tickets/:id`
- `POST /api/tickets/:id/transfer`
- `GET /api/quick-questions`
- `POST /api/quick-questions`
- `PATCH /api/quick-questions/:id`
- `GET /api/agents`
- `POST /api/feishu/notify`

## 测试站 AI 接口探测

可配置测试站入口：

```bash
CUSTOMER_AI_PAGE_URL=https://customer-ai.test.laiyifen.com/scm-customer-web-static/?token=&pathName=home
```

本地启动后访问：

```bash
curl "http://localhost:8788/api/customer-ai/inspect"
```

该接口只做静态入口读取、JS/CSS 资源读取和 `OPTIONS` 连通性探测，不会提交工单、发送消息或执行写操作。如果返回 `page.ok=false` 且错误为 `fetch failed`/`connection closed`，通常表示当前机器没有连上内网/VPN/代理，或测试站需要有效 token。

### 测试站 AI 接口融合

Chrome 页面资产中已观察到这些测试站接口：

- `GET /api/xt/app/basic/getApiToken`
- `GET /dict/queryByKey/SRM-F4`
- `GET /dict/queryByKey/SRM-F4-TYPE`
- `GET /dict/queryByKey/SRM-F4-TYPE-ITEM`
- `GET /admin/srmWorkOrder/getPageInfo`
- `GET /api/work/order/getMyList`
- `GET /api/xt/app/basic/getUserInfoByUserId`
- `GET /question/list`
- `GET /api/v1/ai-assistant/welcomeCheck`
- `POST /api/sensitiveWordFilter/filter`
- `POST /api/message/getSessionWorkNo`
- `GET /api/message/switchToManual`
- `GET /admin/workOrder/score`
- `GET /sse/getAiMessage/{workOrderNo}`
- `POST /api/parse/file`
- `GET /api/comment/history`
- `GET /api/xt/app/basic/queryAllProvince`

默认不会把测试站数据自动混入页面，避免本地启动被内网/代理问题拖慢。需要融合时配置：

```bash
CUSTOMER_AI_REMOTE_ENABLED=true
CUSTOMER_AI_REMOTE_AI_ENABLED=false
CUSTOMER_AI_OPENAPI_BASE=https://openapi.test.laiyifen.com/scm-customer-app-api
CUSTOMER_AI_AI_OPENAPI_BASE=https://ai-openapi.test.laiyifen.com/consultant-ai-api
CUSTOMER_AI_CORE_BASE=https://customer-ai.test.laiyifen.com/scm-customer-core-server
CUSTOMER_AI_FILE_BASE=https://files.test.laiyifen.com
CUSTOMER_AI_SSE_BASE=https://customer-ai.test.laiyifen.com/scm-customer-core-server/sse
CUSTOMER_AI_WS_BASE=wss://customer-ai.test.laiyifen.com/scm-customer-core-server/ws
CUSTOMER_AI_USER_ID=7339931002
CUSTOMER_AI_SOURCE=GCDS
CUSTOMER_AI_TOKEN=token
CUSTOMER_AI_CLIENT_ID=测试站网关的X-Co-Client值
CUSTOMER_AI_SECRET_KEY=测试站网关签名密钥
CUSTOMER_AI_ACCESS_TOKEN=测试站网关的X-Co-AccessToken或token值
CUSTOMER_AI_AUTH_TOKEN=测试站如需Authorization时填写
CUSTOMER_AI_SIGN_ALGORITHM=customer-ai-hmac-sha1
CUSTOMER_AI_SIGN_TEMPLATE=
CUSTOMER_AI_TIMEOUT_MS=12000
CUSTOMER_AI_STORAGE_DIR=storage
```

当前推荐模式是“原站数据 + 自有 AI”：

- `CUSTOMER_AI_REMOTE_ENABLED=true`：读取原站用户、快捷问题、工单、历史等业务数据。
- `CUSTOMER_AI_REMOTE_AI_ENABLED=false`：不调用原站 AI 搜索、DeepSeek SSE、原站文件解析等生成/识别接口。
- `CUSTOMER_AI_STORAGE_DIR=storage`：将规范化后的真实业务数据保存到 `storage/customer-ai-real-data.json`，该目录默认不提交到 Git。
- AI 回答、多模态图片理解、思考链路统一走本地配置的 Dify/Qwen；`ENABLE_LOCAL_OCR=false` 时不会用 OCR 冒充图片理解。

写接口默认只登记不调用。若需要在测试环境真实触发转人工、评分或创建会话，必须显式开启：

```bash
CUSTOMER_AI_WRITE_ENABLED=true
```

调试接口：

```bash
curl "http://localhost:8788/api/customer-ai/endpoints"
curl "http://localhost:8788/api/integration/sources"
curl "http://localhost:8788/api/customer-ai/remote/bootstrap?force=1"
curl "http://localhost:8788/api/customer-ai/remote/quickQuestions?force=1"
```

已登记模块覆盖：

- 启动鉴权：`getApiToken`
- 主会话：`userInfo`、`questionList`、`welcomeCheck`、`myWorkOrders`、`sensitiveWordFilter`、`getSessionWorkNo`、`switchToManual`
- AI 历史/调试：`commentHistory`、`commentRename`、`commentDelete`、`commentSoftDelete`、`commentUpDown`
- 原站 AI 生成/解析接口登记但默认禁用：`sseChat`、`sseStop`、`parseFile`、`aiMessageSse`
- 工单：`dictSrmF4`、`dictSrmF4Type`、`dictSrmF4TypeItem`、`srmWorkOrderPageInfo`、`srmWorkOrderDetail`、`createSrmOrderAndUploadFile`
- 评分/消息：`scoreWorkOrder`、`workOrderItemPraise`、`workOrderDateList`
- 地址：`provinceList`、`cityList`、`districtList`
- 实时通道登记：`userWebSocket`

## 后续替换点

- 将内存数据替换为真实数据库表。
- 将附件解析队列接多模态模型、脱敏服务，必要时再启用 OCR 兜底。
- 将菜单跳转动作接 SCM 路由白名单和 `postMessage`。
- 将客服在线状态接飞书/客服后台。
- 将快捷问题高频归集接分析任务，按身份自动推荐。
>>>>>>> 3456499 (Initial Laiyifen AI assistant prototype)
