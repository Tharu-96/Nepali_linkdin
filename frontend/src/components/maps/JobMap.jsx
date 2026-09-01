import React, { useState, useEffect, useCallback, useRef, useImperativeHandle, forwardRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import API from '../../api'
import RadiusFilter from './RadiusFilter'
import WorkerLocationConsent from './WorkerLocationConsent'
import JobPin from './JobPin'
import { urgentJobIcon, normalJobIcon, userLocationIcon } from './leafletIcons'

const containerStyle = {
  width: '100%',
  height: '600px'
}

const DEFAULT_CENTER = { lat: 27.7172, lng: 85.3240 } // Kathmandu

// Captures the Leaflet map instance so imperative handlers can control it.
function MapController({ mapRef }) {
  const map = useMap()
  useEffect(() => {
    mapRef.current = map
    return () => { mapRef.current = null }
  }, [map, mapRef])
  return null
}

// Keeps the map centered on the active location as it changes.
function Recenter({ center }) {
  const map = useMap()
  useEffect(() => {
    if (center && center.lat != null && center.lng != null) {
      map.setView([center.lat, center.lng])
    }
  }, [map, center])
  return null
}

function JobMap({ jobs: externalJobs = null, origin: externalOrigin = null, onJobSelect = null, selectedJobId = null }, ref) {
  const [center, setCenter] = useState(DEFAULT_CENTER)
  const [jobs, setJobs] = useState([])
  const [userLocation, setUserLocation] = useState(null)
  const [radiusKm, setRadiusKm] = useState(10)
  const [loadingJobs, setLoadingJobs] = useState(false)
  const [jobsError, setJobsError] = useState(null)
  const [routeLine, setRouteLine] = useState(null)
  const mapInstanceRef = useRef(null)

  // Expose imperative API to parent via ref. With Leaflet the "route" is drawn
  // as a straight polyline between origin and destination (no billed API).
  useImperativeHandle(ref, () => ({
    showRoute: (origin, destination) => {
      try {
        const o = origin && origin.lat != null && origin.lng != null
          ? { lat: Number(origin.lat), lng: Number(origin.lng) } : null
        const d = destination && destination.lat != null && destination.lng != null
          ? { lat: Number(destination.lat), lng: Number(destination.lng) } : null
        if (!o || !d) return
        const line = [[o.lat, o.lng], [d.lat, d.lng]]
        setRouteLine(line)
        if (mapInstanceRef.current) {
          mapInstanceRef.current.fitBounds(line, { padding: [50, 50] })
        }
      } catch (err) {
        console.error('showRoute error', err)
      }
    },
    clearRoute: () => setRouteLine(null)
  }))

  // Use externalOrigin's lat/lng to compute the current center with fallback to internal states
  const mapCenter = externalOrigin && externalOrigin.lat && externalOrigin.lng
    ? { lat: Number(externalOrigin.lat), lng: Number(externalOrigin.lng) }
    : (userLocation && userLocation.lat && userLocation.lng
        ? { lat: Number(userLocation.lat), lng: Number(userLocation.lng) }
        : center)

  const fetchJobsNearby = useCallback(async (lat, lng, radius) => {
    setJobsError(null)
    setLoadingJobs(true)
    const maxRetries = 3
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const res = await API.get('/maps/jobs/nearby', { params: { lat, lng, radius_km: radius } })
        setJobs(res.data)
        setLoadingJobs(false)
        return
      } catch (err) {
        const status = err?.response?.status
        if (status && [400, 401, 403, 404].includes(status)) {
          setJobsError(err?.response?.data?.detail || 'Failed to fetch nearby jobs')
          setLoadingJobs(false)
          return
        }
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 300 * 2 ** (attempt - 1)))
          continue
        }
        setJobsError('Failed to fetch nearby jobs. Please try again later.')
        setLoadingJobs(false)
      }
    }
  }, [])

  const fetchAllJobs = useCallback(async () => {
    setJobsError(null)
    setLoadingJobs(true)
    const maxRetries = 3
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const res = await API.get('/jobs')
        setJobs(res.data)
        setLoadingJobs(false)
        return
      } catch (err) {
        const status = err?.response?.status
        if (status && [400, 401, 403, 404].includes(status)) {
          setJobsError(err?.response?.data?.detail || 'Failed to fetch jobs')
          setLoadingJobs(false)
          return
        }
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 300 * 2 ** (attempt - 1)))
          continue
        }
        setJobsError('Failed to fetch jobs. Please try again later.')
        setLoadingJobs(false)
      }
    }
  }, [])

  useEffect(() => {
    // If parent provided an explicit jobs list, use it and avoid fetching
    if (externalJobs) {
      setJobs(externalJobs)
      if (externalOrigin && externalOrigin.lat && externalOrigin.lng) {
        setUserLocation({ lat: externalOrigin.lat, lng: externalOrigin.lng })
        setCenter({ lat: externalOrigin.lat, lng: externalOrigin.lng })
      }
      return
    }
    // If user location present & consented, fetch nearby jobs
    if (userLocation) {
      fetchJobsNearby(userLocation.lat, userLocation.lng, radiusKm)
      setCenter({ lat: userLocation.lat, lng: userLocation.lng })
    } else {
      fetchAllJobs()
    }
  }, [userLocation, radiusKm, fetchJobsNearby, fetchAllJobs, externalJobs, externalOrigin])

  // If parent requests a specific selected job, recenter map on it
  useEffect(() => {
    if (!selectedJobId) return
    const list = externalJobs || jobs
    const job = list.find((j) => String(j.id) === String(selectedJobId))
    if (job && job.latitude && job.longitude) {
      setCenter({ lat: Number(job.latitude), lng: Number(job.longitude) })
    }
  }, [selectedJobId, externalJobs, jobs])

  return (
    <div>
      {jobsError && (
        <div style={{ padding: 8, background: '#fef3f2', color: '#b91c1c', marginBottom: 12, borderRadius: 6 }}>
          <strong>Map error:</strong> {jobsError} <button onClick={() => {
            if (userLocation) fetchJobsNearby(userLocation.lat, userLocation.lng, radiusKm)
            else fetchAllJobs()
          }} style={{ marginLeft: 8 }}>Retry</button>
        </div>
      )}
      {loadingJobs && <div style={{ marginBottom: 12, color: '#6b7280' }}>Loading jobs...</div>}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <RadiusFilter value={radiusKm} onChange={(v) => setRadiusKm(v)} />
        <WorkerLocationConsent onConsent={(pos) => setUserLocation(pos)} />
      </div>

      <MapContainer center={[mapCenter.lat, mapCenter.lng]} zoom={13} style={containerStyle} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapController mapRef={mapInstanceRef} />
        <Recenter center={mapCenter} />

        {/* Blue pin showing the worker's shared/searched location */}
        {mapCenter && mapCenter.lat && mapCenter.lng && (
          <Marker position={[mapCenter.lat, mapCenter.lng]} icon={userLocationIcon} />
        )}

        {jobs.map((job) => (
          job.latitude && job.longitude ? (
            <Marker
              key={job.id}
              position={[Number(job.latitude), Number(job.longitude)]}
              icon={job.is_urgent ? urgentJobIcon : normalJobIcon}
              eventHandlers={{ click: () => { if (onJobSelect) onJobSelect(job) } }}
            >
              <Popup>
                <JobPin job={job} origin={externalOrigin?.lat ? { lat: externalOrigin.lat, lng: externalOrigin.lng } : userLocation} />
              </Popup>
            </Marker>
          ) : null
        ))}

        {routeLine && <Polyline positions={routeLine} pathOptions={{ color: '#4f46e5', weight: 4 }} />}
      </MapContainer>
    </div>
  )
}

export default forwardRef(JobMap)
