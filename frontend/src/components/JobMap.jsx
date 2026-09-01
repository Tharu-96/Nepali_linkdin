import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { urgentJobIcon, normalJobIcon } from './maps/leafletIcons';

const mapContainerStyle = {
  width: '100%',
  height: '400px',
  borderRadius: '12px'
};

const defaultCenter = [27.7172, 85.3240];

function FitToJobs({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 0) {
      map.fitBounds(points, { padding: [40, 40] });
    }
  }, [map, points]);
  return null;
}

export default function JobMap({ jobs, onJobClick }) {
  const located = jobs.filter((j) => j.latitude && j.longitude);
  const points = located.map((j) => [parseFloat(j.latitude), parseFloat(j.longitude)]);

  return (
    <div style={{ marginBottom: '24px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #eef2ff', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
      <MapContainer center={defaultCenter} zoom={12} style={mapContainerStyle} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitToJobs points={points} />
        {located.map((job) => (
          <Marker
            key={job.id}
            position={[parseFloat(job.latitude), parseFloat(job.longitude)]}
            icon={job.is_urgent ? urgentJobIcon : normalJobIcon}
          >
            <Popup>
              <div style={{ padding: '2px', maxWidth: '200px' }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#111827' }}>{job.title}</h3>
                <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#4b5563' }}>{job.location}</p>
                <p style={{ margin: '0 0 12px 0', fontSize: '12px', fontWeight: 600, color: '#10b981' }}>{job.salary}</p>
                {onJobClick && (
                  <button
                    onClick={() => onJobClick(job.id)}
                    style={{ width: '100%', padding: '6px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                  >
                    Apply Now
                  </button>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
