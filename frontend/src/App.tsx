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
  Layers,
  Layers3,
  Menu,
  Target,
  Ruler,
  Settings as SettingsIcon
} from 'lucide-react';
import { intColorToHex } from './lib/colors';
import { typeHasWeight } from './lib/units';
import { getLocalDateString, addDays } from './lib/date';
import { useState, useEffect, useRef } from 'react';
import { db } from './storage/db';
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
import { CopyWorkoutDrawer } from './components/CopyWorkoutDrawer';
import { BulkActionsDock } from './components/BulkActionsDock';
import { RoutinesPopulatorModal } from './components/RoutinesPopulatorModal';

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
        onClick={triggerSync}
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
  const [populateSections, setPopulateSections] = useState<any[]>([]);

  useEffect(() => {
    if (store.activeRoutineForPopulate) {
      db.query<any>('SELECT * FROM routine_sections WHERE routine_id = ? ORDER BY sort_order ASC', [store.activeRoutineForPopulate.id])
        .then(setPopulateSections)
        .catch(err => console.error("Failed to load routine sections:", err));
    } else {
      setPopulateSections([]);
    }
  }, [store.activeRoutineForPopulate]);

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
    exercises, categories, routines, allLogs, currentLogs,
    editingRoutine, setSelectedExercise, showPlateCalc, setShowPlateCalc, setShowCommandPalette, setShowRoutineImportModal,
    plateCalcTarget, setPlateCalcTarget, calculatedPlates,
    showCatModal, setShowCatModal, newCatName, setNewCatName, newCatColor, setNewCatColor, handleCreateCategory,
    showCreateRoutineModal, setShowCreateRoutineModal, newRoutineName, setNewRoutineName, newRoutineNotes, setNewRoutineNotes,
    routineCreatorExercises, setRoutineCreatorExercises, selectedExForRoutine, setSelectedExForRoutine,
    handleAddExToRoutineCreator, handleCreateRoutineTemplate,
    showManageCatsModal, setShowManageCatsModal, editingCategory, setEditingCategory,
    editingCatName, setEditingCatName, editingCatColor, setEditingCatColor, handleUpdateCategory, handleDeleteCategory,
    showEditExModal, setShowEditExModal, editingExercise, editExName, setEditExName, editExCategory, setEditExCategory,
    editExType, setEditExType, editExNotes, setEditExNotes, editExWeightIncrement, setEditExWeightIncrement,
    editExDefaultRestTime, setEditExDefaultRestTime, editExWeightUnit, setEditExWeightUnit,
    editExIsFavourite, setEditExIsFavourite, handleUpdateExercise, handleDeleteExercise,
    showCommandPalette, showSupersetManagerModal, setShowSupersetManagerModal,
    selectedExIdsForSuperset, setSelectedExIdsForSuperset, supersetColor, setSupersetColor, handleCreateWorkoutSuperset,
    supersetName, setSupersetName, targetSupersetGroupId, setTargetSupersetGroupId, workoutGroups,

    confirmOpen, setConfirmOpen, confirmTitle, confirmMessage, confirmOnApprove,
    showCopyWorkoutDrawer, setShowCopyWorkoutDrawer, handleCopyWorkoutConfirm,
    showRoutineImportModal, activeRoutineForPopulate, setActiveRoutineForPopulate, handleImportRoutinePopulated,
    activeSectionForPopulate, setActiveSectionForPopulate,
    showBulkMoveModal, setShowBulkMoveModal, bulkMoveTargetDate, setBulkMoveTargetDate,
    handleBulkDelete, handleBulkMoveConfirm, handleBulkIncrementWeight, handleBulkIncrementReps,
    selectedLogIdsForGroup, setSelectedLogIdsForGroup, handleCreateSuperset,
    showAddExToSectionModal, setShowAddExToSectionModal, editorExSearchQuery, setEditorExSearchQuery,
    editorExSelectedCategory, setEditorExSelectedCategory, editorAddExerciseTargetSectionId, handleAddExerciseToSection,
    showPastImporterModal, setShowPastImporterModal, pastImporterTargetSectionId, pastImporterDate, setPastImporterDate,
    pastLoggedDates, handleImportPastLogsToSection,
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
          
          <button className="btn btn-secondary" style={{ width: '100%' }} onClick={toggleTheme}>
            Toggle Theme
          </button>
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
                  <button className="btn btn-primary mobile-action-primary" onClick={() => setShowCommandPalette(true)} title="Select Exercise" aria-label="Select Exercise" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Dumbbell size={16} /> Select Exercise (Ctrl+K)
                  </button>
                  <button className="btn btn-secondary mobile-action-secondary" onClick={() => setShowRoutineImportModal(true)} title="Load Routine" aria-label="Load Routine">
                    <Bookmark size={16} /> Load Routine
                  </button>
                  <button className="btn btn-secondary mobile-action-comments" title="Workout Comments" aria-label="Workout Comments" onClick={() => window.dispatchEvent(new CustomEvent('fitnotes:open-workout-comments'))}>
                    <MessageSquare size={16} />
                  </button>
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
                  <SyncStatusIndicator />
                </>
              )}
            </div>
          </header>
        )}

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

      {/* Global Command Palette Quick Exercise Search Selector */}
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        exercises={exercises}
        categories={categories}
        intColorToHex={intColorToHex}
        onSelectExercise={(ex) => {
          setSelectedExercise(ex);
          setShowCommandPalette(false);
          window.dispatchEvent(new CustomEvent('fitnotes:open-set-entry'));
          // Automatically focus the appropriate logging input
          setTimeout(() => {
            const inputId = typeHasWeight(ex.exercise_type_id) ? 'log-weight-input' : 'log-distance-input';
            const inputEl = document.getElementById(inputId);
            if (inputEl) {
              (inputEl as HTMLInputElement).focus();
              (inputEl as HTMLInputElement).select();
            }
          }, 80);
        }}
      />

      {/* 4. Category Creation Modal Drawer */}
      {showCatModal && (
        <div className="modal-overlay" onClick={() => setShowCatModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 800 }}><FolderPlus size={20} color="var(--primary)" /> Add Custom Category</h2>
              <button className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={() => setShowCatModal(false)}>Close</button>
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '6px' }}>Category Name</label>
              <input 
                type="text" 
                placeholder="e.g. Abs, Calves" 
                value={newCatName} 
                onChange={(e) => setNewCatName(e.target.value)} 
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '6px' }}>Theme Colour</label>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <input 
                  type="color" 
                  value={newCatColor} 
                  onChange={(e) => setNewCatColor(e.target.value)} 
                  style={{ width: '64px', height: '42px', padding: '2px', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '14px', fontWeight: 700, textTransform: 'uppercase' }}>{newCatColor}</span>
              </div>
            </div>

            <button className="btn btn-primary" onClick={handleCreateCategory} style={{ width: '100%', height: '46px' }}>
              Create Category
            </button>
          </div>
        </div>
      )}

      {/* 5. Routine Creator Template Modal Drawer */}
      {showCreateRoutineModal && (
        <div className="modal-overlay" onClick={() => setShowCreateRoutineModal(false)}>
          <div className="modal-content" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 800 }}><Bookmark size={20} color="var(--primary)" /> Build Routine Template</h2>
              <button className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={() => setShowCreateRoutineModal(false)}>Close</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '6px' }}>Template Name</label>
                <input type="text" placeholder="e.g. Heavy Pull A, Hypertrophy Legs" value={newRoutineName} onChange={(e) => setNewRoutineName(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '6px' }}>Description Notes</label>
                <input type="text" placeholder="Warmup 5 min, then complete sets with 2 min rest" value={newRoutineNotes} onChange={(e) => setNewRoutineNotes(e.target.value)} />
              </div>
            </div>

            {/* Exercises select & adder */}
            <div style={{ border: '1px solid var(--border-dark)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 800 }}>Add Exercise to Routine</h3>
              <div style={{ display: 'flex', gap: '12px' }}>
                <select value={selectedExForRoutine} onChange={(e) => setSelectedExForRoutine(e.target.value)} style={{ flex: 2 }}>
                  {exercises.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
                </select>
                <button className="btn btn-secondary" onClick={handleAddExToRoutineCreator}>
                  Add
                </button>
              </div>

              {/* Display added list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto', marginTop: '8px' }}>
                {routineCreatorExercises.map((item, idx) => {
                  const ex = exercises.find(x => x.id === item.exercise_id);
                  return (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', padding: '8px 12px', backgroundColor: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-dark)', borderRadius: '10px' }}>
                      <span style={{ fontWeight: 700 }}>{idx + 1}. {ex?.name}</span>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input 
                          type="number" 
                          value={item.weight} 
                          onChange={(e) => {
                            const updated = [...routineCreatorExercises];
                            updated[idx].weight = e.target.value;
                            setRoutineCreatorExercises(updated);
                          }}
                          style={{ width: '60px', padding: '4px' }}
                        />
                        <span>{userUnit} x</span>
                        <input 
                          type="number" 
                          value={item.reps} 
                          onChange={(e) => {
                            const updated = [...routineCreatorExercises];
                            updated[idx].reps = e.target.value;
                            setRoutineCreatorExercises(updated);
                          }}
                          style={{ width: '50px', padding: '4px' }}
                        />
                        <span>reps</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <button className="btn btn-primary" onClick={handleCreateRoutineTemplate} style={{ width: '100%', height: '46px' }}>
              Save Routine Template
            </button>
          </div>
        </div>
      )}

      {/* 6. Routine Import Picker Modal Drawer */}
      {showRoutineImportModal && (
        <div className="modal-overlay mobile-modal-overlay" onClick={() => setShowRoutineImportModal(false)}>
          <div className="modal-content mobile-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-modal-header">
              <h2 style={{ fontSize: '20px', fontWeight: 800 }}><Bookmark size={20} color="var(--primary)" /> Select Routine to Load</h2>
              <button className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={() => setShowRoutineImportModal(false)}>Close</button>
            </div>
            
            <div className="mobile-modal-scroll">
              <p style={{ fontSize: '13px', color: 'var(--text-secondary-dark)' }}>Choose a template to automatically load its exercises and target sets into today's log:</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                {routines.length === 0 ? (
                  <p style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary-dark)' }}>No routines constructed yet.</p>
                ) : (
                  routines.map(r => (
                    <button 
                      key={r.id} 
                      className="btn btn-secondary" 
                      onClick={() => {
                        setActiveRoutineForPopulate(r);
                        setShowRoutineImportModal(false);
                      }}
                      style={{ width: '100%', justifyContent: 'flex-start', padding: '16px', borderRadius: '16px' }}
                    >
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-primary-dark)', textAlign: 'left' }}>{r.name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary-dark)', marginTop: '4px', textAlign: 'left' }}>{r.notes || 'No description notes added.'}</div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Exercise to Routine Section Modal */}
      {showAddExToSectionModal && editorAddExerciseTargetSectionId && (
        <div className="modal-overlay" onClick={() => setShowAddExToSectionModal(false)}>
          <div className="modal-content" style={{ maxWidth: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexShrink: 0 }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <Dumbbell size={20} color="var(--primary)" /> Select Exercise to Add
              </h2>
              <button className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={() => setShowAddExToSectionModal(false)}>Close</button>
            </div>

            {/* Search Input */}
            <div style={{ marginBottom: '16px', flexShrink: 0 }}>
              <input 
                type="text" 
                placeholder="Search exercises by name..." 
                value={editorExSearchQuery}
                onChange={e => setEditorExSearchQuery(e.target.value)}
                style={{ fontSize: '14px', padding: '10px 14px' }}
              />
            </div>

            {/* Category Filter Pills */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px', flexShrink: 0, maxHeight: '80px', overflowY: 'auto', paddingBottom: '4px' }}>
              <button 
                className="btn" 
                style={{ 
                  padding: '6px 12px', 
                  fontSize: '12px', 
                  borderRadius: '20px',
                  backgroundColor: editorExSelectedCategory === null ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)',
                  color: editorExSelectedCategory === null ? 'white' : 'var(--text-primary-dark)',
                  border: '1px solid var(--border-dark)'
                }}
                onClick={() => setEditorExSelectedCategory(null)}
              >
                All Categories
              </button>
              {categories.map(cat => (
                <button 
                  key={cat.id}
                  className="btn" 
                  style={{ 
                    padding: '6px 12px', 
                    fontSize: '12px', 
                    borderRadius: '20px',
                    backgroundColor: editorExSelectedCategory === cat.id ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)',
                    color: editorExSelectedCategory === cat.id ? 'white' : 'var(--text-primary-dark)',
                    border: '1px solid var(--border-dark)'
                  }}
                  onClick={() => setEditorExSelectedCategory(cat.id)}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Filtered Exercises List */}
            <div style={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
              {(() => {
                const filtered = exercises.filter(ex => {
                  const matchSearch = ex.name.toLowerCase().includes(editorExSearchQuery.toLowerCase());
                  const matchCat = editorExSelectedCategory === null || ex.category_id === editorExSelectedCategory;
                  return matchSearch && matchCat && !ex.is_deleted;
                });

                if (filtered.length === 0) {
                  return (
                    <p style={{ textAlign: 'center', color: 'var(--text-secondary-dark)', fontSize: '13px', padding: '24px' }}>
                      No matching exercises found.
                    </p>
                  );
                }

                return filtered.map(ex => {
                  const cat = categories.find(c => c.id === ex.category_id);
                  const catColor = cat ? intColorToHex(cat.colour) : 'var(--text-secondary-dark)';
                  return (
                    <div 
                      key={ex.id}
                      className="exercise-row"
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '12px 16px',
                        cursor: 'pointer'
                      }}
                      onClick={() => {
                        handleAddExerciseToSection(editorAddExerciseTargetSectionId, ex.id);
                        setShowAddExToSectionModal(false);
                      }}
                    >
                      <span style={{ fontWeight: 700, fontSize: '14px' }}>{ex.name}</span>
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', backgroundColor: catColor + '20', color: catColor, fontWeight: 700 }}>
                        {cat?.name || 'Misc'}
                      </span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Import Previous Workout Logs Modal */}
      {showPastImporterModal && pastImporterTargetSectionId && (
        <div className="modal-overlay" onClick={() => setShowPastImporterModal(false)}>
          <div className="modal-content" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <Bookmark size={20} color="var(--primary)" /> Import Past Workout
              </h2>
              <button className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={() => setShowPastImporterModal(false)}>Close</button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary-dark)', margin: 0 }}>
              Select a calendar date to import all exercise templates and logged sets directly into this day section:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
              {/* Date Input Selector */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '6px' }}>Select Target Date</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="date" 
                    value={pastImporterDate} 
                    onChange={e => setPastImporterDate(e.target.value)} 
                    style={{ fontSize: '14px' }}
                  />
                  <button 
                    className="btn btn-primary" 
                    onClick={() => handleImportPastLogsToSection(pastImporterTargetSectionId, pastImporterDate)}
                  >
                    Import Date
                  </button>
                </div>
              </div>

              {/* Quick Select Recent Workout Dates */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '8px' }}>Or Quick Select Recent Sessions</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                  {pastLoggedDates.length === 0 ? (
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary-dark)', fontStyle: 'italic', textAlign: 'center', padding: '12px' }}>
                      No past workouts logged yet.
                    </p>
                  ) : (
                    pastLoggedDates.map(dStr => (
                      <button
                        key={dStr}
                        className="btn btn-secondary"
                        onClick={() => handleImportPastLogsToSection(pastImporterTargetSectionId, dStr)}
                        style={{ width: '100%', justifyContent: 'space-between', padding: '12px 16px', borderRadius: '12px', color: 'var(--text-primary-dark)' }}
                      >
                        <span style={{ fontWeight: 700, fontSize: '13px' }}>{dStr}</span>
                        <span style={{ fontSize: '11px', color: 'var(--primary)' }}>Select & Import</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. Manage Categories Modal */}
      {showManageCatsModal && (
        <div className="modal-overlay" onClick={() => setShowManageCatsModal(false)}>
          <div className="modal-content" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 800 }}><Layers size={20} color="var(--primary)" /> Manage Categories</h2>
              <button className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={() => setShowManageCatsModal(false)}>Close</button>
            </div>

            {editingCategory ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700 }}>Edit Category: {editingCategory.name}</h3>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '6px' }}>Category Name</label>
                  <input type="text" value={editingCatName} onChange={(e) => setEditingCatName(e.target.value)} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '6px' }}>Theme Color</label>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <input type="color" value={editingCatColor} onChange={(e) => setEditingCatColor(e.target.value)} style={{ width: '64px', height: '42px', padding: '2px', cursor: 'pointer' }} />
                    <span style={{ fontSize: '14px', fontWeight: 700 }}>{editingCatColor}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button className="btn btn-primary" onClick={handleUpdateCategory} style={{ flex: 1 }}>Save Changes</button>
                  <button className="btn btn-secondary" onClick={() => setEditingCategory(null)} style={{ flex: 1 }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto' }}>
                {categories.map(c => {
                  const color = intColorToHex(c.colour);
                  return (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid var(--border-dark)', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.005)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: color }}></div>
                        <span style={{ fontWeight: 700 }}>{c.name}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => {
                          setEditingCategory(c);
                          setEditingCatName(c.name);
                          setEditingCatColor(color);
                        }}>Edit</button>
                        <button className="btn btn-danger" style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)' }} onClick={() => handleDeleteCategory(c.id)}>Delete</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 8. Edit Exercise Modal */}
      {showEditExModal && editingExercise && (
        <div className="modal-overlay" onClick={() => setShowEditExModal(false)}>
          <div className="modal-content" style={{ maxWidth: '550px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 800 }}><Dumbbell size={20} color="var(--primary)" /> Edit Exercise</h2>
              <button className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={() => setShowEditExModal(false)}>Close</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '6px' }}>Exercise Name</label>
                <input type="text" value={editExName} onChange={(e) => setEditExName(e.target.value)} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '6px' }}>Exercise Category</label>
                <select value={editExCategory} onChange={(e) => setEditExCategory(e.target.value)}>
                  <option value="">Uncategorized / Misc</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '6px' }}>Exercise Type</label>
                  <select value={editExType} onChange={(e) => setEditExType(e.target.value)}>
                    <option value="0">Weight & Reps</option>
                    <option value="2">Reps Only</option>
                    <option value="3">Distance & Time</option>
                    <option value="4">Distance Only</option>
                    <option value="5">Time Only</option>
                    <option value="6">Weight & Distance</option>
                    <option value="7">Weight & Time</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '6px' }}>Default Rest Time (s)</label>
                  <input type="number" value={editExDefaultRestTime} onChange={(e) => setEditExDefaultRestTime(e.target.value)} />
                </div>
              </div>

              {typeHasWeight(parseInt(editExType)) && (
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '6px' }}>Default Weight Unit</label>
                    <select value={editExWeightUnit} onChange={(e) => setEditExWeightUnit(e.target.value)}>
                      <option value="1">kg</option>
                      <option value="2">lbs</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '6px' }}>Weight Increment</label>
                    <input type="number" step="0.5" value={editExWeightIncrement} onChange={(e) => setEditExWeightIncrement(e.target.value)} />
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '6px' }}>Exercise Notes / Tips</label>
                <input type="text" placeholder="e.g. Keep shoulder blades retracted" value={editExNotes} onChange={(e) => setEditExNotes(e.target.value)} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <input type="checkbox" id="editExFav" checked={editExIsFavourite} onChange={(e) => setEditExIsFavourite(e.target.checked)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                <label htmlFor="editExFav" style={{ fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>Mark as Favorite Exercise</label>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button className="btn btn-primary" onClick={handleUpdateExercise} style={{ flex: 2 }}>Save Exercise</button>
                <button className="btn btn-danger" onClick={() => handleDeleteExercise(editingExercise.id)} style={{ flex: 1, backgroundColor: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)' }}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 9. Superset Link Manager Modal */}
      {showSupersetManagerModal && (
        <div className="modal-overlay" onClick={() => setShowSupersetManagerModal(false)}>
          <div className="modal-content" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 800 }}><Layers size={20} color="var(--primary)" /> Link Superset Group</h2>
              <button className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={() => setShowSupersetManagerModal(false)}>Close</button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary-dark)', marginBottom: '16px' }}>Select two or more exercises from today's workout log to group them into a Superset:</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '250px', overflowY: 'auto', border: '1px solid var(--border-dark)', borderRadius: '12px', padding: '12px', marginBottom: '16px' }}>
              {Array.from(new Set(currentLogs.map(l => l.exercise_id))).map(exId => {
                const ex = exercises.find(x => x.id === exId);
                if (!ex) return null;
                const isChecked = selectedExIdsForSuperset.includes(exId);
                return (
                  <label key={exId} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', backgroundColor: isChecked ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                    <input 
                      type="checkbox" 
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedExIdsForSuperset([...selectedExIdsForSuperset, exId]);
                        } else {
                          setSelectedExIdsForSuperset(selectedExIdsForSuperset.filter(id => id !== exId));
                        }
                      }}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <span style={{ fontWeight: 700, fontSize: '14px' }}>{ex.name}</span>
                  </label>
                );
              })}
            </div>

            {/* Superset Custom Name Input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px', marginTop: '16px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600 }}>Superset Name</label>
              <input 
                type="text" 
                value={supersetName} 
                onChange={(e) => setSupersetName(e.target.value)} 
                placeholder="e.g. Superset A, Push Split Superset" 
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-dark)', background: 'rgba(255,255,255,0.01)', color: 'var(--text-primary-dark)' }}
              />
            </div>

            {/* Superset Link Action (Add to existing or Create New) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600 }}>Link Action</label>
              <select 
                value={targetSupersetGroupId} 
                onChange={(e) => {
                  const val = e.target.value;
                  setTargetSupersetGroupId(val);
                  if (val) {
                    const group = workoutGroups.find(g => g.id === val);
                    if (group) {
                      setSupersetName(group.name || 'Superset');
                      const hexColor = intColorToHex(group.colour);
                      setSupersetColor(hexColor);
                    }
                  } else {
                    setSupersetName('Superset');
                  }
                }}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-dark)', background: 'var(--card-bg-dark)', color: 'var(--text-primary-dark)' }}
              >
                <option value="">+ Create New Superset Group</option>
                {workoutGroups.filter(g => g.date === selectedDate && !g.is_deleted).map(g => (
                  <option key={g.id} value={g.id}>Add to: {g.name || 'Unnamed Superset'}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600 }}>Pick Superset Custom Color Theme</label>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <input 
                  type="color" 
                  value={supersetColor} 
                  onChange={(e) => setSupersetColor(e.target.value)} 
                  style={{ width: '64px', height: '42px', padding: '2px', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '14px', fontWeight: 700, textTransform: 'uppercase' }}>{supersetColor}</span>
              </div>
            </div>

            <button className="btn btn-primary" onClick={handleCreateWorkoutSuperset} style={{ width: '100%', height: '46px' }}>
              Link Exercises Now
            </button>
          </div>
        </div>
      )}

      {/* 9.5 Split Day Selector Modal when importing routine */}
      {activeRoutineForPopulate && populateSections.length > 0 && (
        <div className="modal-overlay mobile-modal-overlay" onClick={() => setActiveRoutineForPopulate(null)}>
          <div className="modal-content mobile-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div className="mobile-modal-header">
              <h2 style={{ fontSize: '18px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <Bookmark size={20} color="var(--primary)" /> Select Split Day to Start
              </h2>
              <button className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={() => setActiveRoutineForPopulate(null)}>Close</button>
            </div>

            <div className="mobile-modal-scroll">
            <p style={{ fontSize: '13px', color: 'var(--text-secondary-dark)', marginBottom: '16px' }}>
              Select which workout day split from <strong>{activeRoutineForPopulate.name}</strong> you want to load:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {populateSections.map(sec => (
                <button 
                  key={sec.id}
                  className="btn btn-secondary"
                  onClick={() => {
                    setActiveSectionForPopulate(sec);
                    setActiveRoutineForPopulate(null);
                  }}
                  style={{ width: '100%', justifyContent: 'space-between', padding: '14px 18px', borderRadius: '12px', display: 'flex', alignItems: 'center' }}
                >
                  <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-primary-dark)' }}>{sec.name}</span>
                  <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 600 }}>Start Day Split →</span>
                </button>
              ))}
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      <ConfirmationModal 
        isOpen={confirmOpen}
        title={confirmTitle}
        message={confirmMessage}
        onClose={() => setConfirmOpen(false)}
        onApprove={confirmOnApprove || (() => {})}
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

      {showBulkMoveModal && (
        <div className="modal-overlay" onClick={() => setShowBulkMoveModal(false)} style={{ zIndex: 100000 }}>
          <div 
            className="modal-content" 
            style={{ 
              maxWidth: '400px',
              backgroundColor: 'rgba(30, 41, 59, 0.95)',
              backdropFilter: 'blur(16px)',
              border: '1px solid var(--border-dark)',
              borderRadius: '16px',
              boxShadow: 'var(--shadow-lg)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }} 
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ borderBottom: '1px solid var(--border-dark)', paddingBottom: '12px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary-dark)' }}>Move sets to another date</h2>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary-dark)' }}>Choose target date to reschedule {selectedLogIdsForGroup.length} sets</span>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '6px' }}>Target Date</label>
              <input 
                type="date" 
                value={bulkMoveTargetDate} 
                onChange={(e) => setBulkMoveTargetDate(e.target.value)} 
                style={{ width: '100%', padding: '10px' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '12px', borderTop: '1px solid var(--border-dark)', paddingTop: '16px' }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => handleBulkMoveConfirm(bulkMoveTargetDate)}>Move sets</button>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowBulkMoveModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

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
