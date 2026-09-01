from pydantic import BaseModel
from typing import Optional

class GeocodeRequest(BaseModel):
    address: str

class GeocodeResponse(BaseModel):
    latitude: float
    longitude: float
    formatted_address: str

class ReverseGeocodeRequest(BaseModel):
    latitude: float
    longitude: float

class ReverseGeocodeResponse(BaseModel):
    formatted_address: str

class DistanceResponse(BaseModel):
    distance_text: str
    distance_meters: int
    duration_text: str
    duration_seconds: int
