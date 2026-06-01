use crate::agent_gateway;
use crate::api::WeReadClient;
use crate::state::RuntimeState;
use crate::system_prompt;
use crate::types::*;
use async_openai::config::OpenAIConfig;
use async_openai::types::{
    ChatCompletionMessageToolCall, ChatCompletionRequestAssistantMessageArgs,
    ChatCompletionRequestMessage, ChatCompletionRequestSystemMessageArgs,
    ChatCompletionRequestToolMessageArgs, ChatCompletionRequestUserMessageArgs,
    ChatCompletionTool, ChatCompletionToolType, FunctionObject,
    CreateChatCompletionRequestArgs,
};
use futures::StreamExt;
use serde_json::{json, Value};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

/// Build the tool definitions for the LLM.
fn build_tools() -> Vec<ChatCompletionTool> {
    vec![
        ChatCompletionTool {
            r#type: ChatCompletionToolType::Function,
            function: FunctionObject {
                name: "invoke_data_gateway".to_string(),
                description: Some(
                    "通过应用内统一数据网关获取阅读数据。\n必填 api_name 与 purpose；业务参数和 api_name 平铺在同一层，不要包在 params/data/body 中；\n接口名、参数和返回值解释以 Skill 文档为准；若目标接口属于核心数据能力，必须先加载 `shuji-weread`；敏感数据需用户授权，未授权前禁止调用对应接口或编造原文。"
                        .to_string(),
                ),
                parameters: Some(agent_gateway::invoke_data_gateway_tool_schema()),
                strict: None,
            },
        },
        ChatCompletionTool {
            r#type: ChatCompletionToolType::Function,
            function: FunctionObject {
                name: "ask_user".to_string(),
                description: Some(
                    "向用户批量提问。一次调用传入多个问题，前端会逐个展示给用户。\
                     每个问题支持单选（提供 options）或自由文本（不提供 options）。\
                     系统会自动为每个问题追加「其他/备注」选项。"
                        .to_string(),
                ),
                parameters: Some(json!({
                    "type": "object",
                    "properties": {
                        "questions": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "question": { "type": "string", "description": "问题文本" },
                                    "options": {
                                        "type": "array",
                                        "items": {
                                            "type": "object",
                                            "properties": {
                                                "label": { "type": "string", "description": "选项显示文本" },
                                                "description": { "type": "string", "description": "选项补充说明，可选" }
                                            },
                                            "required": ["label"],
                                            "additionalProperties": false
                                        },
                                        "description": "单选选项列表，不提供时为自由文本模式"
                                    }
                                },
                                "required": ["question"],
                                "additionalProperties": false
                            },
                            "description": "问题列表，前端会逐个展示"
                        }
                    },
                    "required": ["questions"],
                    "additionalProperties": false
                })),
                strict: None,
            },
        },
        ChatCompletionTool {
            r#type: ChatCompletionToolType::Function,
            function: FunctionObject {
                name: "suggest_report".to_string(),
                description: Some(
                    "在用户主动要求生成/保存/导出报告，或完成一个完整分析主题且适合沉淀为报告时调用。\
                     调用后前端会展示一个带「生成报告」按钮的卡片。\
                     不适合生成报告的小问题可以直接回答，不需要调用。"
                        .to_string(),
                ),
                parameters: Some(json!({
                    "type": "object",
                    "properties": {
                        "summary": {
                            "type": "string",
                            "description": "一句话说明已分析的内容，例如「你的 2025 年阅读数据已经分析完毕」"
                        }
                    },
                    "required": ["summary"],
                    "additionalProperties": false
                })),
                strict: None,
            },
        },
        ChatCompletionTool {
            r#type: ChatCompletionToolType::Function,
            function: FunctionObject {
                name: "load_skill".to_string(),
                description: Some(
                    "按需加载扩展能力的完整知识。当用户意图涉及小红书图文设计、\
                     报告视觉规范等领域时，调用此工具加载对应能力文档，\
                     获取详细的设计规则、风格约束和工作流指导。\
                     加载后内容会注入当前对话，后续回答必须遵循加载的规范。"
                        .to_string(),
                ),
                parameters: Some(json!({
                    "type": "object",
                    "properties": {
                        "skill_name": {
                            "type": "string",
                            "description": "要加载的能力名称，必须是系统提示词中列出的可用能力之一"
                        }
                    },
                    "required": ["skill_name"],
                    "additionalProperties": false
                })),
                strict: None,
            },
        },
    ]
}

