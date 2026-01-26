'use client';

import { useState, useTransition, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MeasurementChart } from '@/components/charts/measurement-chart';
import { AddRecordForm } from '@/components/body-tracker/add-record-form';
import { MeasurementForm } from '@/components/body-tracker/measurement-form';
import { RecordItem } from '@/components/body-tracker/record-item';
import { Plus, Edit, Trash2, Target } from 'lucide-react';
import { getMeasurement, addMeasurementRecord, deleteMeasurement, updateMeasurement, deleteMeasurementRecord } from '@/actions/measurements';
import { format } from 'date-fns';

type MeasurementRecord = {
  id: number;
  value: number;
  date: Date;
  comment: string | null;
};

type Measurement = {
  id: number;
  name: string;
  unitId: number;
  goalType: number | null;
  goalValue: number | null;
  goalDate: Date | null;
  isDefault: boolean;
  records: MeasurementRecord[];
};

const UNIT_NAMES = ['kg', 'lbs', 'cm', 'inches'];
const GOAL_TYPES = ['None', 'Increase', 'Decrease', 'Target'];

export default function MeasurementDetailPage() {
  const params = useParams();
  const router = useRouter();
  const measurementId = parseInt(params.id as string);

  const [measurement, setMeasurement] = useState<Measurement | null>(null);
  const [isAddRecordOpen, setIsAddRecordOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    loadData();
  }, [measurementId]);

  const loadData = async () => {
    const data = await getMeasurement(measurementId);
    setMeasurement(data as Measurement | null);
  };

  const handleAddRecord = async (data: any) => {
    startTransition(async () => {
      await addMeasurementRecord({
        measurementId,
        ...data,
      });
      await loadData();
      setIsAddRecordOpen(false);
    });
  };

  const handleUpdateMeasurement = async (data: any) => {
    startTransition(async () => {
      await updateMeasurement(measurementId, data);
      await loadData();
      setIsEditOpen(false);
    });
  };

  const handleDeleteMeasurement = async () => {
    startTransition(async () => {
      await deleteMeasurement(measurementId);
      router.push('/body-tracker');
    });
  };

  const handleDeleteRecord = async (recordId: number) => {
    startTransition(async () => {
      await deleteMeasurementRecord(recordId);
      await loadData();
    });
  };

  if (!measurement) {
    return (
      <div>
        <Header title="Loading..." />
        <div className="p-4 text-center">
          <p className="text-muted-foreground">Loading measurement data...</p>
        </div>
      </div>
    );
  }

  const unitName = UNIT_NAMES[measurement.unitId] || '';
  const latestRecord = measurement.records[0];
  const goalProgress = measurement.goalValue && latestRecord
    ? ((latestRecord.value / measurement.goalValue) * 100).toFixed(1)
    : null;

  return (
    <div>
      <Header title={measurement.name} />
      <div className="p-4 space-y-4">
        {/* Actions */}
        <div className="flex gap-2 justify-between">
          <Button onClick={() => setIsAddRecordOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Record
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsEditOpen(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            {!measurement.isDefault && (
              <Button variant="outline" onClick={() => setIsDeleteOpen(true)}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
          </div>
        </div>

        {/* Goal Progress */}
        {measurement.goalType && measurement.goalValue && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-4 w-4" />
                Goal Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Current: {latestRecord?.value || 0} {unitName}</span>
                  <span>Goal: {measurement.goalValue} {unitName}</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div
                    className="bg-primary rounded-full h-2 transition-all"
                    style={{ width: `${Math.min(parseFloat(goalProgress || '0'), 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {GOAL_TYPES[measurement.goalType]} goal
                  {measurement.goalDate && ` by ${format(new Date(measurement.goalDate), 'MMM d, yyyy')}`}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Chart */}
        {measurement.records.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">History</CardTitle>
            </CardHeader>
            <CardContent>
              <MeasurementChart
                records={measurement.records}
                unitName={unitName}
                goalValue={measurement.goalValue || undefined}
              />
            </CardContent>
          </Card>
        )}

        {/* Records List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Records</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {measurement.records.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No records yet. Add your first measurement!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {measurement.records.map((record) => (
                    <RecordItem
                      key={record.id}
                      record={record}
                      unitName={unitName}
                      onDelete={handleDeleteRecord}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Add Record Dialog */}
      <Dialog open={isAddRecordOpen} onOpenChange={setIsAddRecordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Record</DialogTitle>
          </DialogHeader>
          <AddRecordForm
            onSubmit={handleAddRecord}
            onCancel={() => setIsAddRecordOpen(false)}
            isLoading={isPending}
            unitName={unitName}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Measurement Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Measurement</DialogTitle>
          </DialogHeader>
          <MeasurementForm
            defaultValues={{
              name: measurement.name,
              unitId: measurement.unitId,
              goalType: measurement.goalType || undefined,
              goalValue: measurement.goalValue || undefined,
              goalDate: measurement.goalDate || undefined,
            }}
            onSubmit={handleUpdateMeasurement}
            onCancel={() => setIsEditOpen(false)}
            isLoading={isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Measurement</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{measurement.name}"? This will also delete all associated records. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMeasurement} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
