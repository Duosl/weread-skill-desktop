import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Bot,
  Send,
  Square,
  Copy,
  Check,
  FileText,
  ChevronDown,
  Shield,
  X,
  RotateCw,
} from "lucide-react";
import { PageShell } from "../components/layout/PageShell";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Link } from "react-router-dom";
import type {
  AppSettings,
  ChatHistory,
  ChatHistoryEntry,
  ConsentRequest,
  DataAccessRecord,
  LlmChatEvent,
  LlmMessage,
} from "../types";

// ===== 节点类型定义 =====

type TextNode = { type: "text"; content: string };
type SkillNode = {
  type: "skill";
  callId: string;
  skillName: string;
  title: string;
  status: "running" | "done";
  summary?: string;
  startTime: number;
};
type ConsentNode = {
  type: "consent";
  callId: string;
  skillName: string;
  copy: string;
  granted?: boolean;
};
type AskUserNode = {
  type: "ask_user";
  callId: string;
  question: string;
  options?: Array<{ label: string; description?: string }>;
  answer?: string;
};
type SuggestReportNode = {
  type: "suggest_report";
  summary: string;
  dismissed?: boolean;
};
type ReportNode = {
  type: "report_saved";
  title: string;
  filePath: string;
};
type SkillLoadedNode = {
  type: "skill_loaded";
  skillName: string;
  title: string;
};
type DataAccessSummaryNode = {
  type: "data_access_summary";
  summary: string;
  records: DataAccessRecord[];
};

type ChatNode = TextNode | SkillNode | ConsentNode | AskUserNode | SuggestReportNode | ReportNode | SkillLoadedNode | DataAccessSummaryNode;

type ChatMessage = {
  role: "user" | "assistant";
  nodes: ChatNode[];
  isStreaming?: boolean;
  runStartTime?: number;
  elapsedMs?: number;
};

type ChatPageProps = {
  settings: AppSettings;
};

// ===== 技能友好名称（动词形式） =====

const SKILL_VERBS: Record<string, string> = {
  "shuji-weread": "加载阅读数据能力",
  "/store/search": "搜索书籍",
  "/book/info": "查看书籍详情",
  "/book/chapterinfo": "查看章节目录",
  "/book/getprogress": "查看阅读进度",
  "/shelf/sync": "查询书架",
  "/book/bookmarklist": "读取划线原文",
  "/review/list/mine": "读取个人想法",
  "/user/notebooks": "查看笔记概览",
  "/book/underlines": "查看划线热度",
  "/book/bestbookmarks": "查看热门划线",
  "/book/readreviews": "查看划线评论",
  "/review/single": "查看想法详情",
  "/readdata/detail": "读取阅读统计",
  "/review/list": "查看公开书评",
  "/book/recommend": "获取个性化推荐",
  "/book/similar": "查找相似书籍",
  "/export/report_html": "保存报告",
};

function getSkillVerb(skillName: string): string {
  return SKILL_VERBS[skillName] || skillName;
}

// ===== 历史日期格式化 =====

