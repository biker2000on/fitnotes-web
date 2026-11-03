import { Plus, FolderPlus, Settings as SettingsIcon } from 'lucide-react';
import { intColorToHex } from './lib/colors';
import { useEffect, useMemo, useRef } from 'react';
import { FitNotesProvider, useFitNotesController } from './store/FitNotesStore';
import type { TabId } from './store/slices/shared';
import { BodyView } from './views/BodyView';
import { AnalysisView } from './views/AnalysisView';
import { GoalsView } from './views/GoalsView';
import { MeasurementsView } from './views/MeasurementsView';
import { CalendarView } from './views/CalendarView';
import { HistoryView } from './views/HistoryView';
import { SyncView } from './views/SyncView';
import { RoutinesView } from './views/RoutinesView';
import { ExercisesView } from './views/ExercisesView';
import { WorkoutLogView } from './views/WorkoutLogView';
import { RoutineEditorView } from './views/RoutineEditorView';
import { SettingsView } from './views/SettingsView';
import { ToolsView } from './views/ToolsView';
import { MoreView } from './views/MoreView';
import { AppNav } from './components/AppNav';
import { LogMasthead } from './components/LogMasthead';
import { ExerciseHistoryDrawer } from './components/ExerciseHistoryDrawer';
import { RestTimer } from './components/RestTimer';
import { ToastNotification } from './components/ToastNotification';
import { ConfirmationModal } from './components/ConfirmationModal';

import { PlateCalculatorModal } from './components/PlateCalculatorModal';
import { ExercisePicker } from './components/ExercisePicker';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { CopyWorkoutDrawer } from './components/CopyWorkoutDrawer';
import { BulkActionsDock } from './components/BulkActionsDock';
import { RoutinesPopulatorModal } from './components/RoutinesPopulatorModal';
import { AddCategoryModal } from './components/modals/AddCategoryModal';
import { CreateRoutineModal } from './components/modals/CreateRoutineModal';
import { LoadRoutineModal } from './components/modals/LoadRoutineModal';
import { AddExerciseToSectionModal } from './components/modals/AddExerciseToSectionModal';
import { ImportPastWorkoutModal } from './components/modals/ImportPastWorkoutModal';
import { ManageCategoriesModal } from './components/modals/ManageCategoriesModal';
import { EditExerciseModal } from './components/modals/EditExerciseModal';
import { SupersetManagerModal } from './components/modals/SupersetManagerModal';
import { BulkMoveModal } from './components/modals/BulkMoveModal';

// Pages that draw their own header (the Log's date pager, the Calendar
// toolbar, the routine editor's back bar) are absent; the rest get a title.
const PAGE_TITLES: Partial<Record<TabId, string>> = {
  more: 'More',
  history: 'History',
  exercises: 'Exercises',
  routines: 'Routines',
  'routine-editor': 'Routines',
  body: 'Body',
  measurements: 'Measurements',
  goals: 'Goals',
  analysis: 'Analytics',
  tools: 'Tools',
  settings: 'Settings',
  sync: 'Account & sync',
};

