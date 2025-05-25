interface ProgressBarProps {
  percentage: number;
  color?: string;
  height?: string;
}

export default function ProgressBar({
  percentage,
  color = "bg-primary",
  height = "h-2",
}: ProgressBarProps) {
  return (
    <div className={`w-full bg-gray-200 rounded-full ${height}`}>
      <div
        className={`${color} ${height} rounded-full transition-all duration-300`}
        style={{ width: `${Math.min(Math.max(percentage, 0), 100)}%` }}
      />
    </div>
  );
}
