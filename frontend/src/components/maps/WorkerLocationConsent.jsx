import React, { useState } from 'react'
import { profilesAPI } from '../../api'

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }

export default function WorkerLocationConsent({ onConsent }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const requestConsent = () => {
    setOpen(true)
  }

  const shareLocation = () => {
    if (!navigator.geolocation) return alert('Geolocation not supported')
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const lat = pos.coords.latitude
      const lng = pos.coords.longitude
      setSaving(true)
      const maxRetries = 3
      try {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            await profilesAPI.updateWorkerProfile({ latitude: lat, longitude: lng, location_sharing_consent: true })
            if (onConsent) onConsent({ lat, lng })
            setOpen(false)
            setSaving(false)
            return
          } catch (err) {
            const status = err?.response?.status
            // don't retry on obvious client errors
            if (status && [400, 401, 403, 404].includes(status)) {
              alert(err?.response?.data?.detail || 'Failed to save location consent')
              setSaving(false)
              return
            }
            if (attempt < maxRetries) {
              await sleep(300 * 2 ** (attempt - 1))
              continue
            }
            alert('Failed to save location after several attempts. Please try again later.')
            setSaving(false)
          }
        }
      } catch (err) {
        console.error('Failed to save consent/location', err)
        alert('Failed to save location consent')
        setSaving(false)
      }
    }, (err) => {
      alert('Could not get location: ' + err.message)
    }, { enableHighAccuracy: true })
  }

  return (
    <div>
      <button onClick={requestConsent} disabled={saving}>{saving ? 'Saving...' : 'Share Location'}</button>
      {open && (
        <div style={{ padding: 12, border: '1px solid #ddd', marginTop: 8 }}>
          <p>Allow sharing your approximate location to see nearby jobs. You can revoke this later in your profile.</p>
          <button onClick={shareLocation} disabled={saving}>{saving ? 'Saving...' : 'Allow & Share'}</button>
          <button onClick={() => setOpen(false)} disabled={saving}>Cancel</button>
        </div>
      )}
    </div>
  )
}