/// Emit a typed event to the frontend.
fn emit(app: &AppHandle, event: LlmChatEvent) {
    let _ = app.emit("llm-chat-event", event);
}

/// Helper to create a standard event with jobId.
fn make_event(event_type: &str, job_id: &str) -> LlmChatEvent {
    LlmChatEvent {
        r#type: event_type.to_string(),
        job_id: job_id.to_string(),
        call_id: None,
        content: None,
        skill_name: None,
        title: None,
        summary: None,
        copy: None,
        file_path: None,
        error: None,
        question: None,
        options: None,
        response_type: None,
        access_records: None,
        consent_request: None,
    }
}

pub async fn start_llm_chat(
    app: AppHandle,
    state: &Arc<RuntimeState>,
    config: &AppConfig,
    request: LlmChatRequest,
) -> Result<String, String> {
    let base_url = config
        .llm_base_url
        .as_deref()
        .ok_or("请先配置 AI 服务 Base URL")?;
    let api_key = config
        .llm_api_key
        .as_deref()
        .ok_or("请先配置 AI 服务 API Key")?;
    let model = config
        .llm_model
        .clone()
        .unwrap_or_else(|| "gpt-4o".to_string());

    let llm_config = OpenAIConfig::new()
        .with_api_key(api_key)
        .with_api_base(base_url);
    let llm_client = async_openai::Client::with_config(llm_config);

    let weread_client = state.client().await.ok();

    let job_id = uuid::Uuid::new_v4().to_string();
    let (cancel_tx, cancel_rx) = tokio::sync::watch::channel(false);
    let cancel_tx = Arc::new(cancel_tx);

    state
        .llm_chat_cancel
        .write()
        .await
        .insert(job_id.clone(), cancel_tx.clone());

    let app_handle = app.clone();
    let job_id_clone = job_id.clone();
    let state_arc = state.clone();

    tokio::spawn(async move {
        let result = run_chat_loop(
            &app_handle,
            &llm_client,
            &model,
            weread_client.as_ref(),
            request,
            cancel_rx,
            &job_id_clone,
            &state_arc,
        )
        .await;

        let _ = cancel_tx.send(true);
        state_arc.cleanup_consent(&job_id_clone).await;

        match result {
            Ok(_) => {
                let evt = make_event("run_completed", &job_id_clone);
                emit(&app_handle, evt);
            }
            Err(e) => {
                let mut evt = make_event("run_failed", &job_id_clone);
                evt.error = Some(e);
                emit(&app_handle, evt);
            }
        }
    });

    Ok(job_id)
}

pub async fn cancel_llm_chat(state: &Arc<RuntimeState>, job_id: &str) -> Result<bool, String> {
    let handle = state.llm_chat_cancel.read().await.get(job_id).cloned();
    if let Some(tx) = handle {
        let _ = tx.send(true);
        state.llm_chat_cancel.write().await.remove(job_id);
        state.cleanup_consent(job_id).await;
        Ok(true)
    } else {
        Ok(false)
    }
}