export default function App() {
  const store = useFitNotesController();
  const mainRef = useRef<HTMLElement>(null);

  const {
    activeTab, userUnit,
    selectedDate, exercises, categories, allLogs,
    editingRoutine, setSelectedExercise, showPlateCalc, setShowPlateCalc, setShowCommandPalette,
    plateCalcTarget, setPlateCalcTarget, calculatedPlates,
    setShowCatModal, setNewCatName, setNewCatColor,
    setShowManageCatsModal,
    showCommandPalette,
    replaceTargetExerciseId, setReplaceTargetExerciseId, handleReplaceExercise,

    confirmOpen, setConfirmOpen, confirmTitle, confirmMessage, confirmOnApprove, confirmApproveLabel, confirmTone,
    showCopyWorkoutDrawer, setShowCopyWorkoutDrawer, handleCopyWorkoutConfirm,
    handleImportRoutinePopulated, populateTargetDate,
    activeSectionForPopulate, setActiveSectionForPopulate,
    setShowBulkMoveModal, setBulkMoveTargetDate,
    handleBulkDelete, handleBulkIncrementWeight, handleBulkIncrementReps,
    selectedLogIdsForGroup, setSelectedLogIdsForGroup, handleCreateSuperset,
    showToast, toastMessage, toastType, toastAction, dismissToast,
  } = store;

  // Exercises logged most recently lead the picker before anything is typed.
  const recentExerciseIds = useMemo(() => {
    const seen = new Set<string>();
    const ordered = [...allLogs].filter(l => !l.is_deleted).sort((a, b) => b.date.localeCompare(a.date));
    for (const log of ordered) {
      seen.add(log.exercise_id);
      if (seen.size >= 12) break;
    }
    return Array.from(seen);
  }, [allLogs]);

  // One scroller serves every page; a new page always starts at its top.
  // Calendar positions itself on the current month, so it is left alone.
  // A start sheet belongs to the page it was opened from.
  useEffect(() => {
    if (activeTab !== 'calendar') mainRef.current?.scrollTo({ top: 0 });
    setActiveSectionForPopulate(null);
  }, [activeTab]);

  const title = PAGE_TITLES[activeTab];

  return (
    <FitNotesProvider value={store}>
    <div className={`app-shell page-is-${activeTab}`}>
      <AppNav activeTab={activeTab} />

      <main className="app-main" ref={mainRef} id="main">
        {activeTab === 'log' && <LogMasthead />}
        {title && (
          <header className="page-header">
            <h1 className="page-title">{title}</h1>
            {activeTab === 'exercises' && (
              <div className="page-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowManageCatsModal(true)}>
                  <SettingsIcon size={16} aria-hidden /> Categories
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => { setNewCatName(''); setNewCatColor('#6366f1'); setShowCatModal(true); }}>
                  <FolderPlus size={16} aria-hidden /> New category
                </button>
                <button type="button" className="btn btn-primary" onClick={() => window.dispatchEvent(new CustomEvent('fitnotes:open-create-exercise'))}>
                  <Plus size={16} aria-hidden /> New exercise
                </button>
              </div>
            )}
          </header>
        )}

        {/* The calendar grid earns every pixel it can get: it opts out of the
            shared content cap so the month grid fills the viewport beside the
            fixed-width workout summary. */}
        <div className={`main-panel ${activeTab === 'calendar' ? 'main-panel-wide' : ''}`}>
          {activeTab === 'log' && <WorkoutLogView />}
          {activeTab === 'calendar' && <CalendarView />}
          {activeTab === 'more' && <MoreView />}
          {activeTab === 'history' && <HistoryView />}
          {activeTab === 'exercises' && <ExercisesView />}
          {(activeTab === 'routines' || activeTab === 'routine-editor') && (
            // Phones show one level at a time; desktop keeps the list beside
            // the routine being read or edited.
            <div className="routines-split">
              <section className="routines-split-list" aria-label="All routines">
                <RoutinesView />
              </section>
              <section className="routines-split-detail">
                {activeTab === 'routine-editor' && editingRoutine ? (
                  <RoutineEditorView />
                ) : (
                  <div className="routines-split-empty">
                    <p className="empty-title">Pick a routine</p>
                    <p>Its days and planned sets show here. Start a day from either side.</p>
                  </div>
                )}
              </section>
            </div>
          )}
          {activeTab === 'body' && <BodyView />}
          {activeTab === 'measurements' && <MeasurementsView />}
          {activeTab === 'goals' && <GoalsView />}
          {activeTab === 'analysis' && <AnalysisView />}
          {activeTab === 'tools' && <ToolsView />}
          {activeTab === 'settings' && <SettingsView />}
          {activeTab === 'sync' && <SyncView />}
        </div>
      </main>

      {/* 3. Global Plate Calculator Modal Drawer */}
      <PlateCalculatorModal 
        isOpen={showPlateCalc}
        onClose={() => setShowPlateCalc(false)}
        userUnit={userUnit}
        plateCalcTarget={plateCalcTarget}
        setPlateCalcTarget={setPlateCalcTarget}
        calculatedPlates={calculatedPlates}
      />

      {/* Global Keyboard Shortcuts reference overlay (press ?) */}
      <KeyboardShortcutsModal />

      {/* Global Command Palette Quick Exercise Search Selector */}
      <ExercisePicker
        isOpen={showCommandPalette}
        onClose={() => {
          setShowCommandPalette(false);
          setReplaceTargetExerciseId(null);
        }}
        exercises={exercises}
        categories={categories}
        intColorToHex={intColorToHex}
        recentExerciseIds={recentExerciseIds}
        onSelectExercise={(ex) => {
          if (replaceTargetExerciseId) {
            handleReplaceExercise(replaceTargetExerciseId, ex.id);
            setShowCommandPalette(false);
            return;
          }
          setSelectedExercise(ex);
          setShowCommandPalette(false);
          window.dispatchEvent(new CustomEvent('fitnotes:open-set-entry'));
        }}
      />

      {/* 4. Category Creation Modal Drawer */}
      <AddCategoryModal />

      {/* 5. Routine Creator Modal — name + notes only; days and exercises are
          added in the routine editor afterwards (reference app flow). */}
      <CreateRoutineModal />

      {/* 6. Routine Import Picker Modal Drawer */}
      <LoadRoutineModal />

      {/* Add Exercise to Routine Section Modal */}
      <AddExerciseToSectionModal />

      {/* Import Previous Workout Logs Modal */}
      <ImportPastWorkoutModal />

      {/* 7. Manage Categories Modal */}
      <ManageCategoriesModal />

      {/* 8. Edit Exercise Modal */}
      <EditExerciseModal />

      {/* 9. Superset Link Manager Modal */}
      <SupersetManagerModal />

      {/* Custom Confirmation Modal */}
      <ConfirmationModal 
        isOpen={confirmOpen}
        title={confirmTitle}
        message={confirmMessage}
        onClose={() => setConfirmOpen(false)}
        onApprove={confirmOnApprove || (() => {})}
        approveLabel={confirmApproveLabel}
        tone={confirmTone}
      />

      {/* Premium UI Upgrades: Drawers, Docks & Populator modals */}
      <CopyWorkoutDrawer 
        isOpen={showCopyWorkoutDrawer}
        onClose={() => setShowCopyWorkoutDrawer(false)}
        allLogs={allLogs}
        exercises={exercises}
        onConfirmCopy={handleCopyWorkoutConfirm}
      />

      <BulkActionsDock 
        selectedCount={selectedLogIdsForGroup.length}
        onClearSelection={() => setSelectedLogIdsForGroup([])}
        onBulkDelete={handleBulkDelete}
        onBulkMove={() => {
          setBulkMoveTargetDate(selectedDate);
          setShowBulkMoveModal(true);
        }}
        onBulkSuperset={handleCreateSuperset}
        onBulkIncrementWeight={handleBulkIncrementWeight}
        onBulkIncrementReps={handleBulkIncrementReps}
      />

      {activeSectionForPopulate && (
        <RoutinesPopulatorModal 
          isOpen={activeSectionForPopulate !== null}
          onClose={() => {
            setActiveSectionForPopulate(null);
          }}
          routineName={activeSectionForPopulate.name}
          targetDate={populateTargetDate ?? selectedDate}
          onConfirmStart={(type, percentage, date) => {
            handleImportRoutinePopulated(activeSectionForPopulate.routine_id, type, percentage, activeSectionForPopulate.id, date);
          }}
        />
      )}

      <BulkMoveModal />

      {/* Custom Toast Notification */}
      <ToastNotification
        show={showToast}
        message={toastMessage}
        type={toastType}
        action={toastAction}
        onDismiss={dismissToast}
      />

      {/* Per-exercise History / Records / Graph drawer */}
      <ExerciseHistoryDrawer />

      {/* Rest timer bar */}
      <RestTimer />
    </div>
    </FitNotesProvider>
  );
}
