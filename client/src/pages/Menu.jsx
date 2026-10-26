import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, X, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';
import * as api from '../api';

export default function Menu() {
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('items'); // 'items' or 'categories'

  // Item modal
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemForm, setItemForm] = useState({
    name: '', description: '', price: '', category_id: '', is_veg: 1, preparation_time: 15
  });

  // Category modal
  const [showCatModal, setShowCatModal] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [catForm, setCatForm] = useState({ name: '', description: '', icon: '🍽️', sort_order: 0 });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [cats, items] = await Promise.all([api.getCategories(), api.getMenuItems()]);
      setCategories(cats);
      setMenuItems(items);
    } catch (err) {
      toast.error('Failed to load menu');
    } finally {
      setLoading(false);
    }
  }

  // Items CRUD
  async function handleItemSubmit(e) {
    e.preventDefault();
    try {
      const data = { ...itemForm, price: parseFloat(itemForm.price), category_id: parseInt(itemForm.category_id) || null };
      if (editingItem) {
        await api.updateMenuItem(editingItem.id, data);
        toast.success('Item updated');
      } else {
        await api.createMenuItem(data);
        toast.success('Item created');
      }
      setShowItemModal(false);
      setEditingItem(null);
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleToggle(item) {
    try {
      await api.toggleMenuItem(item.id);
      toast.success(`${item.name} ${item.is_available ? 'disabled' : 'enabled'}`);
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleDeleteItem(item) {
    if (!window.confirm(`Delete "${item.name}"?`)) return;
    try {
      await api.deleteMenuItem(item.id);
      toast.success('Item deleted');
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  }

  // Categories CRUD
  async function handleCatSubmit(e) {
    e.preventDefault();
    try {
      if (editingCat) {
        await api.updateCategory(editingCat.id, catForm);
        toast.success('Category updated');
      } else {
        await api.createCategory(catForm);
        toast.success('Category created');
      }
      setShowCatModal(false);
      setEditingCat(null);
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleDeleteCat(cat) {
    if (!window.confirm(`Delete category "${cat.name}"? Items in this category won't be deleted.`)) return;
    try {
      await api.deleteCategory(cat.id);
      toast.success('Category deleted');
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  }

  const filteredItems = searchQuery
    ? menuItems.filter((i) => i.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : menuItems;

  return (
    <div className="page-content">
      <div className="flex items-center justify-between mb-6">
        <div className="tabs">
          <button className={`tab ${activeTab === 'items' ? 'active' : ''}`}
            onClick={() => setActiveTab('items')}>Menu Items ({menuItems.length})</button>
          <button className={`tab ${activeTab === 'categories' ? 'active' : ''}`}
            onClick={() => setActiveTab('categories')}>Categories ({categories.length})</button>
        </div>

        {activeTab === 'items' ? (
          <div className="flex gap-2">
            <div className="search-bar" style={{ width: 260 }}>
              <Search className="search-icon" size={18} />
              <input placeholder="Search items..." value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={() => {
              setEditingItem(null);
              setItemForm({ name: '', description: '', price: '', category_id: '', is_veg: 1, preparation_time: 15 });
              setShowItemModal(true);
            }}>
              <Plus size={16} /> Add Item
            </button>
          </div>
        ) : (
          <button className="btn btn-primary" onClick={() => {
            setEditingCat(null);
            setCatForm({ name: '', description: '', icon: '🍽️', sort_order: 0 });
            setShowCatModal(true);
          }}>
            <Plus size={16} /> Add Category
          </button>
        )}
      </div>

      {activeTab === 'items' ? (
        <div className="card">
          <div className="card-body" style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Prep Time</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id} style={{ opacity: item.is_available ? 1 : 0.5 }}>
                    <td><span className={`veg-indicator ${item.is_veg ? 'veg' : 'non-veg'}`} /></td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{item.name}</div>
                      {item.description && <div className="text-xs text-muted" style={{ marginTop: 2 }}>{item.description}</div>}
                    </td>
                    <td><span className="badge badge-neutral">{item.category_name || 'Uncategorized'}</span></td>
                    <td style={{ fontWeight: 700, color: 'var(--accent-success-light)' }}>₹{item.price}</td>
                    <td className="text-muted">{item.preparation_time}m</td>
                    <td>
                      <button className="btn btn-icon btn-ghost btn-sm" onClick={() => handleToggle(item)}
                        style={{ color: item.is_available ? 'var(--accent-success)' : 'var(--text-muted)' }}>
                        {item.is_available ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                      </button>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-icon btn-ghost btn-sm" onClick={() => {
                          setEditingItem(item);
                          setItemForm({
                            name: item.name, description: item.description || '', price: item.price,
                            category_id: item.category_id || '', is_veg: item.is_veg, preparation_time: item.preparation_time
                          });
                          setShowItemModal(true);
                        }}>
                          <Edit2 size={14} />
                        </button>
                        <button className="btn btn-icon btn-ghost btn-sm" onClick={() => handleDeleteItem(item)}
                          style={{ color: 'var(--accent-danger)' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid-3">
          {categories.map((cat) => (
            <div key={cat.id} className="card animate-in">
              <div className="card-body" style={{ textAlign: 'center', padding: 24 }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>{cat.icon}</div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 4 }}>{cat.name}</h3>
                <p className="text-sm text-muted">{cat.item_count || 0} items</p>
                {cat.description && <p className="text-xs text-muted mt-2">{cat.description}</p>}
              </div>
              <div className="card-footer">
                <button className="btn btn-sm btn-ghost" onClick={() => {
                  setEditingCat(cat);
                  setCatForm({ name: cat.name, description: cat.description || '', icon: cat.icon, sort_order: cat.sort_order });
                  setShowCatModal(true);
                }}>
                  <Edit2 size={14} /> Edit
                </button>
                <button className="btn btn-sm btn-ghost" onClick={() => handleDeleteCat(cat)}
                  style={{ color: 'var(--accent-danger)' }}>
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Item Modal */}
      {showItemModal && (
        <div className="modal-overlay" onClick={() => setShowItemModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h2>{editingItem ? 'Edit Menu Item' : 'Add New Menu Item'}</h2>
              <button className="btn btn-icon btn-ghost" onClick={() => setShowItemModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleItemSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Item Name *</label>
                  <input className="form-input" value={itemForm.name}
                    onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                    placeholder="e.g. Empire Special Chicken Kebab" required />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea className="form-textarea" value={itemForm.description}
                    onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                    placeholder="Brief ingredients and preparation notes..." />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Price (₹) *</label>
                    <input className="form-input" type="number" step="0.01" value={itemForm.price}
                    onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })}
                    placeholder="0.00" required />
                  </div>
                  <div className="form-group">
                    <label>Category *</label>
                    <select className="form-select" value={itemForm.category_id}
                      onChange={(e) => setItemForm({ ...itemForm, category_id: e.target.value })}>
                      <option value="">Select category</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Prep Time (minutes)</label>
                    <input className="form-input" type="number" value={itemForm.preparation_time}
                      onChange={(e) => setItemForm({ ...itemForm, preparation_time: parseInt(e.target.value) || 15 })} />
                  </div>
                  <div className="form-group">
                    <label>Dietary Type</label>
                    <div className="flex items-center gap-2" style={{ marginTop: 4 }}>
                      <button
                        type="button"
                        className={`filter-chip ${itemForm.is_veg ? 'active' : ''}`}
                        style={{
                          borderColor: itemForm.is_veg ? '#16a34a' : 'var(--border-primary)',
                          color: itemForm.is_veg ? '#15803d' : 'var(--text-secondary)',
                          background: itemForm.is_veg ? '#ecfdf5' : '#ffffff',
                          padding: '6px 14px',
                        }}
                        onClick={() => setItemForm({ ...itemForm, is_veg: 1 })}
                      >
                        <span className="veg-badge" style={{ width: 12, height: 12 }} />
                        <span>Veg</span>
                      </button>
                      <button
                        type="button"
                        className={`filter-chip ${!itemForm.is_veg ? 'active' : ''}`}
                        style={{
                          borderColor: !itemForm.is_veg ? '#dc2626' : 'var(--border-primary)',
                          color: !itemForm.is_veg ? '#b91c1c' : 'var(--text-secondary)',
                          background: !itemForm.is_veg ? '#fef2f2' : '#ffffff',
                          padding: '6px 14px',
                        }}
                        onClick={() => setItemForm({ ...itemForm, is_veg: 0 })}
                      >
                        <span className="non-veg-badge" style={{ width: 12, height: 12 }} />
                        <span>Non-Veg</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowItemModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingItem ? 'Save Changes' : 'Add Item'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {showCatModal && (
        <div className="modal-overlay" onClick={() => setShowCatModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h2>{editingCat ? 'Edit Category' : 'Add Category'}</h2>
              <button className="btn btn-icon btn-ghost" onClick={() => setShowCatModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleCatSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Category Name</label>
                  <input className="form-input" value={catForm.name}
                    onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                    placeholder="e.g. Appetizers" required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Icon (emoji)</label>
                    <input className="form-input" value={catForm.icon}
                      onChange={(e) => setCatForm({ ...catForm, icon: e.target.value })}
                      placeholder="🍽️" />
                  </div>
                  <div className="form-group">
                    <label>Sort Order</label>
                    <input className="form-input" type="number" value={catForm.sort_order}
                      onChange={(e) => setCatForm({ ...catForm, sort_order: parseInt(e.target.value) })} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea className="form-textarea" value={catForm.description}
                    onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
                    placeholder="Optional description..." />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowCatModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingCat ? 'Update' : 'Add Category'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
