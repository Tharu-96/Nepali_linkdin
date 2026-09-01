from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List
import httpx
import asyncio
import logging

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.location import calculate_haversine_distance
from app.models.user import Job
from app.schemas.job import JobNearbyResponse
from app.schemas.maps import GeocodeRequest, GeocodeResponse, ReverseGeocodeRequest, ReverseGeocodeResponse, DistanceResponse

router = APIRouter()

# OpenStreetMap services require a descriptive User-Agent identifying the app.
OSM_USER_AGENT = "Rozgar/1.0 (job-marketplace)"
NOMINATIM_URL = "https://nominatim.openstreetmap.org"
OSRM_URL = "https://router.project-osrm.org"


async def _request_with_retries(url: str, params: dict, headers: dict | None = None, retries: int = 3, timeout: int = 10):
    last_exc = None
    async with httpx.AsyncClient(timeout=timeout, headers=headers) as client:
        for attempt in range(1, retries + 1):
            try:
                resp = await client.get(url, params=params)
                # Retry on transient server-side errors
                if resp.status_code >= 500:
                    last_exc = httpx.HTTPStatusError("Server error", request=resp.request, response=resp)
                    raise last_exc
                return resp
            except (httpx.RequestError, httpx.HTTPStatusError) as e:
                logging.warning("External request failed (%s) attempt %d/%d: %s", url, attempt, retries, str(e))
                last_exc = e
                if attempt < retries:
                    await asyncio.sleep(0.5 * (2 ** (attempt - 1)))
                else:
                    raise HTTPException(status_code=502, detail="External service unavailable; please try again later")


def _format_distance_text(meters: float) -> str:
    if meters < 1000:
        return f"{int(round(meters))} m"
    return f"{meters / 1000:.1f} km"


def _format_duration_text(seconds: float) -> str:
    minutes = int(round(seconds / 60))
    if minutes < 1:
        return "less than a minute"
    if minutes < 60:
        return f"{minutes} min"
    hours, mins = divmod(minutes, 60)
    return f"{hours} hr {mins} min" if mins else f"{hours} hr"


async def _call_geocode_api(address: str) -> dict:
    params = {"q": address, "format": "json", "limit": 1, "addressdetails": 0}
    url = f"{NOMINATIM_URL}/search"
    resp = await _request_with_retries(url, params, headers={"User-Agent": OSM_USER_AGENT})

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Geocoding service returned unexpected status")

    results = resp.json()
    if not results:
        raise HTTPException(status_code=404, detail="Address not found")

    r = results[0]
    return {
        "latitude": float(r["lat"]),
        "longitude": float(r["lon"]),
        "formatted_address": r.get("display_name"),
    }


async def _call_reverse_geocode_api(latitude: float, longitude: float) -> dict:
    params = {"lat": latitude, "lon": longitude, "format": "json"}
    url = f"{NOMINATIM_URL}/reverse"
    resp = await _request_with_retries(url, params, headers={"User-Agent": OSM_USER_AGENT})

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Geocoding service returned unexpected status")

    data = resp.json()
    if not data or "display_name" not in data:
        raise HTTPException(status_code=404, detail="Location not found")

    return {"formatted_address": data.get("display_name")}


def _haversine_distance_result(origin_lat: float, origin_lng: float, dest_lat: float, dest_lng: float) -> dict:
    """Straight-line fallback when the routing service is unavailable."""
    km = calculate_haversine_distance(origin_lat, origin_lng, dest_lat, dest_lng)
    meters = km * 1000
    # Estimate walking time at ~5 km/h (1.4 m/s).
    seconds = meters / 1.4
    return {
        "distance_text": _format_distance_text(meters),
        "distance_meters": int(round(meters)),
        "duration_text": _format_duration_text(seconds),
        "duration_seconds": int(round(seconds)),
    }


async def _call_distance_api(origin_lat: float, origin_lng: float, dest_lat: float, dest_lng: float) -> dict:
    # OSRM expects coordinates as lng,lat.
    coords = f"{origin_lng},{origin_lat};{dest_lng},{dest_lat}"
    url = f"{OSRM_URL}/route/v1/walking/{coords}"
    params = {"overview": "false"}

    try:
        resp = await _request_with_retries(url, params, headers={"User-Agent": OSM_USER_AGENT})
    except HTTPException:
        # Routing service down — fall back to straight-line estimate.
        return _haversine_distance_result(origin_lat, origin_lng, dest_lat, dest_lng)

    if resp.status_code != 200:
        return _haversine_distance_result(origin_lat, origin_lng, dest_lat, dest_lng)

    data = resp.json()
    routes = data.get("routes") or []
    if data.get("code") != "Ok" or not routes:
        return _haversine_distance_result(origin_lat, origin_lng, dest_lat, dest_lng)

    route = routes[0]
    meters = route.get("distance", 0.0)
    seconds = route.get("duration", 0.0)
    return {
        "distance_text": _format_distance_text(meters),
        "distance_meters": int(round(meters)),
        "duration_text": _format_duration_text(seconds),
        "duration_seconds": int(round(seconds)),
    }


@router.post("/geocode", response_model=GeocodeResponse)
async def geocode_address(
    payload: GeocodeRequest,
    current_user=Depends(get_current_user)
):
    return await _call_geocode_api(payload.address)


@router.post("/reverse-geocode", response_model=ReverseGeocodeResponse)
async def reverse_geocode_location(
    payload: ReverseGeocodeRequest,
    current_user=Depends(get_current_user)
):
    return await _call_reverse_geocode_api(payload.latitude, payload.longitude)


@router.get("/jobs/nearby", response_model=List[JobNearbyResponse])
def get_nearby_jobs(
    lat: float = Query(...),
    lng: float = Query(...),
    radius_km: float = Query(10.0),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    # Haversine in SQL (uses radians and acos)
    haversine = (
        "(6371 * acos(cos(radians(:lat)) * cos(radians(j.latitude)) * "
        "cos(radians(j.longitude) - radians(:lng)) + sin(radians(:lat)) * "
        "sin(radians(j.latitude))))"
    )

    sql = text(f"SELECT j.id, j.employer_id, j.title, j.description, j.location, j.salary, j.required_skills, j.is_urgent, j.status, j.latitude, j.longitude, j.created_at, j.updated_at, {haversine} AS distance FROM jobs j WHERE j.latitude IS NOT NULL AND j.longitude IS NOT NULL AND {haversine} <= :radius ORDER BY distance")

    params = {"lat": lat, "lng": lng, "radius": radius_km}
    results = db.execute(sql, params).mappings().all()

    jobs = []
    for row in results:
        job_dict = {
            "id": row.get("id"),
            "employer_id": row.get("employer_id"),
            "title": row.get("title"),
            "description": row.get("description"),
            "location": row.get("location"),
            "salary": row.get("salary"),
            "required_skills": row.get("required_skills"),
            "is_urgent": row.get("is_urgent"),
            "status": row.get("status"),
            "latitude": row.get("latitude"),
            "longitude": row.get("longitude"),
            "created_at": row.get("created_at"),
            "updated_at": row.get("updated_at"),
            "distance": float(row.get("distance")) if row.get("distance") is not None else None
        }
        jobs.append(JobNearbyResponse.parse_obj(job_dict))

    return jobs


@router.get("/distance", response_model=DistanceResponse)
async def get_distance(
    origin_lat: float = Query(...),
    origin_lng: float = Query(...),
    dest_lat: float = Query(...),
    dest_lng: float = Query(...),
    current_user=Depends(get_current_user)
):
    return await _call_distance_api(origin_lat, origin_lng, dest_lat, dest_lng)
