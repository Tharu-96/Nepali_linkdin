import React from 'react'

export default function RadiusFilter({ value = 10, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <label>Radius:</label>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
        <option value={5}>5 km</option>
        <option value={10}>10 km</option>
        <option value={25}>25 km</option>
      </select>
    </div>
  )
}
