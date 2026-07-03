# API 路由

## DeepSeek API 代理

### `POST /api/deepseek`

转发请求到 DeepSeek Chat API，避免浏览器端 CORS 问题。

**请求体：**
```json
{
  "systemPrompt": "你是一个数据分析助手...",
  "userMessage": "请解析以下指令：\n筛选技术部的员工"
}
```

**请求头：**
- `x-deepseek-api-key`（可选）— 用户通过设置页面配置的 API Key

**逻辑：**
1. API Key 来源优先级：请求头 > 环境变量 `DEEPSEEK_API_KEY`
2. 无 Key 时返回 500
3. 调用 DeepSeek `deepseek-chat` 模型，temperature=0.1，max_tokens=1024
4. 返回标准 OpenAI-compatible 响应

**响应：**
```json
{
  "choices": [{ "message": { "content": "{\"action\":\"filter\",...}" } }]
}
```

## 未来计划

【当前实现】只有 DeepSeek 代理这一条 API 路由  
【后续计划】可以考虑：
- 本地模型 API 端点（如 Ollama）
- 更完整的 API 层（health check、模型切换等）
