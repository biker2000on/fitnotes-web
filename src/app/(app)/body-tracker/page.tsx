'use client';

import { useState, useTransition, useEffect } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MeasurementCard } from '@/components/body-tracker/measurement-card';
import { MeasurementForm } from '@/components/body-tracker/measurement-form';
import { Plus } from 'lucide-react';
import { getMeasurements, createMeasurement, createDefaultMeasurements } from '@/actions/measurements';

type Measurement = {
  id: number;
  name: string;
  unitId: number;
  goalType: number | null;
  goalValue: number | null;
  goalDate: Date | null;
  isDefault: boolean;
  records: Array<{
    id: number;
    value: number;
    date: Date;
  }>;
};

export default function BodyTrackerPage() {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const data = await getMeasurements();
    setMeasurements(data as Measurement[]);

    // Create default body weight measurement if no measurements exist
    if (data.length === 0) {
      await createDefaultMeasurements();
      const updatedData = await getMeasurements();
      setMeasurements(updatedData as Measurement[]);
    }
  };

  const handleCreateMeasurement = async (data: any) => {
    startTransition(async () => {
      await createMeasurement(data);
      await loadData();
      setIsAddDialogOpen(false);
    });
  };

  return (
    <div>
      <Header title="Body Tracker" />
      <div className="p-4 space-y-4">
        <div className="flex justify-end">
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Measurement
          </Button>
        </div>

        <ScrollArea className="h-[calc(100vh-200px)]">
          {measurements.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                No measurements yet. Add your first measurement!
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {measurements.map((measurement) => (
                <Link key={measurement.id} href={`/body-tracker/${measurement.id}`}>
                  <MeasurementCard measurement={measurement} />
                </Link>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Measurement</DialogTitle>
          </DialogHeader>
          <MeasurementForm
            onSubmit={handleCreateMeasurement}
            onCancel={() => setIsAddDialogOpen(false)}
            isLoading={isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
