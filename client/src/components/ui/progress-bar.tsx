interface ProgressBarProps {
  percentage: number;
  color?: string;
  height?: string;
}

export default function ProgressBar({
  percentage,
  color = "#3B82F6", // Default blue color
  height = "h-2",
}: ProgressBarProps) {
  // Check if color is a CSS class or hex color
  const isHexColor = color.startsWith('#');
  const backgroundColor = isHexColor ? color : undefined;
  const cssClass = isHexColor ? '' : color;

  return (
    <div className={`w-full bg-gray-200 rounded-full ${height}`}>
      <div
        className={`${cssClass} ${height} rounded-full transition-all duration-300`}
        style={{ 
          width: `${Math.min(Math.max(percentage, 0), 100)}%`,
          backgroundColor: backgroundColor
        }}
      />
    </div>
  );
}
