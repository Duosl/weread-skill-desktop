/* ==========================================================================
   交流与支持弹窗 - 分别展示交流群与赞赏码
   ========================================================================== */

import { type ReactNode, useEffect } from "react";
import { Heart, MessageCircle, X } from "lucide-react";
import { IconButton } from "./ui/IconButton";
import wechatRewardUrl from "../assets/reward-wechat.png";
import alipayRewardUrl from "../assets/reward-alipay.png";
import wechatGroupUrl from "../../docs/images/wechat-group-qrcode.jpg";
import wechatPersonalUrl from "../../docs/images/wechat-personal-qrcode.jpg";

type QrChannel = {
  key: string;
  label: string;
  hint: string;
  imageUrl: string;
  alt: string;
};

type QrDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  tone: "community" | "support";
  icon: ReactNode;
  title: string;
  kicker: string;
  heading: string;
  description: string;
  note: string;
  channels: QrChannel[];
  closeLabel: string;
};

const communityChannels: QrChannel[] = [
  {
    key: "group",
    label: "交流群",
    hint: "扫码加入交流群",
    imageUrl: wechatGroupUrl,
    alt: "交流群二维码",
  },
  {
    key: "personal",
    label: "个人微信",
    hint: "群码失效可加我",
    imageUrl: wechatPersonalUrl,
    alt: "个人微信二维码",
  },
];

const supportChannels: QrChannel[] = [
  {
    key: "wechat",
    label: "微信",
    hint: "微信扫一扫",
    imageUrl: wechatRewardUrl,
    alt: "微信收款码",
  },
  {
    key: "alipay",
    label: "支付宝",
    hint: "支付宝扫一扫",
    imageUrl: alipayRewardUrl,
    alt: "支付宝收款码",
  },
];

function QrDialog({
  isOpen,
  onClose,
  tone,
  icon,
  title,
  kicker,
  heading,
  description,
  note,
  channels,
  closeLabel,
}: QrDialogProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="reward-overlay" onClick={onClose}>
      <section
        className={`reward-modal reward-modal-${tone}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reward-title"
        onClick={(event) => event.stopPropagation()}
      >
        <IconButton
          className="reward-close-btn"
          icon={<X size={17} strokeWidth={1.8} />}
          onClick={onClose}
          aria-label={closeLabel}
        />

        <div className="reward-header">
          <span className="reward-mark" aria-hidden="true">
            {icon}
          </span>
          <div>
            <p className="reward-kicker">{kicker}</p>
            <h2 id="reward-title">{title}</h2>
          </div>
        </div>

        <div className="reward-section">
          <div className="reward-section-heading">
            <h3>{heading}</h3>
            <p>{description}</p>
          </div>
          <div className="reward-code-grid">
            {channels.map((channel) => (
              <figure
                className={`reward-code-card reward-code-${channel.key}`}
                key={channel.key}
              >
                <div className="reward-code-frame">
                  <img src={channel.imageUrl} alt={channel.alt} />
                </div>
                <figcaption>
                  <strong>{channel.label}</strong>
                  <span>{channel.hint}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>

        <p className="reward-note">{note}</p>
      </section>
    </div>
  );
}

type DialogVisibilityProps = Pick<QrDialogProps, "isOpen" | "onClose">;

export function CommunityDialog(props: DialogVisibilityProps) {
  return (
    <QrDialog
      {...props}
      tone="community"
      icon={<MessageCircle size={22} strokeWidth={1.7} />}
      title="加入交流群"
      kicker="交流"
      heading="微信群与个人微信"
      description="获取使用帮助、反馈问题，也可以分享你的阅读工作流。"
      note="群二维码失效时，可添加个人微信并备注「书迹」。"
      channels={communityChannels}
      closeLabel="关闭交流弹窗"
    />
  );
}

export function SupportDialog(props: DialogVisibilityProps) {
  return (
    <QrDialog
      {...props}
      tone="support"
      icon={<Heart size={22} strokeWidth={1.7} />}
      title="请作者喝杯咖啡"
      kicker="支持"
      heading="赞赏支持"
      description="如果这个工具帮到了你，扫码赞赏就是很直接的鼓励。"
      note="谢谢你的支持，我们一起让书迹更快更好。"
      channels={supportChannels}
      closeLabel="关闭支持弹窗"
    />
  );
}
