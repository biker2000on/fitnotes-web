// ManageCategoriesModal.tsx - Manage Categories Modal (list, edit, delete).
import { Layers } from 'lucide-react';
import { intColorToHex } from '../../lib/colors';
import { useFitNotesStore } from '../../store/FitNotesStore';

export function ManageCategoriesModal() {
  const {
    showManageCatsModal, setShowManageCatsModal, editingCategory, setEditingCategory,
    editingCatName, setEditingCatName, editingCatColor, setEditingCatColor, handleUpdateCategory, handleDeleteCategory,
    categories,
  } = useFitNotesStore();

  if (!showManageCatsModal) return null;

  return (
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
  );
}
