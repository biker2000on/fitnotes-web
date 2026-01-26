import { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface SettingsSectionProps {
  title: string;
  icon?: LucideIcon;
  children: ReactNode;
}

export function SettingsSection({ title, icon: Icon, children }: SettingsSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {Icon && <Icon className="h-5 w-5" />}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="divide-y">
        {children}
      </CardContent>
    </Card>
  );
}