async fn run_chat_loop(
    app: &AppHandle,
    llm_client: &async_openai::Client<OpenAIConfig>,
    model: &str,
    weread_client: Option<&WeReadClient>,
    request: LlmChatRequest,
    mut cancel_rx: tokio::sync::watch::Receiver<bool>,
    job_id: &str,
    state: &Arc<RuntimeState>,
) -> Result<(), String> {
    let tools = build_tools();

    // Build system prompt from bundled template + runtime context.
    let system_prompt::RenderedSystemPrompt { system_text, .. } = system_prompt::render();

    let mut messages: Vec<ChatCompletionRequestMessage> = Vec::new();
    messages.push(
        ChatCompletionRequestSystemMessageArgs::default()
            .content(system_text)
            .build()
            .map_err(|e| format!("构建系统消息失败: {e}"))?
            .into(),
    );

    // Convert user messages — only send user/assistant text, not tool messages
    // The backend maintains tool history internally
    for msg in &request.messages {
        match msg.role.as_str() {
            "user" => {
                if let Some(content) = &msg.content {
                    messages.push(
                        ChatCompletionRequestUserMessageArgs::default()
                            .content(content.clone())
                            .build()
                            .map_err(|e| format!("构建用户消息失败: {e}"))?
                            .into(),
                    );
                }
            }
            "assistant" => {
                if let Some(content) = &msg.content {
                    let mut builder = ChatCompletionRequestAssistantMessageArgs::default();
                    builder.content(content.clone());
                    // Include tool calls if present (for multi-turn context)
                    if let Some(tool_calls) = &msg.tool_calls {
                        let calls: Vec<ChatCompletionMessageToolCall> = tool_calls
                            .iter()
                            .map(|tc| ChatCompletionMessageToolCall {
                                id: tc.id.clone(),
                                r#type: async_openai::types::ChatCompletionToolType::Function,
                                function: async_openai::types::FunctionCall {
                                    name: tc.function.name.clone(),
                                    arguments: tc.function.arguments.clone(),
                                },
                            })
                            .collect();
                        builder.tool_calls(calls);
                    }
                    messages.push(
                        builder
                            .build()
                            .map_err(|e| format!("构建助手消息失败: {e}"))?
                            .into(),
                    );
                }
            }
            "tool" => {
                if let (Some(content), Some(tool_call_id)) = (&msg.content, &msg.tool_call_id) {
                    messages.push(
                        ChatCompletionRequestToolMessageArgs::default()
                            .content(content.clone())
                            .tool_call_id(tool_call_id.clone())
                            .build()
                            .map_err(|e| format!("构建工具消息失败: {e}"))?
                            .into(),
                    );
                }
            }
            _ => {}
        }
    }

    // Emit run_started
    let evt = make_event("run_started", job_id);
    emit(app, evt);

    let mut iterations = 0;
    const MAX_ITERATIONS: usize = 15;
    let mut access_records: Vec<DataAccessRecord> = Vec::new();

    loop {
        if *cancel_rx.borrow() {
            let evt = make_event("run_canceled", job_id);
            emit(app, evt);
            return Ok(());
        }

        if iterations >= MAX_ITERATIONS {
            return Err("工具调用次数超过限制".to_string());
        }
        iterations += 1;

        let request_builder = CreateChatCompletionRequestArgs::default()
            .model(model)
            .messages(messages.clone())
            .tools(tools.clone())
            .build()
            .map_err(|e| format!("构建请求失败: {e}"))?;

        let mut stream = llm_client
            .chat()
            .create_stream(request_builder)
            .await
            .map_err(|e| format!("LLM 请求失败: {e}"))?;

        let mut full_content = String::new();
        let mut tool_calls_buf: Vec<(String, String, String)> = Vec::new();

        while let Some(chunk_result) = stream.next().await {
            if *cancel_rx.borrow() {
                let evt = make_event("run_canceled", job_id);
                emit(app, evt);
                return Ok(());
            }

            let chunk = chunk_result.map_err(|e| format!("流式读取失败: {e}"))?;

            for choice in &chunk.choices {
                let delta = &choice.delta;

                if let Some(content) = &delta.content {
                    full_content.push_str(content);
                    let mut evt = make_event("message_delta", job_id);
                    evt.content = Some(content.clone());
                    emit(app, evt);
                }

                if let Some(tool_calls) = &delta.tool_calls {
                    for tc in tool_calls {
                        let idx = tc.index as usize;
                        while tool_calls_buf.len() <= idx {
                            tool_calls_buf.push((String::new(), String::new(), String::new()));
                        }
                        if let Some(id) = &tc.id {
                            tool_calls_buf[idx].0 = id.clone();
                        }
                        if let Some(function) = &tc.function {
                            if let Some(name) = &function.name {
                                tool_calls_buf[idx].1 = name.clone();
                            }
                            if let Some(args) = &function.arguments {
                                tool_calls_buf[idx].2.push_str(args);
                            }
                        }
                    }
                }
            }
        }

        // If there are tool calls, execute them via the gateway
        if !tool_calls_buf.is_empty() {
            // Add assistant message with tool calls to history
            let mut assistant_builder = ChatCompletionRequestAssistantMessageArgs::default();
            if !full_content.is_empty() {
                assistant_builder.content(full_content.clone());
            }
            let tool_calls: Vec<ChatCompletionMessageToolCall> = tool_calls_buf
                .iter()
                .map(|(id, name, args)| ChatCompletionMessageToolCall {
                    id: id.clone(),
                    r#type: async_openai::types::ChatCompletionToolType::Function,
                    function: async_openai::types::FunctionCall {
                        name: name.clone(),
                        arguments: args.clone(),
                    },
                })
                .collect();
            assistant_builder.tool_calls(tool_calls);
            messages.push(
                assistant_builder
                    .build()
                    .map_err(|e| format!("构建助手消息失败: {e}"))?
                    .into(),
            );

            // Execute each tool call via the gateway
            // Get granted consents for this job
            let granted_consents = state.get_granted_consents(job_id).await;

            for (call_id, tool_name, tool_args) in &tool_calls_buf {
                // Parse tool arguments
                let args_value: Value =
                    serde_json::from_str(tool_args).unwrap_or(json!({}));

                // Handle suggest_report tool call
                if tool_name == "suggest_report" {
                    let summary = args_value
                        .get("summary")
                        .and_then(|v| v.as_str())
                        .unwrap_or("数据分析已完成")
                        .to_string();
                    let mut evt = make_event("suggest_report", job_id);
                    evt.call_id = Some(call_id.clone());
                    evt.content = Some(summary);
                    emit(app, evt);
                    // Return success to LLM so it continues
                    let result_str = json!({"ok": true}).to_string();
                    messages.push(
                        ChatCompletionRequestToolMessageArgs::default()
                            .content(result_str)
                            .tool_call_id(call_id.clone())
                            .build()
                            .map_err(|e| format!("构建工具结果消息失败: {e}"))?
                            .into(),
                    );
                    continue;
                }

                // Handle ask_user tool call
                if tool_name == "ask_user" {
                    let questions: Vec<Value> = args_value
                        .get("questions")
                        .and_then(|v| v.as_array().cloned())
                        .unwrap_or_default();

                    let other_option = crate::types::AskUserOption {
                        label: "其他/备注".to_string(),
                        description: None,
                    };

                    let mut all_responses: Vec<String> = Vec::new();

                    for q in &questions {
                        let question_text = q
                            .get("question")
                            .and_then(|v| v.as_str())
                            .unwrap_or("需要你的输入")
                            .to_string();
                        let mut options: Vec<crate::types::AskUserOption> = q
                            .get("options")
                            .and_then(|v| serde_json::from_value(v.clone()).ok())
                            .unwrap_or_default();

                        // 追加「其他/备注」选项
                        options.push(other_option.clone());

                        // Register before emitting so a fast UI response cannot be lost.
                        let mut ask_rx = state.register_ask_user_channel(job_id.to_string()).await;

                        // Emit ask_user_required event
                        let mut evt = make_event("ask_user_required", job_id);
                        evt.call_id = Some(call_id.clone());
                        evt.question = Some(question_text);
                        evt.options = Some(options);
                        evt.response_type = Some("single_choice".to_string());
                        emit(app, evt);

                        // Wait for user response
                        let user_response: String;
                        loop {
                            tokio::select! {
                                result = &mut ask_rx => {
                                    user_response = result.unwrap_or_else(|_| "(用户未响应)".to_string());
                                    break;
                                }
                                _ = cancel_rx.changed() => {
                                    if *cancel_rx.borrow() {
                                        return Ok(());
                                    }
                                }
                            }
                        }
                        all_responses.push(user_response);
                    }

                    // Format all responses as JSON and add to message history
                    let responses_json = serde_json::to_string_pretty(&all_responses)
                        .unwrap_or_else(|_| format!("{:?}", all_responses));
                    messages.push(
                        ChatCompletionRequestToolMessageArgs::default()
                            .content(responses_json)
                            .tool_call_id(call_id.clone())
                            .build()
                            .map_err(|e| format!("构建工具结果消息失败: {e}"))?
                            .into(),
                    );
                    continue;
                }

                // Handle load_skill tool call
                if tool_name == "load_skill" {
                    let skill_name = args_value
                        .get("skill_name")
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    match crate::skill_registry::load_skill_content(skill_name) {
                        Some(content) => {
                            // Notify frontend
                            let mut evt = make_event("skill_loaded", job_id);
                            evt.call_id = Some(call_id.clone());
                            evt.skill_name = Some(skill_name.to_string());
                            evt.title = Some(format!("已加载「{}」能力", skill_name));
                            emit(app, evt);
                            // Inject full content as tool result
                            messages.push(
                                ChatCompletionRequestToolMessageArgs::default()
                                    .content(content)
                                    .tool_call_id(call_id.clone())
                                    .build()
                                    .map_err(|e| format!("构建工具结果消息失败: {e}"))?
                                    .into(),
                            );
                        }
                        None => {
                            let err = format!("未找到名为「{}」的能力。请根据系统提示词中的 L1 元数据列表选择准确名称。", skill_name);
                            messages.push(
                                ChatCompletionRequestToolMessageArgs::default()
                                    .content(err)
                                    .tool_call_id(call_id.clone())
                                    .build()
                                    .map_err(|e| format!("构建工具结果消息失败: {e}"))?
                                    .into(),
                            );
                        }
                    }
                    continue;
                }

                // Emit skill_started
                let api_name = args_value
                    .get("api_name")
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown");
                // 优先使用 LLM 提供的 purpose，兜底用 friendly name + 书名
                let purpose_from_args = args_value
                    .get("purpose")
                    .and_then(|v| v.as_str())
                    .filter(|s| !s.is_empty());
                let skill_title = match purpose_from_args {
                    Some(p) => p.to_string(),
                    None => fallback_skill_title(api_name),
                };
                let mut evt = make_event("skill_started", job_id);
                evt.call_id = Some(call_id.clone());
                evt.skill_name = Some(api_name.to_string());
                evt.title = Some(skill_title);
                emit(app, evt);

                // Build gateway args
                let params_map: std::collections::HashMap<String, Value> = args_value
                    .as_object()
                    .map(|m| m.iter().map(|(k, v)| (k.clone(), v.clone())).collect())
                    .unwrap_or_default();
                let gateway_args = agent_gateway::GatewayArgs {
                    api_name: api_name.to_string(),
                    params: params_map,
                };

                // Execute via gateway with granted consents
                let result = agent_gateway::invoke(weread_client, Some(call_id), gateway_args.clone(), &granted_consents).await;
                let result_access_record = result.access_record.clone();

                // Emit report_saved if this was a report export (before moving result.data)
                if api_name == "/export/report_html" && result.success {
                    if let Some(data) = &result.data {
                        let file_path = data.get("filePath").and_then(|v| v.as_str());
                        let title = data.get("title").and_then(|v| v.as_str());
                        let mut evt = make_event("report_saved", job_id);
                        evt.title = title.map(|s| s.to_string());
                        evt.file_path = file_path.map(|s| s.to_string());
                        emit(app, evt);
                    }
                }

                let result_str = if result.success {
                    if let Some(record) = result_access_record {
                        access_records.push(record.with_call_id(call_id));
                    }
                    let data = result.data.unwrap_or(json!(null));
                    serde_json::to_string_pretty(&data)
                        .unwrap_or_else(|_| data.to_string())
                } else if result.requires_consent.unwrap_or(false) {
                    // Register before emitting so a fast approve/deny click cannot be lost.
                    let consent_api = result.consent_api.clone().unwrap_or_default();
                    let mut consent_rx = state.register_consent_channel(job_id.to_string()).await;

                    // Emit consent_required event
                    let mut evt = make_event("consent_required", job_id);
                    evt.call_id = Some(call_id.clone());
                    evt.skill_name = result.consent_api.clone();
                    evt.consent_request = result.consent_request.clone();
                    let purpose_from_args = args_value
                        .get("purpose")
                        .and_then(|v| v.as_str())
                        .filter(|s| !s.is_empty());
                    let desc = match purpose_from_args {
                        Some(p) => p.to_string(),
                        None => fallback_skill_title(
                            result.consent_api.as_deref().unwrap_or("读取数据")
                        ),
                    };
                    evt.copy = Some(format!("{} — 需要你的授权", desc));
                    emit(app, evt);

                    // Wait until user grants/denies consent or cancels.
                    let user_granted = loop {
                        tokio::select! {
                            _ = consent_rx.changed() => {
                                if let Some(granted) = *consent_rx.borrow() {
                                    break granted;
                                }
                            }
                            _ = cancel_rx.changed() => {
                                if *cancel_rx.borrow() {
                                    // User cancelled
                                    return Ok(());
                                }
                            }
                        }
                    };

                    if !user_granted {
                        if let Some(mut record) = result.access_record.clone() {
                            record.call_id = call_id.clone();
                            record.status = "denied".to_string();
                            record.summary_text = format!("未读取：{}", record.display_name);
                            access_records.push(record);
                        }
                        json!({
                            "error": "用户拒绝授权，已跳过本次数据读取。",
                        })
                        .to_string()
                    } else {
                        // Grant this API consent
                        state.grant_api_consent(job_id, &consent_api, None).await;

                        // Re-execute the tool call with granted consent
                        let mut granted = granted_consents.clone();
                        granted.insert(consent_api.clone());
                        let retry_result = agent_gateway::invoke(weread_client, Some(call_id), gateway_args, &granted).await;
                        let retry_access_record = retry_result.access_record.clone();

                        if retry_result.success {
                            if let Some(record) = retry_access_record {
                                access_records.push(record.with_call_id(call_id));
                            }
                            let data = retry_result.data.unwrap_or(json!(null));
                            serde_json::to_string_pretty(&data)
                                .unwrap_or_else(|_| data.to_string())
                        } else {
                            if let Some(record) = retry_access_record {
                                access_records.push(record.with_call_id(call_id));
                            }
                            json!({
                                "error": retry_result.error.unwrap_or_else(|| "授权后执行失败".to_string()),
                            })
                            .to_string()
                        }
                    }
                } else {
                    if let Some(record) = result_access_record {
                        access_records.push(record.with_call_id(call_id));
                    }
                    json!({
                        "error": result.error.unwrap_or_else(|| "未知错误".to_string()),
                    })
                    .to_string()
                };

                // Emit skill_completed
                let mut evt = make_event("skill_completed", job_id);
                evt.call_id = Some(call_id.clone());
                evt.skill_name = Some(api_name.to_string());
                evt.summary = Some(truncate_for_summary(&result_str, 200));
                emit(app, evt);

                // Truncate large tool results to prevent context overflow
                const MAX_TOOL_RESULT_CHARS: usize = 8000;
                let result_str = if result_str.len() > MAX_TOOL_RESULT_CHARS {
                    let truncated: String = result_str.chars().take(MAX_TOOL_RESULT_CHARS).collect();
                    format!("{}...\n[结果已截断，原始长度 {} 字符]", truncated, result_str.len())
                } else {
                    result_str
                };

                // Add tool result to message history
                messages.push(
                    ChatCompletionRequestToolMessageArgs::default()
                        .content(result_str)
                        .tool_call_id(call_id.clone())
                        .build()
                        .map_err(|e| format!("构建工具结果消息失败: {e}"))?
                        .into(),
                );
            }

            // Continue the loop for the next LLM call
            continue;
        }

        // No tool calls — final response
        // The last delta already emitted, so we don't need to emit content again.
        // The frontend will know the run is complete from run_completed.
        emit_access_summary(app, job_id, &access_records);

        return Ok(());
    }
}

