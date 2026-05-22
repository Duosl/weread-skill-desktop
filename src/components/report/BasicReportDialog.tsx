import { Eye, X } from "lucide-react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { IconButton } from "../ui/IconButton";
import { Spinner } from "../ui/Spinner";
import { ReportTemplate } from "../../lib/report/templates";
import type { ReadingReportData, ReportPeriod, ReportTemplateId } from "../../lib/report/types";

type BasicReportTemplate = {
  id: ReportTemplateId;
  name: string;
  tagline: string;
  description: string;
};

type PeriodOption = {
  value: ReportPeriod;
  label: string;
};

type BasicReportDialogProps = {
  template: BasicReportTemplate;
  templateId: ReportTemplateId;
  data: ReadingReportData | null;
  loading: boolean;
  openingReport: boolean;
  selectedPeriod: ReportPeriod;
  periodOptions: PeriodOption[];
  onPeriodChange: (period: ReportPeriod) => void;
  onPreview: () => void;
  onClose: () => void;
};

export function BasicReportDialog({
  template,
  templateId,
  data,
  loading,
  openingReport,
  selectedPeriod,
  periodOptions,
  onPeriodChange,
  onPreview,
  onClose,
}: BasicReportDialogProps) {
  return (
    <div
      className="report-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="report-modal task-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${template.name}预览`}
      >
        <header className="report-modal-header">
          <div>
            <Badge>{template.tagline}</Badge>
            <h2>{template.name}</h2>
            <p>{template.description}</p>
          </div>
          <IconButton aria-label="关闭" icon={<X size={18} />} onClick={onClose} />
        </header>

        <div className="report-modal-body">
          <div className="report-modal-preview">
            {loading && !data ? (
              <Card>
                <Spinner label="正在生成报告数据" />
              </Card>
            ) : data ? (
              <ReportTemplate id={templateId} data={data} />
            ) : (
              <EmptyState title="等待生成报告" description="选择时间范围后会自动整理阅读统计。" />
            )}
          </div>

          <aside className="report-modal-actions">
            <div>
              <span>数据时间范围</span>
              <select
                className="report-period-select"
                value={selectedPeriod}
                onChange={(event) => onPeriodChange(event.target.value as ReportPeriod)}
              >
                {periodOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <Button
              variant="primary"
              icon={<Eye size={16} />}
              disabled={!data || openingReport}
              onClick={onPreview}
            >
              浏览器打开
            </Button>
            {openingReport ? <Spinner label="正在打开报告" /> : null}
          </aside>
        </div>
      </section>
    </div>
  );
}
