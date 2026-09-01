import React from 'react';

export default function KpiCard({ title, value, color, icon }) {
  return (
    <div style={{
      padding: '20px', 
      backgroundColor: '#ffffff', 
      borderRadius: '12px', 
      boxShadow: '0 4px 12px rgba(0,0,0,0.05)', 
      border: '1px solid #eef2ff',
      display: 'flex',
      alignItems: 'center',
      gap: '16px'
    }}>
      <div style={{
        width: '48px', height: '48px', 
        borderRadius: '50%', 
        backgroundColor: `${color}20`, 
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: color,
        fontSize: '24px'
      }}>
        {icon}
      </div>
      <div>
        <h3 style={{ margin: 0, fontSize: '14px', color: '#6b7280', fontWeight: 500 }}>{title}</h3>
        <p style={{ margin: '4px 0 0 0', fontSize: '28px', color: '#111827', fontWeight: 'bold' }}>{value != null ? value : 0}</p>
      </div>
    </div>
  );
}
