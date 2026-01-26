'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calculator, Percent, Dumbbell, Scale } from 'lucide-react';
import { Header } from '@/components/layout/header';

export default function ToolsPage() {
  const tools = [
    {
      title: 'Plate Calculator',
      description: 'Calculate which plates to load on a barbell for your target weight',
      icon: Scale,
      href: '/tools/plate-calculator',
      available: true,
    },
    {
      title: '1RM Calculator',
      description: 'Calculate your one-rep max using multiple proven formulas',
      icon: Calculator,
      href: '/tools/rm-calculator',
      available: true,
    },
    {
      title: 'Set Calculator',
      description: 'Plan your training weights based on percentages of your 1RM',
      icon: Percent,
      href: '/tools/set-calculator',
      available: true,
    },
  ];

  return (
    <div className="min-h-screen">
      <Header title="Tools" />
      <div className="p-4 pb-24 space-y-6 max-w-2xl mx-auto">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Training Tools</h2>
          <p className="text-muted-foreground">
            Helpful calculators and utilities for your training
          </p>
        </div>

        <div className="grid gap-4">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link key={tool.href} href={tool.href}>
                <Card className="hover:bg-accent transition-colors">
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <CardTitle>{tool.title}</CardTitle>
                        <CardDescription className="mt-1.5">
                          {tool.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
