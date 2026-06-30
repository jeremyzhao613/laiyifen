# 按 Dify-for-AiSearch 思路构建来伊份 AI 助手

参考项目：[onenov/Dify-for-AiSearch](https://github.com/onenov/Dify-for-AiSearch)

## 采用的设计

Dify-for-AiSearch 的核心模式是：

1. 前端只负责对话、上传、历史和结果展示。
2. 文件先上传到 Dify `/files/upload`，提问时通过 `files` 传入模型。
3. Dify 用一个高级聊天/工作流应用统一分流：类型判断 -> 工具/文件处理 -> LLM 汇总 -> Answer。
4. 前端保存会话、消息 ID、历史记录和建议问题。

来伊份 AI 助手保留这些模式，但不恢复页面上的“AI 联网搜索”入口。业务能力改为：

- 共创平台客服问答
- 图片/文件多模态识别
- 用户身份分流
- 工单/转人工
- 历史对话与客服上下文

## 前后端调用链

```text
http://localhost:5173
  -> Vite proxy /api
  -> http://localhost:8788
  -> Dify http://localhost/v1
  -> /files/upload + /workflows/run 或 /chat-messages
```

本地项目不直接在浏览器暴露 Dify Key，所有 Dify 调用都经过 `server/index.js`。

## 环境变量

```bash
DIFY_API_URL=http://localhost/v1
DIFY_APP_MODE=workflow
DIFY_WORKFLOW_API_URL=http://localhost/v1
DIFY_WORKFLOW_API_KEY=你的 Dify Workflow App Key
DIFY_WORKFLOW_LABEL=智能客服分流助手 Workflow
DIFY_WORKFLOW_INPUT_KEY=customer_issue

# 如果 Dify 开始节点添加了单文件变量
DIFY_WORKFLOW_FILES_INPUT_KEY=customer_file
DIFY_WORKFLOW_FILES_INPUT_MODE=single

# 兼容当前 Dify 三分类：技术问题 / 账单问题 / 其他咨询
DIFY_WORKFLOW_ISSUE_TYPE_MODE=legacy

# 如果 Dify 已改成来伊份细分类，再切为：
# DIFY_WORKFLOW_ISSUE_TYPE_MODE=laiyifen
```

当 `DIFY_APP_MODE=workflow` 且配置了 `DIFY_WORKFLOW_FILES_INPUT_KEY` 时，图片/文档会优先进入 Workflow 文件分支；未配置文件变量时，图片问题才会尝试旧的 Chat 多模态应用。

## Dify 开始节点表单

| 变量名 | 类型 | 必填 | 推荐选项/说明 | 后端来源 |
| --- | --- | --- | --- | --- |
| `customer_issue` | 文本 | 是 | 用户原始问题 | 前端输入框 |
| `customer_identity` | 文本/下拉 | 否 | 员工、供应商、加盟商、经销商 | 前端身份 |
| `customer_file` | 单文件 | 否 | 图片/文档；变量名需与 `DIFY_WORKFLOW_FILES_INPUT_KEY` 一致 | Dify 文件上传 ID |
| `issue_type` | 下拉 | 兼容模式下建议必填 | `技术问题`、`账单问题`、`其他咨询` | 后端自动映射 |
| `issue_category` | 文本 | 否 | 来伊份细分类，例如供应商入驻、工单与人工客服 | 后端分类器 |
| `search_type` | 下拉 | 否 | `chat`、`file`、`support` | 后端根据问题/附件自动生成 |
| `urgency_level` | 下拉 | 否 | `未选择`、`高`、`中`、`低` | 后端根据优先级生成 |
| `contact_phone` | 文本 | 否 | 联系电话，工单使用 | 后续表单/用户信息 |
| `case_reference` | 文本 | 否 | 订单号、合同号、工单号 | 后续表单/用户输入 |

## 工作流节点表

| 顺序 | 节点 | 类型 | 输入 | 输出 | 说明 |
| --- | --- | --- | --- | --- | --- |
| 1 | 客户请求 | Start | 上表变量 | - | 接收问题、身份、附件 |
| 2 | 文件类型判断 | If/Else | `customer_file` 或 `sys.files` | 分支 | 借鉴 AiSearch 的图片/文档分支 |
| 3A | 视觉分析 | LLM | 用户问题 + 图片文件 | `vision_result` | 使用支持视觉的模型，不使用 OCR 冒充识图 |
| 3B | 文档提取 | Document Extractor | 文档文件 | `document_text` | PDF/Word/Excel/CSV 先提取文本 |
| 4 | 问题分类器 | Question Classifier | `customer_issue`、`customer_identity`、文件结果 | `issue_category` | 输出来伊份业务分类 |
| 5 | 知识库检索 | Knowledge Retrieval | 用户问题 + 分类 | `knowledge_context` | 检索共创平台知识库/操作手册 |
| 6 | 客服回答 LLM | LLM | 问题、身份、分类、知识库、文件结果 | `answer` | 生成用户可执行回复 |
| 7 | 是否转人工 | If/Else | 分类、置信度、风险、用户意图 | `need_human` | 用户明确转人工/无答案/P0 风险时进入人工 |
| 8A | 创建工单 | HTTP Request | 用户信息、问题、附件、分类 | `ticket_id` | 只创建工单，不在用户端展示转派 |
| 8B | 普通回复 | Answer | `answer` | - | 返回 AI 回复 |
| 9 | 人工服务回复 | Answer | `ticket_id`、客服提示 | - | 告知已接入人工，当前对话继续，不跳转 |

## 问题分类建议

| 分类 | 触发问题 | 路由 |
| --- | --- | --- |
| 账号权限与登录 | 登录、忘记密码、手机号、角色、菜单不可见 | 技术支持/权限核验 |
| 供应商入驻 | 入驻资料、SAP 编码、联系人、下一步操作 | 供应商业务知识库 |
| 合同授权与结算 | 合同、授权、付款、发票、财务联系人 | 业务知识库/必要时人工 |
| 加盟商商机与门店运营 | 商机报名、门店资料、今日待办、运营流程 | 加盟运营知识库 |
| 经销商业务问题 | 经销合同、渠道、订单、授权人 | 经销业务知识库 |
| 工单与人工客服 | 转人工、客服服务时间、评价、工单状态 | 工单/飞书客服 |
| 附件图片文件识别 | 截图、图片、PDF、Excel、Word、CSV | 多模态/文档提取 |
| 系统异常与缺陷 | 卡死、报错、按钮不可用、加载失败 | 技术问题/P0 |
| 其他问题 | 无法判断的问题 | 兜底澄清或转人工 |

## LLM 提示词骨架

```text
你是来伊份共创平台 AI 客服助手“小伊”。

当前用户身份：{{ customer_identity }}
问题分类：{{ issue_category }}
用户问题：{{ customer_issue }}
附件识别结果：{{ vision_result 或 document_text }}
知识库内容：{{ knowledge_context }}

回答要求：
1. 用中文，先给结论，再给步骤。
2. 不编造后台数据，不承诺已经修改权限或工单状态。
3. 涉及权限、账号绑定、真实合同/订单数据时，引导转人工或生成工单。
4. 如果用户已转人工，说明会在当前对话继续，不跳转页面。
5. 人工客服时间：周一至周五 09:00-18:00。
6. 图片/文件识别不确定时说明不确定点，不输出完整手机号、身份证、银行卡等敏感信息。

输出格式：
结论：
处理步骤：
需要补充：
是否建议转人工：
```

## 输出节点

结束/Answer 节点至少返回一个文本字段，推荐：

```text
answer = 上游 LLM 的 text
```

本地后端会依次读取：

```text
outputs.answer
outputs.text
outputs.output
outputs.result
outputs.reply
outputs.response
```

## 与参考项目的差异

| Dify-for-AiSearch | 来伊份 AI 助手 |
| --- | --- |
| Vue 前端直连 Dify API | React 前端 -> Node 后端 -> Dify，避免暴露 Key |
| `search_type=web/news/academic/chat/link` | `search_type=chat/file/support` |
| Serper/必应/Tavily 等联网搜索 | 不在用户页面恢复联网搜索入口 |
| 文件分支使用 `sys.files` | Workflow 可用 `customer_file`，Chat App 可用 `files` |
| 搜索结果展示 | 客服回答、工单、人工服务、历史对话 |
