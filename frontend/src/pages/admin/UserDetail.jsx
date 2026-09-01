import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { adminAPI } from "../../api";

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function UserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchUser();
  }, [id]);

  const fetchUser = async () => {
    try {
      const res = await adminAPI.getUser(id);
      setUser(res.data);
      setForm(res.data);
    } catch (err) {
      alert("Failed to load user");
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await adminAPI.updateUser(user.id, form);
      setUser(res.data);
      setForm(res.data);
      alert("User updated successfully");
    } catch (err) {
      alert(err?.response?.data?.detail || "Failed to update user");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this user and related records? This cannot be undone.")) return;
    try {
      await adminAPI.deleteUser(user.id);
      alert("User deleted successfully");
      navigate(user.role === "worker" ? "/admin/workers" : "/admin/employers");
    } catch (err) {
      alert(err?.response?.data?.detail || "Failed to delete user");
    }
  };

  const handleDownload = () => {
    downloadJson(`${user.role}-record-${user.id}.json`, form);
  };

  if (loading) return <div style={{ padding: 20 }}>Loading Profile...</div>;

  return (
    <div style={{ padding: "24px", maxWidth: "960px" }}>
      <button
        onClick={() => navigate(-1)}
        style={{ marginBottom: "20px", padding: "6px 12px", borderRadius: "6px", border: "1px solid #d1d5db", background: "#fff", cursor: "pointer" }}
      >
        Back
      </button>

      <form onSubmit={handleSave} style={{ backgroundColor: "#fff", padding: "24px", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)", border: "1px solid #eef2ff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "20px", marginBottom: "24px", flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: "0 0 8px 0", fontSize: "24px", color: "#111827" }}>Edit {user.role}</h2>
            <p style={{ margin: 0, color: "#4b5563" }}>
              Joined {new Date(user.created_at).toLocaleDateString()}
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button type="button" onClick={handleDownload} style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid #d1d5db", backgroundColor: "#fff", cursor: "pointer", fontWeight: 500 }}>
              Download Record
            </button>
            <button type="button" onClick={handleDelete} style={{ padding: "8px 16px", borderRadius: "6px", border: "none", backgroundColor: "#ef4444", color: "#fff", cursor: "pointer", fontWeight: 500 }}>
              Delete User
            </button>
            <button type="submit" disabled={saving} style={{ padding: "8px 16px", borderRadius: "6px", border: "none", backgroundColor: "#4f46e5", color: "#fff", cursor: "pointer", fontWeight: 500 }}>
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "18px" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "14px", fontWeight: 600, color: "#374151" }}>Full Name</span>
            <input name="name" value={form.name || ""} onChange={handleChange} required style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1d5db" }} />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "14px", fontWeight: 600, color: "#374151" }}>Email</span>
            <input name="email" type="email" value={form.email || ""} onChange={handleChange} required style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1d5db" }} />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "14px", fontWeight: 600, color: "#374151" }}>Phone Number</span>
            <input name="phone_number" value={form.phone_number || ""} onChange={handleChange} required pattern="[0-9]{10}" style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1d5db" }} />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "14px", fontWeight: 600, color: "#374151" }}>National ID Card Number</span>
            <input value={form.national_id_card || "Not available"} readOnly style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #e5e7eb", backgroundColor: "#f9fafb" }} />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "6px", justifyContent: "center" }}>
            <span style={{ fontSize: "14px", fontWeight: 600, color: "#374151" }}>Account Status</span>
            <label style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px", color: "#374151" }}>
              <input name="is_active" type="checkbox" checked={!!form.is_active} onChange={handleChange} />
              Active
            </label>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "14px", fontWeight: 600, color: "#374151" }}>Role</span>
            <input value={form.role || ""} readOnly style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #e5e7eb", backgroundColor: "#f9fafb", textTransform: "capitalize" }} />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "14px", fontWeight: 600, color: "#374151" }}>Location</span>
            <input name="location" value={form.location || ""} onChange={handleChange} style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1d5db" }} />
          </label>

          {form.role === "employer" && (
            <>
              <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ fontSize: "14px", fontWeight: 600, color: "#374151" }}>Company</span>
                <input name="company" value={form.company || ""} onChange={handleChange} style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1d5db" }} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ fontSize: "14px", fontWeight: 600, color: "#374151" }}>Office Address</span>
                <input name="office_address" value={form.office_address || ""} onChange={handleChange} style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1d5db" }} />
              </label>
            </>
          )}

          {form.role === "worker" && (
            <>
              <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ fontSize: "14px", fontWeight: 600, color: "#374151" }}>Headline</span>
                <input name="headline" value={form.headline || ""} onChange={handleChange} style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1d5db" }} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: "6px", gridColumn: "1 / -1" }}>
                <span style={{ fontSize: "14px", fontWeight: 600, color: "#374151" }}>Skills</span>
                <textarea name="skills" value={form.skills || ""} onChange={handleChange} rows={4} style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1d5db", resize: "vertical" }} />
              </label>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