trait AccessRecordCallId {
    fn with_call_id(self, call_id: &str) -> Self;
}

impl AccessRecordCallId for DataAccessRecord {
    fn with_call_id(mut self, call_id: &str) -> Self {
        self.call_id = call_id.to_string();
        self
    }
}

fn emit_access_summary(app: &AppHandle, job_id: &str, records: &[DataAccessRecord]) {
    if records.is_empty() {
        return;
    }
    let mut evt = make_event("data_access_summary", job_id);
    evt.access_records = Some(records.to_vec());
    evt.summary = Some(access_summary_text(records));
    emit(app, evt);
}

fn access_summary_text(records: &[DataAccessRecord]) -> String {
    let mut read_labels: Vec<String> = Vec::new();
    let mut denied_raw = false;
    let mut read_raw = false;

    for record in records {
        if record.contains_raw_text && record.status == "denied" {
            denied_raw = true;
        }
        if record.contains_raw_text && record.status == "completed" {
            read_raw = true;
        }
        if record.status == "completed" {
            for label in &record.data_category_labels {
                if !read_labels.contains(label) {
                    read_labels.push(label.clone());
                }
            }
        }
    }

    if read_labels.is_empty() {
        if denied_raw {
            return "本轮未读取划线或想法原文，仅基于已有信息继续。".to_string();
        }
        return "本轮没有读取新的阅读数据。".to_string();
    }

    let raw_note = if read_raw {
        "；包含你确认读取的划线或想法"
    } else if denied_raw {
        "；未读取划线或想法原文"
    } else {
        "；未读取划线或想法原文"
    };
    format!("本轮读取：{}{}", read_labels.join("、"), raw_note)
}

/// Fallback title when LLM does not provide `purpose`.
fn fallback_skill_title(api_name: &str) -> String {
    api_name.to_string()
}

/// Truncate text for summary display.
fn truncate_for_summary(text: &str, max_chars: usize) -> String {
    if text.chars().count() <= max_chars {
        text.to_string()
    } else {
        let truncated: String = text.chars().take(max_chars).collect();
        format!("{}...", truncated)
    }
}
