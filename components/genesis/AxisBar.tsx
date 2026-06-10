interface AxisBarProps {
    label: string;
    score: number; // 0-100
    weight: number; // 0-1
  }
  
  export function AxisBar({ label, score, weight }: AxisBarProps) {
    const getColor = (score: number) => {
      if (score >= 75) return 'bg-emerald-500';
      if (score >= 60) return 'bg-green-500';
      if (score >= 45) return 'bg-orange-500';
      if (score >= 30) return 'bg-red-500';
      return 'bg-red-600';
    };
  
    const getTextColor = (score: number) => {
      if (score >= 75) return 'text-emerald-700';
      if (score >= 60) return 'text-green-700';
      if (score >= 45) return 'text-orange-700';
      if (score >= 30) return 'text-red-700';
      return 'text-red-800';
    };
  
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">{label}</span>
            <span className="text-xs text-slate-400 font-medium">
              (poids: {(weight * 100).toFixed(0)}%)
            </span>
          </div>
          <span className={`text-sm font-bold tabular-nums ${getTextColor(score)}`}>
            {score}/100
          </span>
        </div>
        
        <div className="relative w-full h-3 bg-slate-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ease-out ${getColor(score)}`}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>
    );
  }