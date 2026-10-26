import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users as UsersIcon, X, MapPin, Store, Utensils, Receipt } from 'lucide-react';
import toast from 'react-hot-toast';
import * as api from '../api';

export default function Tables() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTable, setEditingTable] = useState(null);
  const [form, setForm] = useState({ table_number: '', capacity: 4, floor: 'Ground' });
  const [floorFilter, setFloorFilter] = useState('all');
  const navigate = useNavigate();

  useEffect(() => {
    loadTables();
    const interval = setInterval(loadTables, 10000);
    return () => clearInterval(interval);
  }, []);

  async function loadTables() {
    try {
      const data = await api.getTables();
      setTables(data);
    } catch (err) {
      toast.error('Failed to load tables');
    } finally {
      setLoading(false);
    }
  }

  const floors = [...new Set(tables.map((t) => t.floor))];

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (editingTable) {
        await api.updateTable(editingTable.id, form);
        toast.success('Table updated');
      } else {
        await api.createTable(form);
        toast.success('Table created');
      }
      setShowModal(false);
      setEditingTable(null);
      setForm({ table_number: '', capacity: 4, floor: 'Ground' });
      loadTables();
    } catch (err) {
      toast.error(err.message);
    }
  }

  function handleTableClick(table) {
    if (table.status === 'available') {
      navigate(`/orders?new=1&table_id=${table.id}&table_number=${table.table_number}`);
    } else if (table.active_order_id) {
      navigate(`/orders?order_id=${table.active_order_id}`);
    }
  }

  return (
    <div className="page-content">
      {/* Top Bar with Empire Filters & Add Action */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            className={`filter-chip ${floorFilter === 'all' ? 'active' : ''}`}
            onClick={() => setFloorFilter('all')}
          >
            All Floors ({tables.length})
          </button>
          {floors.map((fl) => (
            <button
              key={fl}
              className={`filter-chip ${floorFilter === fl ? 'active' : ''}`}
              onClick={() => setFloorFilter(fl)}
            >
              {fl} Floor ({tables.filter((t) => t.floor === fl).length})
            </button>
          ))}
          <div className="flex items-center gap-2 ml-4">
            <span className="badge badge-open">Available ({tables.filter((t) => t.status === 'available').length})</span>
            <span className="badge badge-danger">Occupied ({tables.filter((t) => t.status === 'occupied').length})</span>
            <span className="badge badge-warning">Reserved ({tables.filter((t) => t.status === 'reserved').length})</span>
          </div>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => {
            setEditingTable(null);
            setForm({ table_number: '', capacity: 4, floor: 'Ground' });
            setShowModal(true);
          }}
        >
          <Plus size={16} /> Add Table
        </button>
      </div>

      {/* Floors Grid */}
      {floors
        .filter((fl) => floorFilter === 'all' || floorFilter === fl)
        .map((floor) => (
          <div key={floor} className="mb-6 animate-in">
            <div className="flex items-center gap-2 mb-3">
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                📍 {floor} Floor Dining Area
              </h3>
              <span className="text-xs text-muted">
                ({tables.filter((t) => t.floor === floor).length} tables)
              </span>
            </div>

            <div className="floor-grid">
              {tables.filter((t) => t.floor === floor).map((table) => (
                <div
                  key={table.id}
                  className={`table-card ${table.status}`}
                  onClick={() => handleTableClick(table)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="table-number">{table.table_number}</span>
                    <span
                      className={`badge ${
                        table.status === 'available'
                          ? 'badge-open'
                          : table.status === 'occupied'
                          ? 'badge-danger'
                          : 'badge-warning'
                      }`}
                    >
                      {table.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-xs text-muted mb-3">
                    <UsersIcon size={13} />
                    <span>{table.capacity} Guests</span>
                  </div>

                  {table.status === 'available' ? (
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
                    >
                      <Utensils size={13} /> Take Order
                    </button>
                  ) : (
                    <div>
                      {table.running_amount > 0 && (
                        <div
                          style={{
                            fontWeight: 800,
                            color: 'var(--empire-red)',
                            fontSize: '1.05rem',
                            marginBottom: 6,
                          }}
                        >
                          ₹{table.running_amount.toLocaleString('en-IN')}
                        </div>
                      )}
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{
                          width: '100%',
                          justifyContent: 'center',
                          borderColor: 'var(--empire-red)',
                          color: 'var(--empire-red)',
                        }}
                      >
                        <Receipt size={13} /> View Active Bill
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card animate-in" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingTable ? 'Edit Table' : 'Add New Table'}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="modal-body space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted mb-1 block">Table Identifier / Number *</label>
                <input
                  type="text"
                  className="input"
                  required
                  placeholder="e.g. T13, VIP-1"
                  value={form.table_number}
                  onChange={(e) => setForm({ ...form, table_number: e.target.value })}
                />
              </div>
              <div className="grid-2">
                <div>
                  <label className="text-xs font-semibold text-muted mb-1 block">Seating Capacity</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    className="input"
                    value={form.capacity}
                    onChange={(e) => setForm({ ...form, capacity: parseInt(e.target.value) || 2 })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted mb-1 block">Floor Section</label>
                  <select
                    className="input"
                    value={form.floor}
                    onChange={(e) => setForm({ ...form, floor: e.target.value })}
                  >
                    <option value="Ground">Ground Floor</option>
                    <option value="First">First Floor</option>
                    <option value="Rooftop">Rooftop / Terrace</option>
                    <option value="Family AC">Family AC Hall</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingTable ? 'Save Changes' : 'Create Table'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
