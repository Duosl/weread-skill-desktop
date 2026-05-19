type SpinnerProps = {
  label?: string;
};

export function Spinner({ label = "加载中" }: SpinnerProps) {
  return (
    <span className="spinner-wrap" aria-live="polite">
      <span className="spinner" />
      <span>{label}</span>
    </span>
  );
}
