import {
  Calendar as CalendarIcon,
  Dumbbell, 
  User, 
  LineChart, 
  Calculator,
  CalendarDays,
  RefreshCw,
  LogOut,
  Lock,
  Flame,
  FolderPlus,
  Bookmark,
  MessageSquare,
  Plus,
  Layers3,
  Menu,
  Target,
  Ruler,
  Settings as SettingsIcon,
  Keyboard
} from 'lucide-react';
import { intColorToHex } from './lib/colors';
import { getLocalDateString, addDays } from './lib/date';
import { useState, useEffect, useRef } from 'react';
import { FitNotesProvider, useFitNotesController, useFitNotesStore } from './store/FitNotesStore';
import { BodyView } from './views/BodyView';
import { AnalysisView } from './views/AnalysisView';
import { GoalsView } from './views/GoalsView';
import { MeasurementsView } from './views/MeasurementsView';
import { CalendarView } from './views/CalendarView';
import { SyncView } from './views/SyncView';
import { RoutinesView } from './views/RoutinesView';
import { ExercisesView } from './views/ExercisesView';
import { WorkoutLogView } from './views/WorkoutLogView';
import { RoutineEditorView } from './views/RoutineEditorView';
import { SettingsView } from './views/SettingsView';
import { ToolsView } from './views/ToolsView';
import { ExerciseHistoryDrawer } from './components/ExerciseHistoryDrawer';
import { RestTimer } from './components/RestTimer';
import { ToastNotification } from './components/ToastNotification';
import { ConfirmationModal } from './components/ConfirmationModal';

import { PlateCalculatorModal } from './components/PlateCalculatorModal';
import { CommandPalette } from './components/CommandPalette';
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
import { SplitDaySelectorModal } from './components/modals/SplitDaySelectorModal';
import { BulkMoveModal } from './components/modals/BulkMoveModal';

const formatRelativeTime = (timestamp: string): string => {
  if (!timestamp) return 'Never';
  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) return 'Never';
  
  const diffMs = Date.now() - parsed;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 10) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  
  return new Date(parsed).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

function SyncStatusIndicator() {
  const { token, syncStatus, lastSyncTime, triggerSync } = useFitNotesStore();
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, [token]);

  if (!token) return null;

  let statusText = 'Auto-Sync Active';
  let statusColor = 'var(--primary)';
  let isSpinning = false;

  if (syncStatus === 'syncing') {
    statusText = 'Syncing...';
    statusColor = 'var(--text-secondary-dark)';
    isSpinning = true;
  } else if (syncStatus === 'success') {
    statusText = 'Sync Successful';
    statusColor = '#22c55e'; // Green
  } else if (syncStatus === 'error') {
    statusText = 'Sync Failed / Offline';
    statusColor = '#ef4444'; // Red
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '6px 14px 6px 10px',
      borderRadius: '20px',
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
      border: '1px solid var(--border-dark)',
      fontSize: '12px',
      height: '38px',
    }} className="sync-indicator-container">
      <button 
        className={`btn-sync-spin ${isSpinning ? 'spin-animation' : ''}`}
        onClick={() => triggerSync()}
        style={{
          background: 'none',
          border: 'none',
          color: statusColor,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4px',
          borderRadius: '50%',
          transition: 'all 0.2s',
        }}
        title="Sync Now"
      >
        <RefreshCw size={14} className={isSpinning ? 'spin-animation' : ''} />
      </button>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', userSelect: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}>
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: statusColor,
            display: 'inline-block'
          }}></span>
          <span style={{ color: 'var(--text-primary-dark)' }} className="sync-status-text">{statusText}</span>
        </div>
        <span style={{ color: 'var(--text-secondary-dark)', fontSize: '10px' }} className="sync-time-text">
          Last sync: {formatRelativeTime(lastSyncTime)}
        </span>
      </div>
    </div>
  );
}

