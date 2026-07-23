// AddCategoryModal.tsx - Category Creation Modal Drawer.
import { FolderPlus } from 'lucide-react';
import { useFitNotesStore } from '../../store/FitNotesStore';

export function AddCategoryModal() {
  const {
    showCatModal, setShowCatModal, newCatName, setNewCatName, newCatColor, setNewCatColor, handleCreateCategory,
  } = useFitNotesStore();

  if (!showCatModal) return null;

  return (
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
  );
}
