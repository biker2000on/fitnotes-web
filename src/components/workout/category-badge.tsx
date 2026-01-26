
interface CategoryBadgeProps {
  name: string;
  color: string;
  size?: 'sm' | 'default';
}

export function CategoryBadge({ name, color, size = 'default' }: CategoryBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs'
      }`}
      style={{ backgroundColor: `${color}20`, color }}
    >
      {name}
    </span>
  );
}
