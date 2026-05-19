/* ==========================================================================
   打赏弹窗 - 展示微信与支付宝收款码
   ========================================================================== */

import { useEffect } from "react";
import { Heart, X } from "lucide-react";
import wechatRewardUrl from "../assets/reward-wechat.png";
import alipayRewardUrl from "../assets/reward-alipay.png";

interface RewardDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const rewardChannels = [
  {
    key: "wechat",
    label: "微信",
    hint: "微信扫一扫",
    imageUrl: wechatRewardUrl,
  },
  {
    key: "alipay",
    label: "支付宝",
    hint: "支付宝扫一扫",
    imageUrl: alipayRewardUrl,
  },
];

export function RewardDialog({ isOpen, onClose }: RewardDialogProps) {
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
        className="reward-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reward-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="reward-close-btn"
          onClick={onClose}
          aria-label="关闭打赏弹窗"
        >
          <X size={17} strokeWidth={1.8} />
        </button>

        <div className="reward-header">
          <span className="reward-mark" aria-hidden="true">
            <Heart size={22} strokeWidth={1.7} />
          </span>
          <div>
            <p className="reward-kicker">支持 WeRead Skill Desktop</p>
            <h2 id="reward-title">请作者喝杯咖啡</h2>
          </div>
        </div>

        <div className="reward-code-grid">
          {rewardChannels.map((channel) => (
            <figure
              className={`reward-code-card reward-code-${channel.key}`}
              key={channel.key}
            >
              <div className="reward-code-frame">
                <img src={channel.imageUrl} alt={`${channel.label}收款码`} />
              </div>
              <figcaption>
                <span>{channel.hint}</span>
              </figcaption>
            </figure>
          ))}
        </div>

        <p className="reward-note">
          谢谢你的支持，我们一起让 WeRead Skill Desktop 更快更好。
        </p>
      </section>
    </div>
  );
}
