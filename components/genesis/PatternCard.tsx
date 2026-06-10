interface Pattern {
    id: string;
    label: string;
    severity: 'critical' | 'high' | 'moderate';
    constraints: string[];
    recommendations: string[];
  }
  
  interface PatternCardProps {
    pattern: Pattern;
  }
  
  export function PatternCard({ pattern }: PatternCardProps) {
    const getSeverityStyle = (severity: string) => {
      switch (severity) {
        case 'critical':
          return {
            badge: 'bg-red-100 border-red-300 text-red-800',
            icon: '🚨',
            border: 'border-red-200',
          };
        case 'high':
          return {
            badge: 'bg-orange-100 border-orange-300 text-orange-800',
            icon: '⚠️',
            border: 'border-orange-200',
          };
        case 'moderate':
          return {
            badge: 'bg-yellow-100 border-yellow-300 text-yellow-800',
            icon: '⚡',
            border: 'border-yellow-200',
          };
        default:
          return {
            badge: 'bg-slate-100 border-slate-300 text-slate-800',
            icon: 'ℹ️',
            border: 'border-slate-200',
          };
      }
    };
  
    const style = getSeverityStyle(pattern.severity);
  
    return (
      <div className={`border-2 ${style.border} rounded-xl p-5 bg-white/60 backdrop-blur-sm space-y-4`}>
        
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <h4 className="text-base font-semibold text-slate-900 mb-1">
              {pattern.label}
            </h4>
            <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-lg border ${style.badge}`}>
              {style.icon} {pattern.severity.toUpperCase()}
            </span>
          </div>
        </div>
  
        {/* Contraintes */}
        {pattern.constraints && pattern.constraints.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Contraintes identifiées
            </p>
            <ul className="space-y-1.5">
              {pattern.constraints.map((constraint, idx) => (
                <li key={idx} className="text-sm text-slate-700 flex items-start gap-2">
                  <span className="text-slate-400 flex-shrink-0">•</span>
                  <span>{constraint}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
  
        {/* Recommandations */}
        {pattern.recommendations && pattern.recommendations.length > 0 && (
          <div className="pt-3 border-t border-slate-200">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Recommandations
            </p>
            <ul className="space-y-1.5">
              {pattern.recommendations.map((rec, idx) => (
                <li key={idx} className="text-sm text-slate-700 flex items-start gap-2">
                  <span className="text-emerald-600 flex-shrink-0">→</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }