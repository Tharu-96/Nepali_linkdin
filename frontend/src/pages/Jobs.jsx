import { useEffect, useState, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import API, { jobsAPI, applicationsAPI, profilesAPI } from "../api";
import JobMap from "../components/maps/JobMap";

export default function Jobs() {
  const { role, user } = useAuth();
  // Resolve email from various auth sources (user object, localStorage, or JWT payload)
  const resolveAuthEmail = () => {
    try {
      if (user) {
        if (user.email) return user.email;
        if (user.user_email) return user.user_email;
        if (user.email_address) return user.email_address;
      }

      const stored = localStorage.getItem("user");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed) {
          if (parsed.email) return parsed.email;
          if (parsed.user_email) return parsed.user_email;
        }
      }

      const token = localStorage.getItem("rozgar_token") || localStorage.getItem("token");
      if (token) {
        const base64 = token.split('.')[1];
        if (base64) {
          const jsonPayload = decodeURIComponent(atob(base64.replace(/-/g, '+').replace(/_/g, '/')).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          }).join(''));
          const payload = JSON.parse(jsonPayload);
          if (payload.email) return payload.email;
          if (payload.user_email) return payload.user_email;
          if (payload.sub) return payload.sub;
        }
      }
    } catch (e) {
      // ignore
    }
    return "";
  };
  const location = useLocation();
  const [jobs, setJobs] = useState([]);
  const [myApplications, setMyApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("all");
  const [filter, setFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [search, setSearch] = useState("");
  const [userCoords, setUserCoords] = useState(null);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const jobRefs = useRef({});
  const mapRef = useRef(null);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const navigate = useNavigate();
  const [applyingId, setApplyingId] = useState(null);
  const [cancellingApplicationId, setCancellingApplicationId] = useState(null);
  const [applyMsg, setApplyMsg] = useState({ id: null, msg: "", type: "" });
  const [appliedJobIds, setAppliedJobIds] = useState(new Set());

  const [applicationModalOpen, setApplicationModalOpen] = useState(false);
  const [applicationJobId, setApplicationJobId] = useState(null);
  const [applicationJobTitle, setApplicationJobTitle] = useState("");
  const [appForm, setAppForm] = useState({
    full_name: "",
    email: "",
    professional_headline: "",
    skills: "",
    proposal_pitch: "",
    esewa_number: "",
    khalti_number: "",
  });
  const digitsOnly = (value) => String(value || "").replace(/[^0-9]/g, "").slice(0, 10);
  const formatJobStatus = (status) => {
    if (!status || status === "open" || status === "pending_approval") return "Live";
    return status.replace(/_/g, " ");
  };

  const loadJobs = async (mode, currentSearch = "") => {
    setLoading(true);
    setError("");
    try {
      let res;
      if (mode === "nearby") {
        let baseLat = 27.7172;
        let baseLng = 85.3240;
        try {
          const pos = await new Promise((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(
              (p) => resolve(p.coords),
              (e) => reject(e)
            )
          );
          baseLat = pos.latitude;
          baseLng = pos.longitude;
        } catch (e) {
          // Keep default center coords
        }

        let isGeocodedLocation = false;
        if (currentSearch && currentSearch.trim()) {
          try {
            const geoRes = await API.post("/maps/geocode", { address: currentSearch });
            if (geoRes.data && geoRes.data.latitude && geoRes.data.longitude) {
              baseLat = geoRes.data.latitude;
              baseLng = geoRes.data.longitude;
              isGeocodedLocation = true;
            }
          } catch (err) {
            // Address not found or search query was a keyword, fallback to filtering below
          }
        }

        setUserCoords({ latitude: baseLat, longitude: baseLng });
        res = await jobsAPI.getNearbyJobs(baseLat, baseLng);

        // Filter response by text query in frontend if it wasn't successfully geocoded as a location
        if (currentSearch && currentSearch.trim() && !isGeocodedLocation) {
          const query = currentSearch.toLowerCase();
          const filtered = res.data.filter((job) =>
            job.title.toLowerCase().includes(query) ||
            job.description.toLowerCase().includes(query) ||
            (job.required_skills && job.required_skills.toLowerCase().includes(query)) ||
            job.location.toLowerCase().includes(query)
          );
          setJobs(filtered);
          setLoading(false);
          return;
        }
      } else if (mode === "emergency") {
        try {
          const pos = await new Promise((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(
              (p) => resolve(p.coords),
              () => reject()
            )
          );
          setUserCoords({ latitude: pos.latitude, longitude: pos.longitude });
          res = await jobsAPI.getEmergencyJobs(pos.latitude, pos.longitude);
        } catch {
          res = await jobsAPI.getEmergencyJobs();
        }
      } else if (mode === "recommendations") {
        // Uses the recommendation endpoint tailored to worker skills
        res = await jobsAPI.getRecommendations();
      } else {
        // Uses the backend search endpoint with expanded matching parameters
        res = await jobsAPI.getJobs(currentSearch);
      }
      setJobs(res.data);
    } catch (err) {
      setError(err.message || "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  };

  // Automatically triggers backend search when tabs or input change
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Read query params and sync to local state
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const qTab = params.get('tab');
    const qFilter = params.get('filter');
    const qStatus = params.get('status');
    const qSearch = params.get('search');

    setTab(qTab || "all");
    if (qFilter) setFilter(qFilter); else setFilter(null);
    if (qStatus) setStatusFilter(qStatus); else setStatusFilter(null);
    if (qSearch != null) setSearch(qSearch);
  }, [location.search]);

  const scrollToJob = (id) => {
    const el = jobRefs.current && jobRefs.current[id];
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  const handleMarkerSelect = (job) => {
    setSelectedJobId(job.id);
    // small timeout to ensure the list element exists when jobs are set
    setTimeout(() => scrollToJob(job.id), 120);
  }

  // Automatically triggers backend search when tabs or input change
  useEffect(() => {
    if (role === "worker") {
      const loadMyApplications = async () => {
        try {
          const res = await applicationsAPI.getMyApplications();
          const ids = new Set((res.data || []).map((app) => String(app.job_id)));
          setAppliedJobIds(ids);
        } catch {
          // ignore
        }
      };
      loadMyApplications();
    }

    // If user requests applications view, fetch user's applications instead
    if (tab === "applications") {
      const loadApps = async () => {
        setLoading(true);
        setError("");
        try {
          const res = await applicationsAPI.getMyApplications();
          let apps = res.data || [];
          if (statusFilter) apps = apps.filter((a) => a.status === statusFilter);
          setMyApplications(apps);
        } catch (err) {
          setError(err.message || "Failed to load applications");
        } finally {
          setLoading(false);
        }
      };
      loadApps();
      return;
    }

    // If user shifts tabs to recommendations, bypass the search text parameters
    if (tab === "recommendations") {
      loadJobs(tab, "");
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      loadJobs(tab, search);
    }, 400); // 400ms debounce prevents excessive requests while typing

    return () => clearTimeout(delayDebounceFn);
  }, [tab, search, statusFilter]);

  // derive displayed jobs according to filter (e.g. urgent)
  const displayedJobs = filter === 'urgent' ? jobs.filter((j) => j.is_urgent) : jobs;

  const openApplicationModal = async (jobId) => {
    setApplicationJobId(jobId);
    const matchedJob = jobs.find((job) => String(job.id) === String(jobId));
    setApplicationJobTitle(matchedJob?.title || "");
    setApplicationModalOpen(true);
    setApplyMsg({ id: null, msg: "", type: "" });
    const resolvedEmail = resolveAuthEmail() || (user && (user.email || user.user_email || user.email_address)) || "";
    try {
      const res = await profilesAPI.getWorkerProfile();
      const paymentRes = await profilesAPI.getWorkerPaymentMethods();
      setAppForm({
        full_name: (user && user.name) || res.data.name || "",
        email: resolvedEmail,
        professional_headline: res.data.headline || "",
        skills: res.data.skills || "",
        proposal_pitch: "",
        esewa_number: digitsOnly(paymentRes.data.esewa_number),
        khalti_number: digitsOnly(paymentRes.data.khalti_number),
      });
    } catch {
      // If profile fetch fails, still prefill name/email when available
      setAppForm((prev) => ({
        ...prev,
        full_name: (user && user.name) || prev.full_name || "",
        email: resolvedEmail || prev.email || "",
      }));
    }
  };

  const handleApply = async () => {
    if (!applicationJobId) return;
    const esewaNumber = digitsOnly(appForm.esewa_number);
    const khaltiNumber = digitsOnly(appForm.khalti_number);
    if ((esewaNumber && esewaNumber.length !== 10) || (khaltiNumber && khaltiNumber.length !== 10)) {
      alert("Wallet numbers must be exactly 10 digits.");
      return;
    }
    setApplyingId(applicationJobId);
    try {
      const payload = {
        job_id: parseInt(applicationJobId),
        full_name: appForm.full_name || null,
        professional_headline: appForm.professional_headline || null,
        skills: appForm.skills || null,
        proposal_pitch: appForm.proposal_pitch || null,
        esewa_number: esewaNumber || null,
        khalti_number: khaltiNumber || null,
      };
      await profilesAPI.updateWorkerPaymentMethods({
        esewa_number: esewaNumber || null,
        khalti_number: khaltiNumber || null,
      });
      const res = await jobsAPI.applyToJob(applicationJobId, payload);
      if (res && (res.status === 200 || res.status === 201)) {
        alert("🎉 Application Submitted Successfully!");
        setAppliedJobIds((prev) => new Set(prev).add(String(applicationJobId)));
        setApplyMsg({ id: applicationJobId, msg: "Applied successfully! ✅", type: "success" });
        setApplicationModalOpen(false);
      } else {
        console.error('Unexpected apply response:', res);
        setApplyMsg({ id: applicationJobId, msg: 'Unexpected server response', type: 'error' });
      }
    } catch (err) {
      console.error("Submission Error Details:", err);
      console.log("Backend Error:", err.response?.data);
      alert(err.response?.data?.detail || "Submission failed. Check backend endpoint console logs.");
      setApplyMsg({
        id: applicationJobId,
        msg: err.response?.data?.detail || "Failed to apply",
        type: "error",
      });
    } finally {
      setApplyingId(null);
      setApplicationJobId(null);
      setApplicationJobTitle("");
    }
  };

  const handleCancelApplication = async (applicationId) => {
    const confirmed = window.confirm("Cancel this application?");
    if (!confirmed) return;

    setCancellingApplicationId(applicationId);
    try {
      await applicationsAPI.cancel(applicationId);
      setMyApplications((current) => current.filter((app) => app.id !== applicationId));
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to cancel application");
    } finally {
      setCancellingApplicationId(null);
    }
  };

  const openDirectionsToJob = async (job) => {
    try {
      // Resolve origin coords: prefer shared userCoords, otherwise ask geolocation
      let originCoords = null;
      if (userCoords && userCoords.latitude && userCoords.longitude) {
        originCoords = { lat: Number(userCoords.latitude), lng: Number(userCoords.longitude) };
      } else {
        const pos = await new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition((p) => resolve(p.coords), (e) => reject(e))
        );
        originCoords = { lat: pos.latitude, lng: pos.longitude };
      }

      const destination = job.latitude && job.longitude
        ? { lat: Number(job.latitude), lng: Number(job.longitude) }
        : job.location || `${job.latitude},${job.longitude}`;

      // If JobMap exposes showRoute, use it to draw the route on the existing map
      if (mapRef.current && typeof mapRef.current.showRoute === 'function') {
        mapRef.current.showRoute(originCoords, destination);
        // also highlight the job in the list
        setSelectedJobId(job.id);
        return;
      }

      // Fallback: open Google Maps directions in a new tab
      const url = `https://www.google.com/maps/dir/?api=1&origin=${originCoords.lat},${originCoords.lng}&destination=${encodeURIComponent(job.location || `${job.latitude},${job.longitude}`)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      const url = `https://www.google.com/maps/search/?api=1&query=${job.latitude},${job.longitude}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_45%),linear-gradient(135deg,#f8fafc_0%,#f1f5f9_100%)] px-3 py-4 sm:px-4 lg:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur sm:flex-row sm:items-end sm:justify-between sm:p-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Job Listings</h1>
            <p className="mt-1 text-sm text-slate-600">
              {role === "worker"
                ? "Find work opportunities near you, compare openings, and apply in minutes."
                : "Review active platform jobs and open application pipelines from one place."}
            </p>
          </div>
          <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700">
            {tab === "applications"
              ? `${myApplications.length} application${myApplications.length === 1 ? "" : "s"}`
              : `${displayedJobs.length} job${displayedJobs.length === 1 ? "" : "s"} visible`}
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-4 flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white/80 p-2 shadow-sm">
          <button className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${tab === "all" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`} onClick={() => setTab("all")}>
            All Jobs
          </button>
          {role === "worker" && (
            <button className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${tab === "recommendations" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`} onClick={() => setTab("recommendations")}>
              Recommended
            </button>
          )}
          {role !== "admin" && (
            <button className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${tab === "nearby" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`} onClick={() => setTab("nearby")}>
              Nearby
            </button>
          )}
          <button className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${tab === "emergency" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`} onClick={() => setTab("emergency")}>
            Emergency
          </button>
          {role === "worker" && (
            <button className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${tab === "applications" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`} onClick={() => setTab("applications")}>
              My Applications
            </button>
          )}
        </div>

        {/* Search Bar Container - Hidden on Recommendations to avoid confusion */}
        {tab !== "recommendations" && (
          <div className="mb-4 rounded-2xl border border-slate-200 bg-white/80 p-2 shadow-sm">
            <input
              type="text"
              placeholder="Search by title, location, or skills..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:bg-white"
            />
          </div>
        )}

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="page-loader"><div className="spinner" /><p>Loading jobs...</p></div>
      ) : tab === 'nearby' && role !== "admin" ? (
        <div className={`flex flex-col gap-4 ${isMobile ? "" : "xl:flex-row"}`}>
          <div className="w-full flex-1 rounded-[24px] border border-slate-200 bg-white/80 p-2 shadow-sm">
            <JobMap
              jobs={displayedJobs}
              ref={mapRef}
              origin={userCoords ? { lat: userCoords.latitude, lng: userCoords.longitude } : null}
              onJobSelect={handleMarkerSelect}
              selectedJobId={selectedJobId}
            />
          </div>
          <div className={`w-full ${isMobile ? "" : "xl:w-[360px]"} max-h-[600px] overflow-y-auto rounded-[24px] border border-slate-200 bg-white/80 p-2 shadow-sm`}>
            {displayedJobs.length === 0 ? (
              <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-sm text-slate-500"><p>No nearby jobs found</p></div>
            ) : (
              <div className="flex flex-col gap-3">
                {displayedJobs.map((job) => {
                  const isSelected = String(selectedJobId) === String(job.id);
                  return (
                    <div
                      key={job.id}
                      ref={(el) => (jobRefs.current[job.id] = el)}
                      className={`cursor-pointer rounded-2xl border p-4 shadow-sm transition ${isSelected ? 'border-emerald-500 bg-emerald-50/70 shadow-md' : job.is_urgent ? 'border-amber-300 bg-amber-50/70 hover:shadow-md' : 'border-slate-200 bg-white hover:border-emerald-300 hover:shadow-md'}`}
                      onClick={() => setSelectedJobId(job.id)}
                    >
                      {job.is_urgent && <span className="mb-2 inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700">🚨 Urgent</span>}
                      <h4 className="text-base font-semibold text-slate-800">{job.title}</h4>
                      <p className="mt-1 text-sm text-slate-600">{job.location}</p>
                      <p className="mt-2 text-sm font-medium text-emerald-700">Estimated Salary: {job.salary || "Not specified"}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button 
                          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700" 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            openApplicationModal(job.id); 
                          }} 
                          disabled={job.status !== "open" || applyingId === job.id || appliedJobIds.has(String(job.id))}
                        >
                          {applyingId === job.id ? 'Applying...' : appliedJobIds.has(String(job.id)) ? 'Applied' : 'Apply'}
                        </button>
                        <button 
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-emerald-500 hover:text-emerald-600" 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            openDirectionsToJob(job); 
                          }}
                        >
                          Get Directions
                        </button>
                      </div>
                      {applyMsg.id === job.id && (
                        <p className={`mt-2 text-sm ${applyMsg.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>{applyMsg.msg}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      ) : tab === 'applications' ? (
        <div className="rounded-[28px] border border-slate-200 bg-white/90 shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-xl font-bold text-slate-900">My Applications</h2>
            <p className="mt-1 text-sm text-slate-500">Track the jobs you have applied for and withdraw pending applications if needed.</p>
          </div>
          {myApplications.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <p className="text-lg font-semibold text-slate-800">No applications found</p>
              <p className="mt-2 text-sm text-slate-500">Your submitted applications will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-slate-50 text-left">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Job</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Status</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Applied</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {myApplications.map((app) => (
                    <tr key={app.id} className="border-t border-slate-100">
                      <td className="px-6 py-5">
                        <p className="font-semibold text-slate-900">{app.job ? app.job.title : `Job #${app.job_id}`}</p>
                        <p className="mt-1 text-sm text-slate-500">Application ID: {app.id}</p>
                      </td>
                      <td className="px-6 py-5">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                          app.status === "accepted"
                            ? "bg-emerald-100 text-emerald-800"
                            : app.status === "rejected"
                              ? "bg-rose-100 text-rose-800"
                              : app.status === "completed"
                                ? "bg-slate-200 text-slate-700"
                                : "bg-amber-100 text-amber-800"
                        }`}>
                          {app.status}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-sm text-slate-600">{new Date(app.applied_at).toLocaleDateString()}</td>
                      <td className="px-6 py-5">
                        {app.status === "pending" ? (
                          <button
                            type="button"
                            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={() => handleCancelApplication(app.id)}
                            disabled={cancellingApplicationId === app.id}
                          >
                            {cancellingApplicationId === app.id ? "Cancelling..." : "Cancel"}
                          </button>
                        ) : (
                          <span className="text-sm text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : displayedJobs.length === 0 ? (
        <div className="empty-state">
          <p>No jobs found</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {displayedJobs.map((job) => (
            <div key={job.id} className={`rounded-[24px] border p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${job.is_urgent ? "border-amber-300 bg-amber-50/70" : "border-slate-200 bg-white"}`}>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {job.is_urgent && <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700">Urgent</span>}
                <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  {formatJobStatus(job.status)}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-slate-800">{job.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{job.description.substring(0, 120)}...</p>
              <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-600">
                <span className="rounded-full bg-slate-100 px-2.5 py-1">Location: {job.location}</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1">Estimated Salary: {job.salary}</span>
              </div>
              {job.required_skills && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {job.required_skills.split(",").map((s, i) => (
                    <span key={i} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600">{s.trim()}</span>
                  ))}
                </div>
              )}
              {job.distance != null && (
                <p className="mt-3 text-sm text-slate-500">{job.distance.toFixed(1)} km away</p>
              )}
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="mr-auto text-sm text-slate-400">
                  {new Date(job.created_at).toLocaleDateString()}
                </span>
                {role === "worker" && (
                  <>
                    <button
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                      onClick={() => openApplicationModal(job.id)}
                      disabled={job.status !== "open" || applyingId === job.id || appliedJobIds.has(String(job.id))}
                    >
                      {applyingId === job.id ? "Applying..." : appliedJobIds.has(String(job.id)) ? "Applied" : "Apply"}
                    </button>
                    {role === "employer" && job.status === "completed" && (
                      <Link
                        to={`/jobs/${job.id}/review`}
                        className="btn btn-sm btn-outline"
                      >
                        ⭐ Review
                      </Link>
                    )}
                    {job.latitude && job.longitude && (
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={() => openDirectionsToJob(job)}
                        style={{ marginLeft: 8 }}
                      >
                        Get Directions
                      </button>
                    )}
                  </>
                )}
                {role === "employer" && (
                  <>
                    <Link
                      to={`/jobs/${job.id}/applications`}
                      className="btn btn-sm btn-outline"
                    >
                      View Applications
                    </Link>
                    {job.status === "completed" && (
                      <Link
                        to={`/jobs/${job.id}/review`}
                        className="btn btn-sm btn-primary"
                      >
                        ⭐ Review
                      </Link>
                    )}
                  </>
                )}

              </div>
              {applyMsg.id === job.id && (
                <p className={`apply-msg ${applyMsg.type}`}>{applyMsg.msg}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* COMPREHENSIVE JOB APPLICATION MODAL OVERLAY */}
      {applicationModalOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 10001,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(17,24,39,0.55)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
          }}
        >
          <div
            className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md shadow-2xl border border-neutral-200 dark:border-neutral-800 rounded-2xl animate-fade-in"
            style={{
              width: 'min(92vw, 680px)', maxHeight: '90vh', overflowY: 'auto', background: 'rgba(255,255,255,0.98)',
              padding: '24px 32px', boxShadow: '0 24px 60px rgba(0,0,0,0.3)', border: '1px solid #e5e7eb',
              animation: 'chatFadeIn 0.3s ease-out'
            }}
          >
            <h2 style={{ fontSize: 24, fontWeight: 800, marginTop: 0, marginBottom: 8, color: '#111827' }}>Complete Application</h2>
            <p style={{ color: '#6b7280', marginBottom: 24, fontSize: 15 }}>
              Submit your profile details and pitch for {applicationJobTitle || `Job #${applicationJobId}`}.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* SECTION: Personal & Professional Background */}
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: '#374151' }}>Personal & Professional Background</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Full Name</label>
                    <input type="text" value={appForm.full_name} onChange={e => setAppForm({...appForm, full_name: e.target.value})} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Email</label>
                    <input
                      type="email"
                      value={appForm.email}
                      onChange={e => setAppForm({...appForm, email: e.target.value})}
                      placeholder="Enter your email"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db' }}
                      disabled={Boolean(appForm.email && String(appForm.email).trim().length > 0)}
                    />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Professional Headline</label>
                    <input type="text" value={appForm.professional_headline} onChange={e => setAppForm({...appForm, professional_headline: e.target.value})} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db' }} />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Skills (comma separated)</label>
                    <input type="text" value={appForm.skills} onChange={e => setAppForm({...appForm, skills: e.target.value})} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db' }} />
                  </div>
                </div>
              </div>

              {/* SECTION: Job Proposal & Payment Verification Setup */}
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: '#374151' }}>Job Proposal & Payment Verification Setup</h3>
                
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Why are you a good fit? (Proposal Pitch)</label>
                  <textarea rows="4" value={appForm.proposal_pitch} onChange={e => setAppForm({...appForm, proposal_pitch: e.target.value})} placeholder="Write a brief cover letter..." style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', resize: 'vertical' }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>eSewa Wallet ID</label>
                    <input
                      type="text"
                      name="rozgar_apply_esewa_wallet_id"
                      autoComplete="new-password"
                      inputMode="numeric"
                      value={appForm.esewa_number}
                      onChange={e => setAppForm({...appForm, esewa_number: digitsOnly(e.target.value)})}
                      maxLength={10}
                      pattern="[0-9]{10}"
                      placeholder="Enter eSewa wallet ID"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Khalti Wallet ID</label>
                    <input
                      type="text"
                      name="rozgar_apply_khalti_wallet_id"
                      autoComplete="new-password"
                      inputMode="numeric"
                      value={appForm.khalti_number}
                      onChange={e => setAppForm({...appForm, khalti_number: digitsOnly(e.target.value)})}
                      maxLength={10}
                      pattern="[0-9]{10}"
                      placeholder="Enter Khalti wallet ID"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db' }}
                    />
                  </div>
                </div>

              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                <button type="button" onClick={() => setApplicationModalOpen(false)} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button type="button" onClick={handleApply} disabled={applyingId === applicationJobId} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: '#4f46e5', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                  {applyingId === applicationJobId ? "Submitting..." : "Submit Complete Application"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