function formatHistoryDate(dateStr: string): string {
  if (!dateStr) return "";
  // 格式：20260529-143000 或 2026-05-29T14:30:00
  try {
    if (dateStr.includes("T")) {
      const d = new Date(dateStr);
      const month = d.getMonth() + 1;
      const day = d.getDate();
      const hour = d.getHours().toString().padStart(2, "0");
      const min = d.getMinutes().toString().padStart(2, "0");
      return `${month}/${day} ${hour}:${min}`;
    }
    // 旧格式 20260529-143000
    const match = dateStr.match(/(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})/);
    if (match) {
      return `${parseInt(match[2])}/${parseInt(match[3])} ${match[4]}:${match[5]}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

// ===== 耗时格式化 =====

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs}s`;
}

// ===== 辅助：获取节点中的纯文本 =====

function getMessageText(nodes: ChatNode[]): string {
  return nodes
    .filter((n): n is TextNode => n.type === "text")
    .map((n) => n.content)
    .join("");
}

// ===== ReactMarkdown components =====

const markdownComponents = {
  p: ({ children, ...props }: any) => (
    <p style={{ margin: "4px 0", lineHeight: "1.7" }} {...props}>{children}</p>
  ),
  strong: ({ children, ...props }: any) => (
    <strong style={{ fontWeight: 600, color: "var(--ink)" }} {...props}>{children}</strong>
  ),
  hr: () => <div style={{ height: "12px" }} />,
  code: ({ children, className, ...props }: any) => {
    const text = String(children);
    // 接口名胶囊：/开头的路径
    if (text.startsWith("/") && !text.includes(" ")) {
      return <span className="chat-badge-api">{text}</span>;
    }
    return <code className={className} {...props}>{children}</code>;
  },
};

// ===== 组件 =====

export function ChatPage({ settings }: ChatPageProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [chatHistories, setChatHistories] = useState<ChatHistoryEntry[]>([]);
  const [showSidebar, setShowSidebar] = useState(false);
  const [expandedActions, setExpandedActions] = useState<Set<string>>(new Set());
  const [pendingConsent, setPendingConsent] = useState<{ skillName: string; copy: string; request?: ConsentRequest | null } | null>(null);
  const [failedMessageText, setFailedMessageText] = useState<string | null>(null);
  const [pendingAskUser, setPendingAskUser] = useState<{
    callId: string;
    question: string;
    options?: Array<{ label: string; description?: string }>;
    responseType: string;
  } | null>(null);
  const [askUserSelection, setAskUserSelection] = useState<number | null>(null);
  const [askUserFreeTextMode, setAskUserFreeTextMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const unlistenRef = useRef<(() => void) | null>(null);
  const jobIdRef = useRef<string | null>(null);
  const chatIdRef = useRef<string>("");
  const lastSentTextRef = useRef<string>("");

  // 加载历史对话列表
  function refreshHistoryList() {
    invoke<ChatHistoryEntry[]>("list_chat_histories").then((list) => {
      setChatHistories(list || []);
    }).catch(() => {});
  }

  // 启动时加载最近的历史对话
  useEffect(() => {
    invoke<ChatHistory>("load_chat_history", { session_id: null }).then((history) => {
      if (history?.sessionId && history?.messages?.length > 0) {
        chatIdRef.current = history.sessionId;
        setMessages(history.messages as ChatMessage[]);
      }
    }).catch(() => {});
    refreshHistoryList();
  }, []);

  // 追加单条消息到 JSONL 文件
  const appendQueue = useRef(Promise.resolve());
  function appendMessage(msg: ChatMessage) {
    const serializable = {
      role: msg.role,
      nodes: msg.nodes.map((n) => {
        if (n.type === "skill") {
          const { startTime, ...rest } = n;
          return rest;
        }
        return n;
      }),
      ...(msg.elapsedMs ? { elapsedMs: msg.elapsedMs } : {}),
    };
    appendQueue.current = appendQueue.current
      .then(() =>
        invoke<string>("save_chat_history", {
          sessionId: chatIdRef.current,
          message: serializable,
        })
      )
      .then((sid) => {
        if (sid) chatIdRef.current = sid;
      })
      .catch(() => {});
  }

  // 保存当前 assistant 消息（用于 run 结束时）
  function saveCurrentAssistant() {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === "assistant") {
        appendMessage(last);
      }
      return prev;
    });
  }

  // 自动滚动：消息数量变化时滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // 清理监听器
  useEffect(() => {
    return () => {
      unlistenRef.current?.();
    };
  }, []);

  // ===== 发送逻辑 =====

  async function handleSend() {
    const text = input.trim();
    if (!text || isLoading) return;
    doSend(text);
  }

  async function doSend(text: string) {
    setFailedMessageText(null);
    lastSentTextRef.current = text;
    const now = Date.now();
    const userMessage: ChatMessage = { role: "user", nodes: [{ type: "text", content: text }] };
    const assistantMessage: ChatMessage = {
      role: "assistant",
      nodes: [],
      isStreaming: true,
      runStartTime: now,
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput("");
    setIsLoading(true);

    // 立即保存用户消息
    appendMessage(userMessage);

    // 构建历史消息（只发文本）
    const llmMessages: LlmMessage[] = [...messages, userMessage]
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role,
        content: getMessageText(m.nodes) || undefined,
      }));

    try {
      const unlisten = await listen<LlmChatEvent>(
        "llm-chat-event",
        (event) => {
          const data = event.payload;
          if (data.jobId && data.jobId !== jobIdRef.current) return;

          switch (data.type) {
            case "run_started":
              break;

            case "message_delta":
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === "assistant") {
                  const nodes = [...last.nodes];
                  const lastNode = nodes[nodes.length - 1];
                  if (lastNode?.type === "text") {
                    // 拼接到最后一个 text node
                    nodes[nodes.length - 1] = {
                      ...lastNode,
                      content: lastNode.content + (data.content || ""),
                    };
                  } else {
                    // 新建 text node
                    nodes.push({ type: "text", content: data.content || "" });
                  }
                  next[next.length - 1] = { ...last, nodes };
                }
                return next;
              });
              break;

            case "skill_started":
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === "assistant") {
                  const nodes = [...last.nodes];
                  nodes.push({
                    type: "skill",
                    callId: data.callId || "",
                    skillName: data.skillName || "unknown",
                    title: data.title || getSkillVerb(data.skillName || ""),
                    status: "running",
                    startTime: Date.now(),
                  });
                  next[next.length - 1] = { ...last, nodes };
                }
                return next;
              });
              break;

            case "skill_completed":
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === "assistant") {
                  const nodes = last.nodes.map((n) =>
                    n.type === "skill" && n.callId === data.callId
                      ? { ...n, status: "done" as const, summary: data.summary || "" }
                      : n
                  );
                  next[next.length - 1] = { ...last, nodes };
                }
                return next;
              });
              // 工具调用完成，保存一次
              saveCurrentAssistant();
              break;

            case "skill_loaded":
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === "assistant") {
                  const nodes = [...last.nodes];
                  nodes.push({
                    type: "skill_loaded",
                    skillName: data.skillName || "",
                    title: data.title || `已加载 ${data.skillName}`,
                  });
                  next[next.length - 1] = { ...last, nodes };
                }
                return next;
              });
              break;

            case "consent_required":
              setPendingConsent({
                skillName: data.skillName || "",
                copy: data.copy || "需要授权访问个人数据",
                request: data.consentRequest,
              });
              break;

            case "data_access_summary":
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === "assistant") {
                  const records = data.accessRecords || [];
                  if (records.length === 0) return next;
                  const nodes = [...last.nodes];
                  nodes.push({
                    type: "data_access_summary",
                    summary: data.summary || "本轮数据读取已完成",
                    records,
                  });
                  next[next.length - 1] = { ...last, nodes };
                }
                return next;
              });
              break;

            case "ask_user_required":
              setPendingAskUser({
                callId: data.callId || "",
                question: data.question || "需要你的输入",
                options: data.options || undefined,
                responseType: data.responseType || "free_text",
              });
              setAskUserSelection(null);
              setAskUserFreeTextMode(false);
              // 在消息流中插入 AskUserNode
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === "assistant") {
                  const nodes = [...last.nodes];
                  nodes.push({
                    type: "ask_user",
                    callId: data.callId || "",
                    question: data.question || "需要你的输入",
                    options: data.options || undefined,
                  });
                  next[next.length - 1] = { ...last, nodes };
                }
                return next;
              });
              break;

            case "suggest_report":
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === "assistant") {
                  const nodes = [...last.nodes];
                  nodes.push({
                    type: "suggest_report",
                    summary: data.content || "数据分析已完成",
                  });
                  next[next.length - 1] = { ...last, nodes };
                }
                return next;
              });
              break;

            case "report_saved":
              setMessages((prev) => {
                const next = [...prev];
                const lastIdx = next.length - 1;
                const last = next[lastIdx];
                if (last?.role === "assistant") {
                  // 移除旧的 report_saved 节点，只保留最新的
                  const nodes: ChatNode[] = last.nodes.filter((n) => n.type !== "report_saved");
                  nodes.push({
                    type: "report_saved",
                    title: data.title || "阅读报告",
                    filePath: data.filePath || "",
                  });
                  next[lastIdx] = { ...last, nodes };
                }
                return next;
              });
              break;

            case "run_completed":
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === "assistant" && last.isStreaming) {
                  const elapsedMs = last.runStartTime ? Date.now() - last.runStartTime : undefined;
                  next[next.length - 1] = { ...last, isStreaming: false, elapsedMs };
                }
                return next;
              });
              // 最终保存
              saveCurrentAssistant();
              setIsLoading(false);
              setJobId(null);
              jobIdRef.current = null;
              unlisten();
              break;

            case "run_failed":
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === "assistant") {
                  const nodes = [...last.nodes];
                  nodes.push({ type: "text", content: `\n\n**错误：** ${data.error || "未知错误"}` });
                  const elapsedMs = last.runStartTime ? Date.now() - last.runStartTime : undefined;
                  next[next.length - 1] = { ...last, nodes, isStreaming: false, elapsedMs };
                }
                return next;
              });
              saveCurrentAssistant();
              setIsLoading(false);
              setFailedMessageText(lastSentTextRef.current || null);
              setJobId(null);
              jobIdRef.current = null;
              unlisten();
              break;

            case "run_canceled":
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === "assistant") {
                  const nodes = [...last.nodes];
                  nodes.push({ type: "text", content: "\n\n*（已取消）*" });
                  const elapsedMs = last.runStartTime ? Date.now() - last.runStartTime : undefined;
                  next[next.length - 1] = { ...last, nodes, isStreaming: false, elapsedMs };
                }
                return next;
              });
              saveCurrentAssistant();
              setIsLoading(false);
              setJobId(null);
              jobIdRef.current = null;
              unlisten();
              break;
          }
        }
      );
      unlistenRef.current = unlisten;

      const request: { messages: LlmMessage[]; systemPrompt?: string } = {
        messages: llmMessages,
      };

      const newJobId = await invoke<string>("start_llm_chat", { request });
      setJobId(newJobId);
      jobIdRef.current = newJobId;
    } catch (e) {
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === "assistant") {
          const nodes = [...last.nodes];
          nodes.push({ type: "text", content: `**请求失败：** ${String(e)}` });
          next[next.length - 1] = { ...last, nodes, isStreaming: false };
        }
        return next;
      });
      setIsLoading(false);
      setFailedMessageText(lastSentTextRef.current || null);
    }
  }

  async function handleCancel() {
    if (!jobId) return;
    try {
      await invoke("cancel_llm_chat", { jobId });
    } catch {
      // ignore
    }
  }

  function handleRetry() {
    const text = failedMessageText;
    if (!text || isLoading) return;
    // 移除最后一条错误消息（assistant 的 error node），保留之前的内容
    setMessages((prev) => {
      const next = [...prev];
      // 找到最后一条 assistant 消息，移除包含错误的 text node
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i].role === "assistant") {
          const filteredNodes = next[i].nodes.filter(
            (n) => !(n.type === "text" && (n.content.includes("**错误：**") || n.content.includes("**请求失败：**")))
          );
          next[i] = { ...next[i], nodes: filteredNodes };
          break;
        }
      }
      return next;
    });
    doSend(text);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleCopyMessage(nodes: ChatNode[], idx: number) {
    try {
      await navigator.clipboard.writeText(getMessageText(nodes));
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
    } catch {
      // ignore
    }
  }

  function handleClearChat() {
    refreshHistoryList();
    invoke("clear_conversation_consents").catch(() => {});
    chatIdRef.current = "";
    setMessages([]);
  }

  async function handleLoadHistory(sid: string) {
    try {
      const history = await invoke<ChatHistory>("load_chat_history", { session_id: sid });
      if (history?.sessionId && history?.messages) {
        chatIdRef.current = history.sessionId;
        setMessages(history.messages as ChatMessage[]);
      }
    } catch {}
    setShowSidebar(false);
  }

  async function handleConsentGrant(skillName: string, scope: "once" | "session" | "app") {
    setPendingConsent(null);
    if (!jobIdRef.current) return;
    try {
      await invoke("grant_consent", {
        jobId: jobIdRef.current,
        apiName: skillName,
        scope,
      });
    } catch (e) {
      console.error("Failed to grant consent:", e);
    }
  }

  function handleConsentDeny() {
    setPendingConsent(null);
    if (!jobIdRef.current) return;
    invoke("deny_consent", { jobId: jobIdRef.current }).catch(() => {});
  }

  // 快捷键：Y 批准 / N 拒绝
  useEffect(() => {
    if (!pendingConsent) return;
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "y" || e.key === "Y") {
        e.preventDefault();
        handleConsentGrant(pendingConsent!.skillName, "once");
      } else if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        handleConsentDeny();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingConsent]);

  async function handleAskUserSubmit(response: string) {
    const callId = pendingAskUser?.callId;
    setPendingAskUser(null);
    setAskUserSelection(null);
    setAskUserFreeTextMode(false);
    // 更新消息流中的 AskUserNode，填入答案
    if (callId) {
      setMessages((prev) => {
        const next = [...prev];
        for (let mi = next.length - 1; mi >= 0; mi--) {
          const msg = next[mi];
          if (msg.role !== "assistant") continue;
          const nodes = [...msg.nodes];
          let found = false;
          for (let ni = nodes.length - 1; ni >= 0; ni--) {
            const n = nodes[ni];
            if (n.type === "ask_user" && (n as any).callId === callId && !(n as any).answer) {
              nodes[ni] = { ...n, answer: response } as any;
              found = true;
              break;
            }
          }
          if (found) {
            next[mi] = { ...msg, nodes };
            break;
          }
        }
        return next;
      });
    }
    if (!jobIdRef.current) return;
    try {
      await invoke("respond_ask_user", {
        jobId: jobIdRef.current,
        response,
      });
    } catch (e) {
      console.error("Failed to respond ask_user:", e);
    }
  }

  function handleSuggestReportClick() {
    // 标记已处理，隐藏按钮
    setMessages((prev) => {
      const next = [...prev];
      for (let mi = next.length - 1; mi >= 0; mi--) {
        const msg = next[mi];
        if (msg.role !== "assistant") continue;
        const nodes = [...msg.nodes];
        let found = false;
        for (let ni = nodes.length - 1; ni >= 0; ni--) {
          const n = nodes[ni];
          if (n.type === "suggest_report" && !(n as any).dismissed) {
            nodes[ni] = { ...n, dismissed: true } as any;
            found = true;
            break;
          }
        }
        if (found) {
          next[mi] = { ...msg, nodes };
          break;
        }
      }
      return next;
    });
    // 发送确认消息，触发报告流程
    doSend("好的，帮我生成这份可视化报告。");
  }

  function consentPurposeText(copy: string) {
    return copy.replace(/\s*—\s*需要你的授权\s*$/, "").trim();
  }

  function consentFallbackText(consent: { copy: string; request?: ConsentRequest | null }) {
    if (consent.request) {
      return `${consent.request.purpose}。${consent.request.readDescription}${consent.request.destinationDescription}你也可以拒绝，${consent.request.denialEffect}`;
    }
    return `这次读取：${consentPurposeText(consent.copy)}。内容会发送到你配置的 AI 服务用于分析，不会发送到书迹服务器。你也可以拒绝，我会只用统计和笔记概览继续分析。`;
  }

  // 快捷键：数字键选择选项 / Enter 提交自由文本
  useEffect(() => {
    if (!pendingAskUser) return;
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (askUserFreeTextMode) return;
      const opts = pendingAskUser!.options;
      if (opts && opts.length > 0) {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= opts.length) {
          e.preventDefault();
          const selected = opts[num - 1];
          if (selected.label === "其他/备注") {
            setAskUserFreeTextMode(true);
          } else {
            handleAskUserSubmit(selected.label);
          }
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingAskUser, askUserFreeTextMode]);

  // ===== 未配置 LLM 时的空态 =====

  if (!settings.llmConfigured) {
    return (
      <PageShell title="AI 对话">
        <EmptyState
          title="先配置 AI 服务"
          description="需要先配置你自己的 AI 服务，才能使用 AI 对话和阅读报告功能。"
          action={
            <Link to="/settings">
              <Button variant="primary">去设置</Button>
            </Link>
          }
        />
      </PageShell>
    );
  }

  // ===== 渲染 =====

  return (
    <PageShell
      title="AI 对话"
      subtitle="使用你自己的 AI 服务分析阅读记录、生成阅读报告"
      actions={
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <Button
            variant="ghost"
            size="small"
            onClick={() => setShowSidebar((v) => !v)}
          >
            {showSidebar ? "隐藏历史" : "历史"}
          </Button>
          {messages.length > 0 && (
            <Button variant="secondary" size="small" onClick={handleClearChat}>
              新对话
            </Button>
          )}
        </div>
      }
    >
      <div className="chat-layout">
        {showSidebar && (
          <div className="chat-sidebar">
            <div className="chat-sidebar-header">
              <span>历史对话</span>
              <div className="chat-ask-hint">对话记录保存在本机</div>
            </div>
            <div className="chat-sidebar-list">
              {chatHistories.length === 0 ? (
                <div className="chat-sidebar-empty">暂无历史记录</div>
              ) : (
                chatHistories.map((h) => (
                  <button
                    key={h.sessionId}
                    type="button"
                    className={`chat-sidebar-item ${h.sessionId === chatIdRef.current ? "chat-sidebar-active" : ""}`}
                    onClick={() => handleLoadHistory(h.sessionId)}
                  >
                    <span className="chat-sidebar-date">{formatHistoryDate(h.updatedAt || h.date || "")}</span>
                    <span className="chat-sidebar-count">{h.messageCount} 条消息</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        <div className="chat-container">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <Bot size={48} strokeWidth={1.2} />
            <h3>书迹 AI 助手</h3>
            <p>连接你自己的 AI 服务后，我可以帮你分析阅读数据、生成阅读报告。对话记录保存在本机。</p>
            <div className="chat-suggestions">
              {["帮我看看今年读了多久", "分析我的阅读偏好", "我读过的书里哪些做了笔记？", "基于我的记录给阅读建议"].map((s) => (
                <button key={s} type="button" className="chat-suggestion-btn" onClick={() => { setInput(s); inputRef.current?.focus(); }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="chat-messages">
            {messages.map((msg, idx) => {
              const textContent = getMessageText(msg.nodes);
              const hasNodes = msg.nodes.length > 0;

              return (
                <div key={idx} className={`chat-message chat-message-${msg.role}`}>
                  <div className="chat-message-body">
                    {/* user 消息直接渲染文本 */}
                    {msg.role === "user" && (
                      <div className="chat-message-content">{textContent}</div>
                    )}

                    {/* assistant 消息：遍历 nodes 交织渲染 */}
                    {msg.role === "assistant" && (
                      <div className="chat-message-content chat-markdown">
                        {!hasNodes && msg.isStreaming ? (
                          <span className="chat-thinking-shimmer">正在思考</span>
                        ) : (
                          (() => {
                            const rendered: React.ReactNode[] = [];
                            let i = 0;
                            let askUserIdx = 0;
                            const allDoneSkillsInMsg: any[] = [];

                            while (i < msg.nodes.length) {
                              const node = msg.nodes[i];

                              if (node.type === "skill") {
                                // 收集连续 skill 节点
                                const groupStart = i;
                                let runningNode: any = null;
                                while (i < msg.nodes.length && msg.nodes[i].type === "skill") {
                                  const s = msg.nodes[i] as any;
                                  if (s.status === "done") { allDoneSkillsInMsg.push(s); }
                                  if (s.status === "running") runningNode = s;
                                  i++;
                                }

                                // 跳过纯已完成的 group，只在有 running 时才渲染
                                if (!runningNode) {
                                  // 纯已完成 group，不单独渲染行，等最后统一输出
                                  continue;
                                }

                                const isExpanded = expandedActions.has(String(groupStart));
                                rendered.push(
                                  <div key={`skills-${groupStart}`} className="chat-action-block">
                                    <button
                                      type="button"
                                      className="chat-action-line"
                                      onClick={() => setExpandedActions((prev) => {
                                        const next = new Set(prev);
                                        const k = String(groupStart);
                                        if (next.has(k)) next.delete(k);
                                        else next.add(k);
                                        return next;
                                      })}
                                    >
                                      <span className={`chat-action-chevron ${isExpanded ? "chat-action-chevron-open" : ""}`}>
                                        <ChevronDown size={12} />
                                      </span>
                                      <span className="chat-action-current chat-skill-shimmer">
                                        {runningNode.title}
                                      </span>
                                    </button>
                                  </div>
                                );
                                continue;
                              }

                              // 遇到文本：先输出已完成的总结，再输出文本，然后重置累计
                              if (node.type === "text") {
                                if (allDoneSkillsInMsg.length > 0) {
                                  const sectionDone = allDoneSkillsInMsg.splice(0);
                                  const key = `summary-${sectionDone.length}`;
                                  const isExpanded = expandedActions.has(key);
                                  rendered.push(
                                    <div key={key} className="chat-action-block">
                                      <button
                                        type="button"
                                        className="chat-action-line"
                                        onClick={() => setExpandedActions((prev) => {
                                          const next = new Set(prev);
                                          if (next.has(key)) next.delete(key);
                                          else next.add(key);
                                          return next;
                                        })}
                                      >
                                        <span className={`chat-action-chevron ${isExpanded ? "chat-action-chevron-open" : ""}`}>
                                          <ChevronDown size={12} />
                                        </span>
                                        <span className="chat-action-summary">
                                          已完成 {sectionDone.length} 次数据查询
                                        </span>
                                      </button>
                                      {isExpanded && (
                                        <div className="chat-action-details">
                                          {sectionDone.map((s: any, di: number) => (
                                            <span key={di} className="chat-action-detail-item">{s.title}</span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                }
                                if (!(node as any).content) { i++; continue; }
                                rendered.push(
                                  <ReactMarkdown key={`text-${i}`} components={markdownComponents} remarkPlugins={[remarkGfm]}>
                                    {(node as any).content.replace(/\n{3,}/g, "\n\n")}
                                  </ReactMarkdown>
                                );
                                i++;
                              } else if (node.type === "consent") {
                                // consent 不在消息流中显示，由微弹窗处理
                                i++;
                              } else if (node.type === "ask_user") {
                                const askNode = node as any;
                                askUserIdx++;
                                rendered.push(
                                  <div key={`ask-${i}`} className="chat-ask-inline">
                                    <span className="chat-ask-inline-num">{askUserIdx}</span>
                                    <span className="chat-ask-inline-q">{askNode.question}</span>
                                    {askNode.answer && (
                                      <span className="chat-ask-inline-a">{askNode.answer}</span>
                                    )}
                                  </div>
                                );
                                i++;
                              } else if (node.type === "suggest_report") {
                                const srNode = node as any;
                                if (!srNode.dismissed) {
                                  rendered.push(
                                    <div key={`sr-${i}`} className="chat-suggest-report">
                                      <span className="chat-suggest-report-text">{srNode.summary}</span>
                                      <button
                                        type="button"
                                        className="chat-suggest-report-btn"
                                        onClick={handleSuggestReportClick}
                                      >
                                        生成报告
                                      </button>
                                    </div>
                                  );
                                }
                                i++;
                              } else if (node.type === "report_saved") {
                                // 报告卡片在消息流结束后单独渲染
                                i++;
                              } else if (node.type === "skill_loaded") {
                                const slNode = node as SkillLoadedNode;
                                rendered.push(
                                  <div key={`sl-${i}`} className="chat-skill-loaded">
                                    <span className="chat-skill-loaded-icon">+</span>
                                    <span className="chat-skill-loaded-text">{slNode.title}</span>
                                  </div>
                                );
                                i++;
                              } else if (node.type === "data_access_summary") {
                                const accessNode = node as DataAccessSummaryNode;
                                const rawRead = accessNode.records.some((record) => record.containsRawText && record.status === "completed");
                                rendered.push(
                                  <div key={`access-${i}`} className="chat-action-block">
                                    <div className="chat-action-line">
                                      <span className="chat-action-summary">{accessNode.summary}</span>
                                    </div>
                                    <div className="chat-action-details">
                                      <span className="chat-action-detail-item">
                                        {rawRead ? "已按你的确认读取私人阅读内容" : "未读取划线或想法原文"}
                                      </span>
                                      <span className="chat-action-detail-item">发送到你配置的 AI 服务用于分析</span>
                                    </div>
                                  </div>
                                );
                                i++;
                              } else {
                                i++;
                              }
                            }
                            // 如果有已完成的 action，输出一次总结
                            if (allDoneSkillsInMsg.length > 0) {
                              const finalKey = `final-${allDoneSkillsInMsg.length}`;
                              const isExpanded = expandedActions.has(finalKey);
                              rendered.push(
                                <div key="skills-final" className="chat-action-block">
                                  <button
                                    type="button"
                                    className="chat-action-line"
                                    onClick={() => setExpandedActions((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(finalKey)) next.delete(finalKey);
                                      else next.add(finalKey);
                                      return next;
                                    })}
                                  >
                                    <span className={`chat-action-chevron ${isExpanded ? "chat-action-chevron-open" : ""}`}>
                                      <ChevronDown size={12} />
                                    </span>
                                    <span className="chat-action-summary">
                                      已完成 {allDoneSkillsInMsg.length} 次数据查询
                                    </span>
                                  </button>
                                  {isExpanded && (
                                    <div className="chat-action-details">
                                      {allDoneSkillsInMsg.map((s: any, di: number) => (
                                        <span key={di} className="chat-action-detail-item">
                                          {s.title}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            // 只在最后一个有报告的 assistant 消息上渲染卡片
                            const reports = msg.nodes.filter((n) => n.type === "report_saved") as any[];
                            const isLastWithReport = reports.length > 0 && (() => {
                              for (let k = idx + 1; k < messages.length; k++) {
                                if (messages[k].role === "assistant" &&
                                    messages[k].nodes.some((n) => n.type === "report_saved")) {
                                  return false;
                                }
                              }
                              return true;
                            })();
                            if (isLastWithReport) {
                              for (const r of reports) {
                                rendered.push(
                                  <div key={`report-${r.filePath}`} className="chat-product-card">
                                    <div className="chat-product-icon"><FileText size={16} /></div>
                                    <div className="chat-product-info">
                                      <span className="chat-product-title">{r.title || "阅读报告"}</span>
                                    </div>
                                    <button
                                      type="button"
                                      className="chat-product-open"
                                      onClick={() => invoke("open_report_file", { path: r.filePath })}
                                    >
                                      打开
                                    </button>
                                    <button
                                      type="button"
                                      className="chat-product-open"
                                      onClick={() => invoke("open_report_folder", { path: r.filePath })}
                                    >
                                      文件夹
                                    </button>
                                  </div>
                                );
                              }
                            }
                            return rendered;
                          })()
                        )}
                        {msg.isStreaming && hasNodes && (
                          <span className="chat-thinking-shimmer">正在思考</span>
                        )}
                        {/* 耗时 */}
                        {msg.elapsedMs && (
                          <div className="chat-turn-elapsed">{formatElapsed(msg.elapsedMs)}</div>
                        )}
                      </div>
                    )}

                    {/* 复制按钮 */}
                    {msg.role === "assistant" && !msg.isStreaming && textContent && (
                      <button
                        type="button"
                        className="chat-copy-btn"
                        onClick={() => handleCopyMessage(msg.nodes, idx)}
                        title="复制"
                      >
                        {copiedIdx === idx ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}


        {/* askUser 风格：授权询问 */}
        {pendingConsent && (
          <div className="chat-ask-user">
            <div className="chat-ask-header">
              <div className="chat-ask-icon">
                <Shield size={14} />
              </div>
	              <div>
	                <span className="chat-ask-question">{pendingConsent.request?.title || "确认读取笔记内容"}</span>
	                <div className="chat-ask-hint">
	                  {consentFallbackText(pendingConsent)}
	                </div>
              </div>
            </div>
            <div className="chat-ask-list">
              <button
                type="button"
                className="chat-ask-item chat-ask-item-approve"
                onClick={() => handleConsentGrant(pendingConsent.skillName, "once")}
              >
                <span className="chat-ask-item-icon">
                  <Check size={14} />
                </span>
                <div className="chat-ask-item-body">
                  <span className="chat-ask-item-label">仅本次</span>
                  <span className="chat-ask-item-desc">只允许这一次读取，下次还会询问。</span>
                </div>
                <span className="chat-ask-kbd">Y</span>
              </button>
              <button
                type="button"
                className="chat-ask-item"
                onClick={() => handleConsentGrant(pendingConsent.skillName, "session")}
              >
                <span className="chat-ask-item-icon">
                  <Check size={14} />
                </span>
                <div className="chat-ask-item-body">
                  <span className="chat-ask-item-label">本次对话</span>
                  <span className="chat-ask-item-desc">这段对话里读取同类内容时不再询问。</span>
                </div>
              </button>
              <button
                type="button"
                className="chat-ask-item"
                onClick={() => handleConsentGrant(pendingConsent.skillName, "app")}
              >
                <span className="chat-ask-item-icon">
                  <Check size={14} />
                </span>
                <div className="chat-ask-item-body">
                  <span className="chat-ask-item-label">本次打开期间</span>
                  <span className="chat-ask-item-desc">关闭书迹前，读取同类内容时不再询问。</span>
                </div>
              </button>
              <button
                type="button"
                className="chat-ask-item chat-ask-item-deny"
                onClick={handleConsentDeny}
              >
                <span className="chat-ask-item-icon">
                  <X size={14} />
                </span>
	                <div className="chat-ask-item-body">
	                  <span className="chat-ask-item-label">不读取</span>
	                  <span className="chat-ask-item-desc">跳过这次读取，继续用统计和笔记概览分析。</span>
	                </div>
                <span className="chat-ask-kbd">N</span>
              </button>
            </div>
          </div>
        )}

        {/* ask_user：通用提问 */}
        {pendingAskUser && (
          <div className="chat-ask-user">
            <div className="chat-ask-header">
              <div className="chat-ask-icon">
                <Bot size={14} />
              </div>
              <span className="chat-ask-question">{pendingAskUser.question}</span>
            </div>
            {pendingAskUser.options && pendingAskUser.options.length > 0 && !askUserFreeTextMode ? (
              <div className="chat-ask-list">
                {pendingAskUser.options.map((opt, i) => {
                  const isOther = opt.label === "其他/备注";
                  return (
                    <button
                      key={i}
                      type="button"
                      className={`chat-ask-item ${askUserSelection === i ? "chat-ask-item-selected" : ""}`}
                      onClick={() => {
                        if (isOther) {
                          setAskUserFreeTextMode(true);
                        } else {
                          setAskUserSelection(i);
                          handleAskUserSubmit(opt.label);
                        }
                      }}
                    >
                      <div className="chat-ask-item-body">
                        <span className="chat-ask-item-label">{opt.label}</span>
                        {opt.description && (
                          <span className="chat-ask-item-desc">{opt.description}</span>
                        )}
                      </div>
                      {!isOther && <span className="chat-ask-kbd">{i + 1}</span>}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="chat-ask-free-text">
                <textarea
                  className="chat-ask-textarea"
                  placeholder="输入你的回答..."
                  rows={2}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      const val = (e.target as HTMLTextAreaElement).value.trim();
                      if (val) handleAskUserSubmit(val);
                    }
                  }}
                />
                <div className="chat-ask-free-hint">按 Enter 发送，Shift+Enter 换行</div>
              </div>
            )} 
          </div>
        )}

        {failedMessageText && !isLoading && (
          <div className="chat-retry-bar">
            <span className="chat-retry-text">上一次请求失败</span>
            <button
              type="button"
              className="chat-retry-btn"
              onClick={handleRetry}
            >
              <RotateCw size={13} />
              <span>重试</span>
            </button>
          </div>
        )}

        <div className="chat-input-bar">
          <textarea
            ref={inputRef}
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息，按 Enter 发送，Shift+Enter 换行"
            rows={1}
            inputMode="text"
            disabled={isLoading}
          />
          {isLoading ? (
            <Button variant="danger" size="small" icon={<Square size={14} />} onClick={handleCancel}>
              停止
            </Button>
          ) : (
            <Button variant="primary" size="small" icon={<Send size={14} />} disabled={!input.trim()} onClick={handleSend}>
              发送
            </Button>
          )}
        </div>
      </div>
      </div>
    </PageShell>
  );
}
