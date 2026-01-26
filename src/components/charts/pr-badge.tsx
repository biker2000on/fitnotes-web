import { Badge } from '@/components/ui/badge';
import { Trophy, TrendingUp, Target, Dumbbell } from 'lucide-react';

type PRType = 'max_weight' | 'max_reps' | 'max_volume' | 'max_1rm';

interface PRBadgeProps {
  type: PRType;
  size?: 'sm' | 'md' | 'lg';
}

const prConfig = {
  max_weight: {
    label: 'Weight PR',
    color: 'bg-yellow-500 hover:bg-yellow-500/80 text-white',
    icon: Dumbbell,
  },
  max_reps: {
    label: 'Reps PR',
    color: 'bg-gray-400 hover:bg-gray-400/80 text-white',
    icon: TrendingUp,
  },
  max_volume: {
    label: 'Volume PR',
    color: 'bg-amber-600 hover:bg-amber-600/80 text-white',
    icon: Trophy,
  },
  max_1rm: {
    label: '1RM PR',
    color: 'bg-blue-500 hover:bg-blue-500/80 text-white',
    icon: Target,
  },
};

export function PRBadge({ type, size = 'md' }: PRBadgeProps) {
  const config = prConfig[type];
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  return (
    <Badge className={config.color}>
      <Icon className={sizeClasses[size]} />
      <span className="ml-1">{config.label}</span>
    </Badge>
  );
}
