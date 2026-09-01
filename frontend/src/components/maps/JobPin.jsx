import React, { useEffect, useState } from 'react'
import API from '../../api'

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }

export default function JobPin({ job, origin }) {
  const [distance, setDistance] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let mounted = true
    async function fetchDistance() {
      if (!origin || !job.latitude || !job.longitude) return
      setLoading(true)
      setError(null)
      const maxRetries = 3
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const res = await API.get('/maps/distance', {
            params: {
              origin_lat: origin.lat,
              origin_lng: origin.lng,
              dest_lat: job.latitude,
              dest_lng: job.longitude
            }
          })
          if (mounted) setDistance(res.data)
          setLoading(false)
          return
        } catch (err) {
          const status = err?.response?.status
          if (status && [400, 401, 403, 404, 429].includes(status)) {
            // Non-retryable - show friendly message and stop
            setError(err?.response?.data?.detail || 'Distance lookup failed')
            setLoading(false)
            return
          }
          if (attempt < maxRetries) {
            await sleep(300 * 2 ** (attempt - 1))
            continue
          }
          setError('Failed to calculate route. Try again later.')
          setLoading(false)
        }
      }
    }
    fetchDistance()
    return () => { mounted = false }
  }, [job, origin])
  const handleOpenDirections = async () => {
    try {
      let originCoords = origin
      if (!originCoords || !originCoords.lat || !originCoords.lng) {
        originCoords = await new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition((p) => resolve(p.coords), (e) => reject(e))
        )
      }
      const url = `https://www.google.com/maps/dir/?api=1&origin=${originCoords.lat},${originCoords.lng}&destination=${job.latitude},${job.longitude}`
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      // Fallback: open map centered on the job location
      const url = `https://www.google.com/maps/search/?api=1&query=${job.latitude},${job.longitude}`
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div style={{ maxWidth: 300 }}>
      <h3 style={{ margin: 0 }}>{job.title}</h3>
      <p style={{ margin: '4px 0' }}>{job.location}</p>
      <p style={{ margin: '4px 0' }}><strong>Estimated Salary:</strong> {job.salary}</p>
      {loading ? (
        <p style={{ margin: '4px 0', color: '#6b7280' }}>Calculating distance...</p>
      ) : error ? (
        <p style={{ margin: '4px 0', color: 'crimson' }}>{error}</p>
      ) : distance ? (
        <p style={{ margin: '4px 0' }}>{distance.distance_text} | ~{distance.duration_text}</p>
      ) : (
        job.distance ? <p style={{ margin: '4px 0' }}>{job.distance.toFixed(2)} km away</p> : null
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
        <a href={`/jobs/${job.id}`} className="link">View job</a>

        {job.latitude && job.longitude && (
          origin && origin.lat && origin.lng ? (
            <a
              href={`https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${job.latitude},${job.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm btn-primary"
              style={{ marginLeft: 8 }}
            >
              Get Directions
            </a>
          ) : (
            <button onClick={handleOpenDirections} className="btn btn-sm btn-primary" style={{ marginLeft: 8 }}>
              Get Directions
            </button>
          )
        )}
      </div>
    </div>
  )
}