export default function App() {
  const store = useFitNotesController();

  // Touch Swipe Gesture Recognizer for Sidebar
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const activeSwipe = useRef<'open' | 'close' | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStartX.current = touch.clientX;
      touchStartY.current = touch.clientY;
      
      if (!store.sidebarOpen && touch.clientX < 40) {
        // Swipe from left edge to open
        activeSwipe.current = 'open';
        setIsDragging(true);
        setDragOffset(0);
      } else if (store.sidebarOpen) {
        // Swipe left anywhere to close
        activeSwipe.current = 'close';
        setIsDragging(true);
        setDragOffset(280);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!activeSwipe.current) return;
      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartX.current;
      const deltaY = touch.clientY - touchStartY.current;

      // Prevent vertical scroll conflicts when swiping horizontally
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        if (e.cancelable) e.preventDefault();
      }

      if (activeSwipe.current === 'open') {
        const offset = Math.max(0, Math.min(280, deltaX));
        setDragOffset(offset);
      } else if (activeSwipe.current === 'close') {
        const offset = Math.max(0, Math.min(280, 280 + deltaX));
        setDragOffset(offset);
      }
    };

    const handleTouchEnd = () => {
      if (!activeSwipe.current) return;
      
      setIsDragging(false);
      const finalOffset = dragOffset;
      const swipeType = activeSwipe.current;
      activeSwipe.current = null;

      if (swipeType === 'open') {
        if (finalOffset > 100) {
          store.setSidebarOpen(true);
        } else {
          store.setSidebarOpen(false);
        }
      } else if (swipeType === 'close') {
        if (finalOffset < 180) {
          store.setSidebarOpen(false);
        } else {
          store.setSidebarOpen(true);
        }
      }
      setDragOffset(0);
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [store.sidebarOpen, dragOffset]);

  const {
    activeTab, setActiveTab, sidebarOpen, setSidebarOpen, userUnit, handleUnitChange,
    token, userEmail, handleLogout, toggleTheme, selectedDate, setSelectedDate,
    exercises, categories, allLogs,
    editingRoutine, setSelectedExercise, showPlateCalc, setShowPlateCalc, setShowCommandPalette, setShowShortcutsHelp, setShowRoutineImportModal,
    plateCalcTarget, setPlateCalcTarget, calculatedPlates,
    setShowCatModal, setNewCatName, setNewCatColor,
    setShowManageCatsModal,
    showCommandPalette,
    replaceTargetExerciseId, setReplaceTargetExerciseId, handleReplaceExercise,

    confirmOpen, setConfirmOpen, confirmTitle, confirmMessage, confirmOnApprove, confirmApproveLabel, confirmTone,
    showCopyWorkoutDrawer, setShowCopyWorkoutDrawer, handleCopyWorkoutConfirm,
    handleImportRoutinePopulated,
    activeSectionForPopulate, setActiveSectionForPopulate,
    setShowBulkMoveModal, setBulkMoveTargetDate,
    handleBulkDelete, handleBulkIncrementWeight, handleBulkIncrementReps,
    selectedLogIdsForGroup, setSelectedLogIdsForGroup, handleCreateSuperset,
    showToast, toastMessage, toastType,
  } = store;
  return (
    <FitNotesProvider value={store}>
    <div className="app-container">
      {/* Sidebar Backdrop Overlay on Mobile */}
      <div 
        className={`sidebar-backdrop ${sidebarOpen ? 'open' : ''}`} 
        onClick={() => setSidebarOpen(false)} 
        style={{
          display: (isDragging || sidebarOpen) ? 'block' : undefined,
          opacity: isDragging ? dragOffset / 280 : undefined,
          transition: isDragging ? 'none' : undefined
        }}
      />

      {/* 1. Sidebar Panel */}
      <aside 
        className={`sidebar ${sidebarOpen ? 'open' : ''}`}
        style={{
          transform: isDragging 
            ? `translateX(${dragOffset - 280}px)` 
            : undefined,
          transition: isDragging ? 'none' : undefined
        }}
      >
        <div className="brand">
          <img 
            src="/favicon.svg" 
            alt="FitNotes Logo" 
            className="brand-logo" 
            style={{ objectFit: 'contain', padding: '4px', background: 'rgba(255, 255, 255, 0.05)' }} 
          />
          <div>
            <div className="brand-name">FitNotes Web</div>
            <div style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Premium Unlocked</div>
          </div>
        </div>

        <ul className="nav-links">
          <li>
            <div className={`nav-item ${activeTab === 'log' ? 'active' : ''}`} onClick={() => setActiveTab('log')}>
              <Dumbbell size={18} /> Workout Log
            </div>
          </li>
          <li>
            <div className={`nav-item ${activeTab === 'calendar' ? 'active' : ''}`} onClick={() => setActiveTab('calendar')}>
              <CalendarIcon size={18} /> Calendar View
            </div>
          </li>
          <li>
            <div className={`nav-item ${activeTab === 'exercises' ? 'active' : ''}`} onClick={() => setActiveTab('exercises')}>
              <Flame size={18} /> Exercises
            </div>
          </li>
          <li>
            <div className={`nav-item ${activeTab === 'routines' ? 'active' : ''}`} onClick={() => setActiveTab('routines')}>
              <Layers3 size={18} /> Routines
            </div>
          </li>
          <li>
            <div className={`nav-item ${activeTab === 'body' ? 'active' : ''}`} onClick={() => setActiveTab('body')}>
              <User size={18} /> Body Weight
            </div>
          </li>
          <li>
            <div className={`nav-item ${activeTab === 'measurements' ? 'active' : ''}`} onClick={() => setActiveTab('measurements')}>
              <Ruler size={18} /> Measurements
            </div>
          </li>
          <li>
            <div className={`nav-item ${activeTab === 'goals' ? 'active' : ''}`} onClick={() => setActiveTab('goals')}>
              <Target size={18} /> Goals
            </div>
          </li>
          <li>
            <div className={`nav-item ${activeTab === 'analysis' ? 'active' : ''}`} onClick={() => setActiveTab('analysis')}>
              <LineChart size={18} /> Analytics
            </div>
          </li>
          <li>
            <div className={`nav-item ${activeTab === 'tools' ? 'active' : ''}`} onClick={() => setActiveTab('tools')}>
              <Calculator size={18} /> Tools
            </div>
          </li>
          <li>
            <div className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
              <SettingsIcon size={18} /> Settings
            </div>
          </li>
          <li>
            <div className={`nav-item ${activeTab === 'sync' ? 'active' : ''}`} onClick={() => setActiveTab('sync')}>
              <RefreshCw size={18} /> Sync Center
            </div>
          </li>
        </ul>

        {/* App Preferences */}
        <div style={{ padding: '16px', border: '1px solid var(--border-dark)', borderRadius: '16px', backgroundColor: 'rgba(255, 255, 255, 0.02)', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary-dark)' }}>
            <Calculator size={14} color="var(--primary)" /> Unit Preference
          </div>
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-dark)' }}>
            <button 
              onClick={() => handleUnitChange('kg')} 
              style={{ flex: 1, border: 'none', background: userUnit === 'kg' ? 'var(--primary)' : 'transparent', color: userUnit === 'kg' ? 'white' : 'var(--text-secondary-dark)', padding: '6px 0', fontSize: '12px', fontWeight: 700, borderRadius: '6px', cursor: 'pointer', transition: 'all var(--transition-fast)' }}
            >
              Metric (kg)
            </button>
            <button 
              onClick={() => handleUnitChange('lbs')} 
              style={{ flex: 1, border: 'none', background: userUnit === 'lbs' ? 'var(--primary)' : 'transparent', color: userUnit === 'lbs' ? 'white' : 'var(--text-secondary-dark)', padding: '6px 0', fontSize: '12px', fontWeight: 700, borderRadius: '6px', cursor: 'pointer', transition: 'all var(--transition-fast)' }}
            >
              Imperial (lbs)
            </button>
          </div>
        </div>

        {/* User Account panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {token ? (
            <div className="card" style={{ padding: '16px', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--success)' }}></div>
                <span style={{ fontSize: '13px', fontWeight: 600, wordBreak: 'break-all' }}>{userEmail}</span>
              </div>
              <button className="btn btn-secondary" style={{ padding: '8px 12px', fontSize: '13px' }} onClick={handleLogout}>
                <LogOut size={14} /> Log Out
              </button>
            </div>
          ) : (
            <div className="card" style={{ padding: '16px', gap: '8px', cursor: 'pointer' }} onClick={() => setActiveTab('sync')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--warning)' }}>
                <Lock size={14} />
                <span style={{ fontSize: '13px', fontWeight: 600 }}>Guest Session</span>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary-dark)' }}>Tap to log in for cloud sync.</p>
            </div>
          )}
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={toggleTheme}>
              Toggle Theme
            </button>
            <button
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px 12px', flexShrink: 0 }}
              onClick={() => setShowShortcutsHelp(true)}
              title="Keyboard shortcuts (?)"
              aria-label="Keyboard shortcuts"
            >
              <Keyboard size={16} /> <kbd className="kbd">?</kbd>
            </button>
          </div>
        </div>
      </aside>

      {/* 2. Main Workspace Dashboard */}
      <main className={`main-content ${activeTab === 'log' || activeTab === 'exercises' ? 'has-mobile-bottom-actions' : ''}`}>
        {activeTab !== 'calendar' && (
          <header className="header" style={{ flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button className="hamburger-btn" onClick={() => setSidebarOpen(true)} title="Open navigation Menu">
                <Menu size={24} />
              </button>
              <div className="title-section">
                <h1>FitNotes Dashboard</h1>
                <p style={{ margin: 0 }}>Interactive tracking session for {selectedDate}</p>
                <p style={{ fontSize: '13px', color: 'var(--accent)', fontWeight: 600, margin: '2px 0 0 0', textTransform: 'capitalize' }}>
                  {(() => {
                    try {
                      const parts = selectedDate.split('-');
                      if (parts.length === 3) {
                        const y = parseInt(parts[0], 10);
                        const m = parseInt(parts[1], 10) - 1;
                        const d = parseInt(parts[2], 10);
                        return new Date(y, m, d).toLocaleDateString(undefined, { weekday: 'long' });
                      }
                    } catch (e) {}
                    return '';
                  })()}
                </p>
              </div>
            </div>
            <div className={`header-actions ${activeTab === 'log' || activeTab === 'exercises' ? 'mobile-bottom-actions' : ''} ${activeTab === 'exercises' ? 'mobile-exercise-actions' : ''}`} style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              {activeTab === 'log' && (
                <>
                  <div className="date-nav-actions" style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <button className="btn btn-secondary" style={{ padding: '8px 12px' }} title="Subtract 1 Day" onClick={() => {
                      setSelectedDate(addDays(selectedDate, -1));
                    }}>-</button>
                    <input 
                      type="date" 
                      value={selectedDate} 
                      onChange={(e) => setSelectedDate(e.target.value)}
                      style={{ width: '150px', padding: '10px' }}
                    />
                    <button className="btn btn-secondary" style={{ padding: '8px 12px' }} title="Add 1 Day" onClick={() => {
                      setSelectedDate(addDays(selectedDate, 1));
                    }}>+</button>
                    <button className="btn btn-secondary" style={{ padding: '8px 12px' }} title="Today" onClick={() => {
                      setSelectedDate(getLocalDateString());
                    }}><CalendarDays size={16} /><span className="desktop-label">Today</span></button>
                  </div>
                  <button className="btn btn-secondary mobile-action-comments" title="Workout Comments" aria-label="Workout Comments" onClick={() => window.dispatchEvent(new CustomEvent('fitnotes:open-workout-comments'))}>
                    <MessageSquare size={16} />
                  </button>
                  <button className="btn btn-secondary mobile-action-secondary" onClick={() => setShowRoutineImportModal(true)} title="Load Routine" aria-label="Load Routine">
                    <Bookmark size={16} /> Load Routine
                  </button>
                  <button className="btn btn-primary mobile-action-primary" onClick={() => setShowCommandPalette(true)} title="Select Exercise" aria-label="Select Exercise" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Dumbbell size={16} /> Select Exercise (Ctrl+K)
                  </button>
                  <SyncStatusIndicator />
                </>
              )}
              {activeTab === 'exercises' && (
                <>
                  <button className="btn btn-primary mobile-action-primary" onClick={() => window.dispatchEvent(new CustomEvent('fitnotes:open-create-exercise'))} title="Create Exercise" aria-label="Create Exercise">
                    <Plus size={16} /> Create Exercise
                  </button>
                  <button className="btn btn-secondary mobile-action-secondary" onClick={() => { setNewCatName(''); setNewCatColor('#6366f1'); setShowCatModal(true); }} title="Add Category" aria-label="Add Category">
                    <FolderPlus size={16} /> Add Category
                  </button>
                  <button className="btn btn-secondary mobile-action-tertiary" onClick={() => setShowManageCatsModal(true)} title="Manage Categories" aria-label="Manage Categories">
                    <SettingsIcon size={16} /> Manage Categories
                  </button>
                </>
              )}
            </div>
          </header>
        )}

        <div className="main-panel">
          {/* -------------------- LOG TAB -------------------- */}
          {activeTab === 'log' && <WorkoutLogView />}

          {/* -------------------- CALENDAR TAB -------------------- */}
          {activeTab === 'calendar' && <CalendarView />}

          {/* -------------------- EXERCISES CATALOG TAB -------------------- */}
          {activeTab === 'exercises' && <ExercisesView />}

          {/* -------------------- ROUTINES TAB -------------------- */}
          {activeTab === 'routines' && <RoutinesView />}

          {/* -------------------- ROUTINE DAY EDITOR TAB -------------------- */}
          {activeTab === 'routine-editor' && editingRoutine && <RoutineEditorView />}

          {/* -------------------- BODYWEIGHT TAB -------------------- */}
          {activeTab === 'body' && <BodyView />}

          {/* -------------------- MEASUREMENTS TAB -------------------- */}
          {activeTab === 'measurements' && <MeasurementsView />}

          {/* -------------------- GOALS TAB -------------------- */}
          {activeTab === 'goals' && <GoalsView />}

          {/* -------------------- ANALYSIS/GRAPHS TAB -------------------- */}
          {activeTab === 'analysis' && <AnalysisView />}

          {/* -------------------- SYNC / LOGIN TAB -------------------- */}
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
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => {
          setShowCommandPalette(false);
          setReplaceTargetExerciseId(null);
        }}
        exercises={exercises}
        categories={categories}
        intColorToHex={intColorToHex}
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

      {/* 9.5 Split Day Selector Modal when importing routine */}
      <SplitDaySelectorModal />

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
          onConfirmStart={(type, percentage) => {
            handleImportRoutinePopulated(activeSectionForPopulate.routine_id, type, percentage, activeSectionForPopulate.id);
          }}
        />
      )}

      <BulkMoveModal />

      {/* Custom Toast Notification */}
      <ToastNotification
        show={showToast}
        message={toastMessage}
        type={toastType}
      />

      {/* Per-exercise History / Records / Graph drawer */}
      <ExerciseHistoryDrawer />

      {/* Rest timer bar */}
      <RestTimer />
    </div>
    </FitNotesProvider>
  );
}
