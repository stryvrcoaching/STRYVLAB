interface CircularProgressProps {
    value: number; // 0-100
    size?: number;
  }
  
  export function CircularProgress({ value, size = 180 }: CircularProgressProps) {
    const strokeWidth = 12;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (value / 100) * circumference;
  
    const getColor = (score: number) => {
      if (score >= 75) return '#10b981'; // emerald-500
      if (score >= 60) return '#22c55e'; // green-500
      if (score >= 45) return '#f59e0b'; // orange-500
      if (score >= 30) return '#ef4444'; // red-500
      return '#dc2626'; // red-600
    };
  
    return (
      <div className="relative inline-flex items-center justify-center">
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#e2e8f0"
            strokeWidth={strokeWidth}
            fill="none"
          />
          
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={getColor(value)}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
            style={{
              filter: `drop-shadow(0 0 8px ${getColor(value)}40)`,
            }}
          />
        </svg>
        
        {/* Score au centre */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-5xl font-bold text-slate-900 tabular-nums">
            {value}
          </span>
          <span className="text-sm text-slate-500 font-medium">/100</span>
        </div>
      </div>
    );
  }