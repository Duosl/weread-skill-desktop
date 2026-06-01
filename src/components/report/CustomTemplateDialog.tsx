import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "../ui/Button";
import type { CustomTemplate, CreateCustomTemplateRequest } from "../../types";

const OUTPUT_SHAPE_OPTIONS = [
  { value: "report", label: "通用网页" },
  { value: "slides", label: "PPT 风格" },
  { value: "xiaohongshu", label: "小红书图文" },
  { value: "free", label: "不限" },
];

type CustomTemplateDialogProps = {
  template?: CustomTemplate | null;
  onSave: (request: CreateCustomTemplateRequest) => Promise<void>;
  onClose: () => void;
};

export function CustomTemplateDialog({
  template,
  onSave,
  onClose,
}: CustomTemplateDialogProps) {
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [promptMd, setPromptMd] = useState(template?.promptMd ?? "");
  const [styleMd, setStyleMd] = useState(template?.styleMd ?? "");
  const [defaultOutputShape, setDefaultOutputShape] = useState(
    template?.defaultOutputShape ?? "report"
  );
  const [requiresRawNotesConsent, setRequiresRawNotesConsent] = useState(
    template?.requiresRawNotesConsent ?? false
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = Boolean(template);

  async function handleSave() {
    if (!name.trim()) {
      setError("请输入模板名称");
      return;
    }
    if (!promptMd.trim()) {
      setError("请写下你希望这份报告回答什么问题");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        promptMd: promptMd.trim(),
        styleMd: styleMd.trim() || null,
        defaultOutputShape,
        requiresRawNotesConsent,
        intent: {
          question: promptMd.trim(),
          useCase: description.trim(),
          outputUse: defaultOutputShape,
          tone: styleMd.trim(),
          rawTextPolicy: requiresRawNotesConsent ? "required" : "optional",
        },
      });
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="custom-template-dialog-overlay" onClick={onClose}>
      <div
        className="custom-template-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="custom-template-dialog-header">
          <h3>{isEdit ? "编辑报告模板" : "创建报告模板"}</h3>
          <button type="button" className="dialog-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="custom-template-dialog-body">
          {error && <div className="custom-template-error">{error}</div>}

          <div className="custom-template-field">
            <label>模板名称 *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：年度阅读复盘、亲子阅读观察"
            />
          </div>

          <div className="custom-template-field">
            <label>用途说明</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="告诉自己什么时候使用这个模板，例如：月底复盘、分享给朋友前检查重点"
            />
          </div>

          <div className="custom-template-field">
            <label>这份报告要回答什么 *</label>
            <textarea
              value={promptMd}
              onChange={(e) => setPromptMd(e.target.value)}
              placeholder={"例如：\n- 找出我最近最常记录想法的主题\n- 结合阅读时长、书籍类型和笔记数量，总结我的阅读习惯\n- 给出 3 条下个月可执行的阅读建议"}
              rows={8}
            />
            <span className="chat-ask-hint">
              可以像写给朋友的要求一样写，不需要懂 AI 指令。书迹会按模板读取必要的统计、书架或笔记内容。
            </span>
          </div>

          <div className="custom-template-field">
            <label>呈现偏好（可选）</label>
            <textarea
              value={styleMd}
              onChange={(e) => setStyleMd(e.target.value)}
              placeholder="例如：简洁一点，多用短段落；适合发给朋友；先给结论，再列证据。"
              rows={3}
            />
          </div>

          <div className="custom-template-field">
            <label>默认生成形式</label>
            <select
              value={defaultOutputShape}
              onChange={(e) => setDefaultOutputShape(e.target.value)}
            >
              {OUTPUT_SHAPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="custom-template-field custom-template-field-toggle">
            <label>
              <input
                type="checkbox"
                checked={requiresRawNotesConsent}
                onChange={(e) =>
                  setRequiresRawNotesConsent(e.target.checked)
                }
              />
              <span>这类报告通常需要读取相关划线或想法</span>
            </label>
            <span className="chat-ask-hint">
              开启后，生成前仍会向你说明读取用途；拒绝后只能使用统计和笔记概览继续分析。
            </span>
          </div>
        </div>

        <div className="custom-template-dialog-footer">
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="primary"
            disabled={saving || !name.trim() || !promptMd.trim()}
            onClick={handleSave}
          >
            {saving ? "保存中…" : isEdit ? "保存修改" : "创建模板"}
          </Button>
        </div>
      </div>
    </div>
  );
}
