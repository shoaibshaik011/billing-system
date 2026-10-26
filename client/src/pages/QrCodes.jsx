import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { QrCode, Printer, Download, ExternalLink, Sparkles, Smartphone, Utensils, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import * as api from '../api';

export default function QrCodes() {
  const [tables, setTables] = useState([]);
  const [qrImages, setQrImages] = useState({});
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedFloor, setSelectedFloor] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [tablesData, settingsData] = await Promise.all([
        api.getTables(),
        api.getSettings(),
      ]);
      setTables(tablesData);
      setSettings(settingsData);
      generateAllQr(tablesData);
    } catch (err) {
      toast.error('Failed to load table QR data');
    } finally {
      setLoading(false);
    }
  }

  async function generateAllQr(tablesList) {
    const images = {};
    for (const t of tablesList) {
      const guestUrl = `${window.location.origin}/table/${t.table_number}`;
      try {
        const dataUrl = await QRCode.toDataURL(guestUrl, {
          width: 320,
          margin: 2,
          color: {
            dark: '#111827',
            light: '#ffffff',
          },
        });
        images[t.id] = dataUrl;
      } catch (err) {
        console.error(err);
      }
    }
    setQrImages(images);
  }

  function handlePrintAll() {
    window.print();
  }

  function downloadQr(table) {
    const dataUrl = qrImages[table.id];
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `QR_Code_${settings?.restaurant_name || 'Restaurant'}_Table_${table.table_number}.png`;
    a.click();
    toast.success(`Downloaded QR for Table ${table.table_number}`);
  }

  const floors = ['all', ...new Set(tables.map((t) => t.floor))];
  const filteredTables = selectedFloor === 'all' ? tables : tables.filter((t) => t.floor === selectedFloor);

  return (
    <div className="page-content">
      {/* Banner */}
      <div
        className="card mb-6"
        style={{
          background: 'linear-gradient(135deg, rgba(225, 29, 36, 0.05) 0%, rgba(245, 158, 11, 0.05) 100%)',
          borderColor: 'var(--empire-red-border)',
          padding: 24,
        }}
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div
              style={{
                width: 50,
                height: 50,
                borderRadius: '50%',
                background: 'var(--empire-red)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(225, 29, 36, 0.25)',
              }}
            >
              <QrCode size={26} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                Table QR Code Guest Ordering
              </h2>
              <p className="text-sm text-muted" style={{ margin: 0 }}>
                Print these QR stand cards for each table. Guests scan with their phone camera to view the menu & order directly to the kitchen!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="btn btn-outline-red" onClick={handlePrintAll}>
              <Printer size={16} /> Print All Table Stands
            </button>
            <a
              href={`/table/T1`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary"
            >
              <Smartphone size={16} /> Test Mobile Order (Table T1)
            </a>
          </div>
        </div>
      </div>

      {/* Filter by Floor */}
      <div className="flex items-center gap-2 mb-6">
        {floors.map((fl) => (
          <button
            key={fl}
            className={`filter-chip ${selectedFloor === fl ? 'active' : ''}`}
            onClick={() => setSelectedFloor(fl)}
          >
            {fl === 'all' ? `All Tables (${tables.length})` : `${fl} Floor (${tables.filter((t) => t.floor === fl).length})`}
          </button>
        ))}
      </div>

      {/* QR Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 20,
        }}
      >
        {filteredTables.map((table) => {
          const guestUrl = `${window.location.origin}/table/${table.table_number}`;
          const qrSrc = qrImages[table.id];

          return (
            <div
              key={table.id}
              className="card table-qr-card animate-in"
              style={{
                padding: 0,
                border: '1.5px solid var(--border-primary)',
                textAlign: 'center',
                background: '#ffffff',
                overflow: 'hidden',
              }}
            >
              {/* Stand Card Top */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #d31219, #e11d24)',
                  color: '#ffffff',
                  padding: '16px 20px',
                }}
              >
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, opacity: 0.9 }}>
                  {settings?.restaurant_name || 'EMPIRE RESTAURANT'}
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, marginTop: 2 }}>
                  TABLE {table.table_number}
                </div>
                <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                  {table.floor} Floor • {table.capacity} Guests
                </div>
              </div>

              {/* QR Image */}
              <div style={{ padding: '24px 20px 16px', background: '#ffffff' }}>
                <div
                  style={{
                    display: 'inline-block',
                    padding: 8,
                    borderRadius: 14,
                    border: '2px dashed var(--empire-red-border)',
                    background: '#ffffff',
                    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.05)',
                  }}
                >
                  {qrSrc ? (
                    <img src={qrSrc} alt={`QR for Table ${table.table_number}`} width={180} height={180} style={{ display: 'block' }} />
                  ) : (
                    <div style={{ width: 180, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      Generating...
                    </div>
                  )}
                </div>

                <div style={{ marginTop: 14 }}>
                  <div className="flex items-center justify-center gap-1.5" style={{ color: 'var(--empire-red)', fontWeight: 800, fontSize: '0.9rem' }}>
                    <Smartphone size={16} /> Scan with Camera to Order
                  </div>
                  <p className="text-xs text-muted" style={{ marginTop: 4 }}>
                    No app download required • Instant KOT
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div
                style={{
                  padding: '12px 16px',
                  background: '#f8fafc',
                  borderTop: '1px solid var(--border-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <a
                  href={`/table/${table.table_number}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <ExternalLink size={14} /> Open Guest Menu
                </a>
                <button className="btn btn-secondary btn-sm" onClick={() => downloadQr(table)}>
                  <Download size={14} /> Download QR
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
