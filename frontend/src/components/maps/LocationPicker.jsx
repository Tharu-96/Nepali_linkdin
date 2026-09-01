import React, { useState, useCallback, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import API from '../../api'
import { userLocationIcon } from './leafletIcons'

const containerStyle = { width: '100%', height: '400px' }

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }

// Keep the Leaflet map centered on the current position when it changes.
function Recenter({ position }) {
  const map = useMap()
  useEffect(() => {
    if (position && position.lat != null && position.lng != null) {
      map.setView([position.lat, position.lng])
    }
  }, [map, position])
  return null
}

export default function LocationPicker({ initial = { lat: 27.7172, lng: 85.3240 }, onChange }) {
  const [position, setPosition] = useState(initial)
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (initial && initial.lat != null && initial.lng != null) {
      setPosition({ lat: Number(initial.lat), lng: Number(initial.lng) })
    }
  }, [initial?.lat, initial?.lng])

  const onDragEnd = useCallback((e) => {
    const { lat, lng } = e.target.getLatLng()
    setPosition({ lat, lng })
    if (onChange) onChange({ lat, lng })
  }, [onChange])

  const lookupAddress = async () => {
    if (!address || !address.trim()) {
      setError('Please enter an address to search')
      return
    }
    setError(null)
    setLoading(true)
    const maxRetries = 3
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const res = await API.post('/maps/geocode', { address })
        const lat = res.data.latitude
        const lng = res.data.longitude
        setPosition({ lat, lng })
        if (onChange) onChange({ lat, lng })
        setLoading(false)
        return
      } catch (err) {
        const status = err?.response?.status
        // Non-transient errors should not be retried
        if (status && [400, 401, 403, 404, 429].includes(status)) {
          setError(err?.response?.data?.detail || 'Address lookup failed')
          setLoading(false)
          return
        }
        if (attempt < maxRetries) {
          await sleep(300 * 2 ** (attempt - 1))
          continue
        }
        setError('Failed to lookup address. Please try again later.')
        setLoading(false)
      }
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <input
          placeholder="Type an address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          style={{ width: '70%' }}
          disabled={loading}
        />
        <button onClick={lookupAddress} disabled={loading} style={{ marginLeft: 8 }}>
          {loading ? 'Finding...' : 'Find'}
        </button>
      </div>
      {error && <div style={{ color: 'crimson', marginBottom: 8 }}>{error}</div>}
      <div style={{ marginBottom: 8, color: '#6b7280' }}>Drag the marker to fine-tune the location.</div>
      <MapContainer center={[position.lat, position.lng]} zoom={13} style={containerStyle} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Recenter position={position} />
        <Marker
          position={[position.lat, position.lng]}
          icon={userLocationIcon}
          draggable
          eventHandlers={{ dragend: onDragEnd }}
        />
      </MapContainer>
    </div>
  )
}
