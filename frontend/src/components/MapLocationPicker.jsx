import React from 'react'
import LocationPicker from './maps/LocationPicker'

export default function MapLocationPicker({ latitude, longitude, onChange }) {
  const initial = (latitude && longitude) ? { lat: Number(latitude), lng: Number(longitude) } : undefined
  return <LocationPicker initial={initial} onChange={onChange} />
}
