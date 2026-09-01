import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API, { jobsAPI } from "../api";
import MapLocationPicker from "../components/MapLocationPicker";

export default function PostJob() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: "",
    description: "",
    location: "",
    salary: "",
    required_skills: "",
    is_urgent: false,
    latitude: "",
    longitude: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === "checkbox" ? checked : value });
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported in this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const latitude = pos.coords.latitude;
        const longitude = pos.coords.longitude;

        setForm((prev) => ({
          ...prev,
          latitude: latitude.toString(),
          longitude: longitude.toString(),
        }));

        try {
          const reverseRes = await API.post("/maps/reverse-geocode", { latitude, longitude });
          if (reverseRes.data?.formatted_address) {
            setForm((prev) => ({
              ...prev,
              location: reverseRes.data.formatted_address,
            }));
          }
        } catch (err) {
          console.error("Reverse geocoding failed:", err);
        }
      },
      (error) => {
        console.error("Error fetching location:", error);
        setError("Could not get your location. Please enter manually.");
      },
      { enableHighAccuracy: true }
    );
  };

  const handleMapChange = (coords) => {
    setForm({ ...form, latitude: coords.lat, longitude: coords.lng });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        location: form.location,
        salary: form.salary,
        required_skills: form.required_skills || null,
        is_urgent: form.is_urgent,
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
      };
      await jobsAPI.createJob(payload);
      navigate("/jobs");
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to post job");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Post a New Job</h1>
        <p className="subtitle">Fill in the details to find the right workers</p>
      </div>

      <div className="form-card">
        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="form-grid">
          <div className="form-group">
            <label htmlFor="title">Job Title *</label>
            <input
              id="title"
              name="title"
              type="text"
              placeholder="e.g. Plumber needed"
              value={form.title}
              onChange={handleChange}
              required
              minLength={2}
              maxLength={150}
            />
          </div>

          <div className="form-group full-width">
            <label htmlFor="description">Description *</label>
            <textarea
              id="description"
              name="description"
              placeholder="Describe the job, requirements, timing..."
              value={form.description}
              onChange={handleChange}
              required
              minLength={5}
              rows={4}
            />
          </div>

          <div className="form-group">
            <label htmlFor="job-location">Location *</label>
            <input
              id="job-location"
              name="location"
              type="text"
              placeholder="e.g. Kathmandu, Lalitpur"
              value={form.location}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="salary">Estimated Salary *</label>
            <input
              id="salary"
              name="salary"
              type="text"
              placeholder="e.g. Rs. 5000/day"
              value={form.salary}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group full-width">
            <label htmlFor="required_skills">Required Skills</label>
            <input
              id="required_skills"
              name="required_skills"
              type="text"
              placeholder="e.g. Plumbing, Electrical (comma-separated)"
              value={form.required_skills}
              onChange={handleChange}
            />
          </div>

          <div className="form-group full-width">
            <label>Pinpoint Location on Map *</label>
            <MapLocationPicker 
              latitude={form.latitude} 
              longitude={form.longitude} 
              onChange={handleMapChange} 
            />
            <button type="button" className="btn btn-outline btn-sm" onClick={handleGetLocation} style={{ marginTop: '8px' }}>
              📍 Use My Current Location
            </button>
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                name="is_urgent"
                type="checkbox"
                checked={form.is_urgent}
                onChange={handleChange}
              />
              <span>🚨 Mark as Urgent</span>
            </label>
          </div>

          <div className="form-actions full-width">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Posting..." : "Post Job"}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => navigate("/jobs")}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
