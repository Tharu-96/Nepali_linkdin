import { useEffect, useState, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { profilesAPI, reviewsAPI } from "../api";
import ReviewSummary from "../components/reviews/ReviewSummary";
import ReviewCard from "../components/reviews/ReviewCard";

export default function Profile() {
  const { role, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paymentSaved, setPaymentSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fileInputRef = useRef(null);
  const [removingPhoto, setRemovingPhoto] = useState(false);
  const [adminInfo, setAdminInfo] = useState({
    phoneNumber: localStorage.getItem("admin_phone_number") || "",
    secondarySecurityEmail: localStorage.getItem("admin_secondary_security_email") || "",
    clearanceLevel: localStorage.getItem("admin_clearance_level") || "Level 5 (Super Admin)",
    createdAt: user?.created_at || "",
    activitySummary: localStorage.getItem("admin_activity_summary") || "Approved 4 job postings, resolved 2 user reports.",
  });

  // Worker fields
  const [workerForm, setWorkerForm] = useState({
    headline: "",
    skills: "",
    location: "",
    availability: true,
    latitude: "",
    longitude: "",
    experience: [],
    education: [],
    certifications: [],
    projects: [],
    resume_url: "",
    profile_picture_url: "",
    esewa_number: "",
    khalti_number: ""
  });

  // Reviews state for Worker
  const [workerSummary, setWorkerSummary] = useState(null);
  const [workerReviews, setWorkerReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  // Employer fields
  const [employerForm, setEmployerForm] = useState({
    company: "",
    location: "",
    profile_picture_url: ""
  });

  const digitsOnly = (value) => String(value || "").replace(/[^0-9]/g, "").slice(0, 10);
  const parseProfileArray = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value !== "string") return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        if (role === "worker") {
          const res = await profilesAPI.getWorkerProfile();
          const paymentRes = await profilesAPI.getWorkerPaymentMethods();
          setWorkerForm({
            headline: res.data.headline || "",
            skills: res.data.skills || "",
            location: res.data.location || "",
            availability: res.data.availability ?? true,
            latitude: res.data.latitude?.toString() || "",
            longitude: res.data.longitude?.toString() || "",
            experience: parseProfileArray(res.data.experience),
            education: parseProfileArray(res.data.education),
            certifications: parseProfileArray(res.data.certifications),
            projects: parseProfileArray(res.data.projects),
            resume_url: res.data.resume_url || "",
            profile_picture_url: res.data.profile_picture_url || "",
            esewa_number: digitsOnly(paymentRes.data.esewa_number),
            khalti_number: digitsOnly(paymentRes.data.khalti_number)
          });
          
          // Also fetch reviews and summary for the worker
          try {
            setReviewsLoading(true);
            const summaryRes = await reviewsAPI.getReviewSummary(user.id);
            setWorkerSummary(summaryRes.data);
            const reviewsRes = await reviewsAPI.getUserReviews(user.id, 1, 50);
            setWorkerReviews(reviewsRes.data?.reviews || []);
          } catch (rErr) {
            console.error("Failed to load reviews", rErr);
          } finally {
            setReviewsLoading(false);
          }
        } else if (role === "employer") {
          const res = await profilesAPI.getEmployerProfile();
          setEmployerForm({
            company: res.data.company || "",
            location: res.data.location || "",
            profile_picture_url: res.data.profile_picture_url || ""
          });
        }
      } catch (err) {
        console.log("Backend Error:", err.response?.data || err.message);
        setError("Failed to load profile");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [role]);

  const handleGetLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setWorkerForm({
          ...workerForm,
          latitude: pos.coords.latitude.toString(),
          longitude: pos.coords.longitude.toString(),
        });
      },
      () => setError("Could not get location")
    );
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      if (role === "worker") {
        const payload = {
          headline: workerForm.headline || null,
          skills: workerForm.skills || null,
          location: workerForm.location || null,
          availability: workerForm.availability,
          latitude: workerForm.latitude ? parseFloat(workerForm.latitude) : null,
          longitude: workerForm.longitude ? parseFloat(workerForm.longitude) : null,
          experience: JSON.stringify(workerForm.experience),
          education: JSON.stringify(workerForm.education),
          certifications: JSON.stringify(workerForm.certifications),
          projects: JSON.stringify(workerForm.projects)
        };
        await profilesAPI.updateWorkerProfile(payload);
      } else {
        const payload = {
          company: employerForm.company || null,
          location: employerForm.location || null,
        };
        await profilesAPI.updateEmployerProfile(payload);
      }
      setSuccess("Profile updated successfully! ✅");
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleSavePaymentNumbers = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      // Validate phone numbers (must be exactly 10 digits if provided)
      const esewa = digitsOnly(workerForm.esewa_number || "");
      const khalti = digitsOnly(workerForm.khalti_number || "");
      if (esewa && esewa.length !== 10) {
        throw new Error("eSewa number must be exactly 10 digits");
      }
      if (khalti && khalti.length !== 10) {
        throw new Error("Khalti number must be exactly 10 digits");
      }

      const res = await profilesAPI.updateWorkerPaymentMethods({
        esewa_number: esewa || null,
        khalti_number: khalti || null
      });
      setWorkerForm((prev) => ({
        ...prev,
        esewa_number: digitsOnly(res.data.esewa_number),
        khalti_number: digitsOnly(res.data.khalti_number)
      }));
      setPaymentSaved(true);
      setSuccess("Payment methods updated successfully! ✅");
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Failed to update payment methods");
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    setUploading(true);
    try {
      const res = await profilesAPI.uploadPhoto(formData);
      const url = res.data.profile_picture_url?.startsWith("http")
        ? res.data.profile_picture_url
        : `${window.location.origin}${res.data.profile_picture_url}`;
      if (role === "worker") {
        setWorkerForm(prev => ({ ...prev, profile_picture_url: url }));
      } else {
        setEmployerForm(prev => ({ ...prev, profile_picture_url: url }));
      }
      setSuccess("Photo updated successfully!");
    } catch (err) {
      setError("Failed to upload photo");
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!confirm("Remove profile photo?")) return;
    setRemovingPhoto(true);
    setError("");
    setSuccess("");
    try {
      await profilesAPI.removeProfilePhoto();
      if (role === "worker") {
        setWorkerForm(prev => ({ ...prev, profile_picture_url: "" }));
      } else {
        setEmployerForm(prev => ({ ...prev, profile_picture_url: "" }));
      }
      setSuccess("Profile photo removed");
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to remove photo");
    } finally {
      setRemovingPhoto(false);
    }
  };

  // Helper for arrays
  const addArrayItem = (key, defaultItem) => {
    setWorkerForm(prev => ({ ...prev, [key]: [...prev[key], defaultItem] }));
  };
  const removeArrayItem = (key, index) => {
    setWorkerForm(prev => ({ ...prev, [key]: prev[key].filter((_, i) => i !== index) }));
  };
  const updateArrayItem = (key, index, field, value) => {
    setWorkerForm(prev => {
      const arr = [...prev[key]];
      if (typeof arr[index] === 'object') {
        arr[index][field] = value;
      } else {
        arr[index] = value;
      }
      return { ...prev, [key]: arr };
    });
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-loader"><div className="spinner" /><p>Loading profile...</p></div>
      </div>
    );
  }

  const currentPhoto = role === "worker" ? workerForm.profile_picture_url : employerForm.profile_picture_url;
  const normalizedCurrentPhoto = currentPhoto
    ? currentPhoto.startsWith("http")
      ? currentPhoto
      : `${window.location.origin}${currentPhoto}`
    : "";

  const handleAdminInfoSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      localStorage.setItem("admin_phone_number", adminInfo.phoneNumber);
      localStorage.setItem("admin_secondary_security_email", adminInfo.secondarySecurityEmail);
      localStorage.setItem("admin_clearance_level", adminInfo.clearanceLevel);
      localStorage.setItem("admin_activity_summary", adminInfo.activitySummary);
      setSuccess("Administrative info updated successfully! ✅");
    } catch (err) {
      setError(err?.message || "Failed to save administrative info");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-container">
      {error && <div className="alert alert-error" style={{marginBottom: 20}}>{error}</div>}
      {success && <div className="alert alert-success" style={{marginBottom: 20}}>{success}</div>}
      
      {/* HEADER SECTION (Premium LinkedIn-style) */}
      <div style={{ backgroundColor: '#fff', borderRadius: 12, marginBottom: 30, position: 'relative', boxShadow: '0 6px 18px rgba(16,24,40,0.06)', overflow: 'hidden' }}>
        <div style={{ height: 140, background: 'linear-gradient(90deg,#6366f1 0%,#4f46e5 100%)' }} />
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', padding: '16px 20px', marginTop: -64 }}>
          {/* Avatar */}
          <div style={{ position: 'relative' }}>
            <div style={{ width: 128, height: 128, borderRadius: '50%', padding: 4, background: '#fff', boxShadow: '0 6px 18px rgba(16,24,40,0.08)' }}>
              {normalizedCurrentPhoto ? (
                <img src={normalizedCurrentPhoto} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44, color: '#6b7280' }}>👤</div>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current.click()}
              style={{ position: 'absolute', bottom: 6, right: 6, background: '#ffffff', border: '1px solid rgba(15,23,42,0.06)', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              📷
            </button>
            <input type="file" hidden ref={fileInputRef} onChange={handlePhotoUpload} accept="image/*" />
          </div>

          {/* Info */}
          <div style={{ flex: 1, paddingTop: 6 }}>
            <h1 style={{ margin: 0, fontSize: 24, color: '#0f172a' }}>{user?.name}</h1>
            <p style={{ margin: '8px 0', fontSize: 16, color: '#374151' }}>{role === "worker" ? workerForm.headline || "Add a professional headline" : employerForm.company || "Company Name"}</p>
            <div style={{ marginTop: 6, display: 'flex', gap: 12, color: '#6b7280', alignItems: 'center', fontSize: 14 }}>
              <span>{user?.email}</span>
              {user?.phone_number && <span>{user.phone_number}</span>}
              {currentPhoto && (
                <button type="button" onClick={handleRemovePhoto} className="btn btn-outline" style={{ marginLeft: 12 }}>
                  {removingPhoto ? "Removing..." : "Remove Photo"}
                </button>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* EDIT FORM */}
      <form onSubmit={handleSave}>
        {role === "worker" && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
            {/* Summary & Basic Info */}
              <div className="form-card" style={{ padding: 25, backgroundColor: '#ffffff', borderRadius: 12, border: '1px solid #eef2ff' }}>
              <h2 style={{ marginBottom: 20, borderBottom: '1px solid #e5e7eb', paddingBottom: 10 }}>About</h2>
              <div className="form-grid">
                <div className="form-group full-width">
                  <label>Professional Headline</label>
                  <input type="text" value={workerForm.headline} onChange={e => setWorkerForm({...workerForm, headline: e.target.value})} placeholder="e.g. Plumber" />
                </div>
                <div className="form-group full-width">
                  <label>Top Skills (comma separated)</label>
                  <input type="text" value={workerForm.skills} onChange={e => setWorkerForm({...workerForm, skills: e.target.value})} placeholder="Pipe installation, leak repair, drainage systems, problem-solving" />
                </div>
                <div className="form-group">
                  <label>Location</label>
                  <input type="text" value={workerForm.location} onChange={e => setWorkerForm({...workerForm, location: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Registered Number</label>
                  <input type="text" value={user?.phone_number || ""} readOnly />
                </div>
                <div className="form-group">
                  <label>National ID Card Number</label>
                  <input type="text" value={user?.national_id_card || "Not available"} readOnly />
                </div>
                <div className="form-group">
                  <label className="checkbox-label" style={{ marginTop: 30 }}>
                    <input type="checkbox" checked={workerForm.availability} onChange={e => setWorkerForm({...workerForm, availability: e.target.checked})} />
                    <span>Open to Work</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Experience Section */}
            <div className="form-card" style={{ padding: 25, backgroundColor: '#ffffff', borderRadius: 12, border: '1px solid #eef2ff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid #e5e7eb', paddingBottom: 10 }}>
                <h2 style={{ margin: 0 }}>Experience</h2>
                <button type="button" className="btn btn-sm btn-outline" onClick={() => addArrayItem('experience', {company:'', role:'', duration:'', description:''})}>+ Add Position</button>
              </div>
              
              {workerForm.experience.map((exp, idx) => (
                <div key={idx} style={{ padding: 20, backgroundColor: '#f8fafc', borderRadius: 8, marginBottom: 15, position: 'relative' }}>
                  <button type="button" onClick={() => removeArrayItem('experience', idx)} style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', color: '#ea0038', cursor: 'pointer' }}>❌</button>
                  <div className="form-grid">
                    <div className="form-group"><label>Role / Title</label><input type="text" value={exp.role || ''} onChange={e => updateArrayItem('experience', idx, 'role', e.target.value)} /></div>
                    <div className="form-group"><label>Company</label><input type="text" value={exp.company || ''} onChange={e => updateArrayItem('experience', idx, 'company', e.target.value)} /></div>
                    <div className="form-group"><label>Duration (e.g. 2020 - Present)</label><input type="text" value={exp.duration || ''} onChange={e => updateArrayItem('experience', idx, 'duration', e.target.value)} /></div>
                    <div className="form-group full-width"><label>Description</label><textarea value={exp.description || ''} onChange={e => updateArrayItem('experience', idx, 'description', e.target.value)} rows="3" /></div>
                  </div>
                </div>
              ))}
              {workerForm.experience.length === 0 && <p style={{color: '#8696a0'}}>No experience added yet.</p>}
            </div>

            {/* Education Section */}
            <div className="form-card" style={{ padding: 25, backgroundColor: '#ffffff', borderRadius: 12, border: '1px solid #eef2ff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid #e5e7eb', paddingBottom: 10 }}>
                <h2 style={{ margin: 0 }}>Education</h2>
                <button type="button" className="btn btn-sm btn-outline" onClick={() => addArrayItem('education', {institution:'', degree:'', field_of_study:'', year:''})}>+ Add Education</button>
              </div>
              
              {workerForm.education.map((edu, idx) => (
                <div key={idx} style={{ padding: 20, backgroundColor: '#f8fafc', borderRadius: 8, marginBottom: 15, position: 'relative' }}>
                  <button type="button" onClick={() => removeArrayItem('education', idx)} style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', color: '#ea0038', cursor: 'pointer' }}>❌</button>
                  <div className="form-grid">
                    <div className="form-group"><label>Institution</label><input type="text" value={edu.institution || ''} onChange={e => updateArrayItem('education', idx, 'institution', e.target.value)} /></div>
                    <div className="form-group"><label>Degree</label><input type="text" value={edu.degree || ''} onChange={e => updateArrayItem('education', idx, 'degree', e.target.value)} /></div>
                    <div className="form-group"><label>Field of Study</label><input type="text" value={edu.field_of_study || ''} onChange={e => updateArrayItem('education', idx, 'field_of_study', e.target.value)} /></div>
                    <div className="form-group"><label>Year</label><input type="text" value={edu.year || ''} onChange={e => updateArrayItem('education', idx, 'year', e.target.value)} /></div>
                  </div>
                </div>
              ))}
              {workerForm.education.length === 0 && <p style={{color: '#8696a0'}}>No education added yet.</p>}
            </div>

            {/* Payment Methods Section */}
            <div className="form-card" style={{ padding: 25, backgroundColor: '#ffffff', borderRadius: 12, border: '1px solid #eef2ff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid #e5e7eb', paddingBottom: 10 }}>
                <h2 style={{ margin: 0 }}>Payment Methods</h2>
                <button type="button" className="btn btn-sm btn-primary" onClick={handleSavePaymentNumbers} disabled={saving}>
                  {saving ? "Saving..." : paymentSaved ? "Saved - Edit Anytime" : "Save Methods"}
                </button>
              </div>
              <p style={{ color: '#6b7280', marginBottom: '20px' }}>Employers will use these numbers to pay you for completed jobs.</p>
              
              <div className="form-grid">
                <div className="form-group">
                  <label>eSewa Wallet ID</label>
                  <input
                    type="text"
                    name="rozgar_esewa_wallet_id"
                    autoComplete="new-password"
                    inputMode="numeric"
                    value={workerForm.esewa_number}
                    onChange={e => {
                      setPaymentSaved(false);
                      setWorkerForm({...workerForm, esewa_number: digitsOnly(e.target.value)});
                    }}
                    maxLength={10}
                    pattern="[0-9]{10}"
                    placeholder="Enter eSewa wallet ID"
                  />
                </div>
                <div className="form-group">
                  <label>Khalti Wallet ID</label>
                  <input
                    type="text"
                    name="rozgar_khalti_wallet_id"
                    autoComplete="new-password"
                    inputMode="numeric"
                    value={workerForm.khalti_number}
                    onChange={e => {
                      setPaymentSaved(false);
                      setWorkerForm({...workerForm, khalti_number: digitsOnly(e.target.value)});
                    }}
                    maxLength={10}
                    pattern="[0-9]{10}"
                    placeholder="Enter Khalti wallet ID"
                  />
                </div>
              </div>

            </div>

            {/* Rating & Reviews Section */}
            <div className="form-card" style={{ padding: 25, backgroundColor: '#ffffff', borderRadius: 12, border: '1px solid #eef2ff' }}>
              <h2 style={{ marginBottom: 20, borderBottom: '1px solid #e5e7eb', paddingBottom: 10 }}>Rating &amp; Reviews</h2>
              {reviewsLoading ? (
                <p>Loading reviews...</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "2rem" }}>
                  <div>
                    <ReviewSummary summary={workerSummary} userRole="worker" />
                  </div>
                  {workerReviews.length > 0 ? (
                    <div>
                      <h3 style={{ fontSize: "1.1rem", marginBottom: "1rem" }}>Complete Review List</h3>
                      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                        {workerReviews.map((r) => (
                          <ReviewCard key={r.id} review={r} />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p style={{ color: '#8696a0' }}>No reviews yet.</p>
                  )}
                </div>
              )}
            </div>

          </div>
        )}

        {role === "employer" && (
          <div className="form-card" style={{ padding: 25, backgroundColor: '#ffffff', borderRadius: 12, border: '1px solid #eef2ff' }}>
            <h2 style={{ marginBottom: 20, borderBottom: '1px solid #e5e7eb', paddingBottom: 10 }}>Company Details</h2>
            <div className="form-grid">
              <div className="form-group full-width">
                <label>Company Name</label>
                <input type="text" value={employerForm.company} onChange={e => setEmployerForm({...employerForm, company: e.target.value})} />
              </div>
              <div className="form-group full-width">
                <label>Headquarters Location</label>
                <input type="text" value={employerForm.location} onChange={e => setEmployerForm({...employerForm, location: e.target.value})} />
              </div>
              <div className="form-group full-width">
                <label>Registered Number</label>
                <input type="text" value={user?.phone_number || ""} readOnly />
              </div>
              <div className="form-group full-width">
                <label>National ID Card Number</label>
                <input type="text" value={user?.national_id_card || "Not available"} readOnly />
              </div>
            </div>
          </div>
        )}

        {role === "admin" && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
            <div className="form-card" style={{ padding: 25, backgroundColor: '#ffffff', borderRadius: 12, border: '1px solid #eef2ff' }}>
              <h2 style={{ marginBottom: 20, borderBottom: '1px solid #e5e7eb', paddingBottom: 10 }}>Extended Administrative Info</h2>
              <div className="form-grid">
                <div className="form-group">
                  <label>Phone Number</label>
                  <input
                    type="text"
                    value={adminInfo.phoneNumber}
                    onChange={(e) => setAdminInfo((prev) => ({ ...prev, phoneNumber: e.target.value }))}
                    placeholder="Enter phone number"
                  />
                </div>
                <div className="form-group">
                  <label>Secondary Security Email</label>
                  <input
                    type="email"
                    value={adminInfo.secondarySecurityEmail}
                    onChange={(e) => setAdminInfo((prev) => ({ ...prev, secondarySecurityEmail: e.target.value }))}
                    placeholder="Enter backup email"
                  />
                </div>
                <div className="form-group">
                  <label>Access Clearance Level</label>
                  <input
                    type="text"
                    value={adminInfo.clearanceLevel}
                    onChange={(e) => setAdminInfo((prev) => ({ ...prev, clearanceLevel: e.target.value }))}
                    placeholder="Enter clearance level"
                  />
                </div>
                <div className="form-group">
                  <label>Account Created</label>
                  <input type="text" value={adminInfo.createdAt ? new Date(adminInfo.createdAt).toLocaleString() : "January 12, 2024"} readOnly />
                </div>
              </div>
              <div className="form-group full-width" style={{ marginTop: 16 }}>
                <label>System Activity Log Summary</label>
                <textarea
                  value={adminInfo.activitySummary}
                  onChange={(e) => setAdminInfo((prev) => ({ ...prev, activitySummary: e.target.value }))}
                  rows="4"
                  placeholder="Summarize recent admin activity"
                />
              </div>
              <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-primary" onClick={handleAdminInfoSave} disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>

            <div className="form-card" style={{ padding: 25, backgroundColor: '#ffffff', borderRadius: 12, border: '1px solid #eef2ff' }}>
              <h2 style={{ marginBottom: 20, borderBottom: '1px solid #e5e7eb', paddingBottom: 10 }}>System Activity Log</h2>
              <div style={{ backgroundColor: '#f8fafc', padding: 15, borderRadius: 8, fontSize: 13, lineHeight: '1.6', color: '#475569' }}>
                <div style={{ borderLeft: '3px solid #6366f1', paddingLeft: 10, marginBottom: 10 }}>
                  <strong>Today:</strong> Approved 4 job postings, Resolved 2 user reports.
                </div>
                <div style={{ borderLeft: '3px solid #94a3b8', paddingLeft: 10, marginBottom: 10 }}>
                  <strong>Yesterday:</strong> Updated platform commission rate, Verified 12 new worker profiles.
                </div>
                <div style={{ borderLeft: '3px solid #94a3b8', paddingLeft: 10 }}>
                  <strong>Jan 02:</strong> System security audit completed. No anomalies detected.
                </div>
              </div>
            </div>
          </div>
        )}

        {role !== "admin" && (
          <div style={{ marginTop: 30, display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" style={{ padding: '15px 40px', fontSize: 18 }} disabled={saving}>
              {saving ? "Saving..." : "Save Profile Changes"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

