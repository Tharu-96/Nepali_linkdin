import axios from "axios";

// ── Central Axios Instance ──────────────────────────────────
// Use one common API root. Vite proxies /api to FastAPI in dev; FastAPI also
// exposes /api aliases for direct backend access.
const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

const API = axios.create({
  baseURL: BASE_URL,
  headers: { Accept: "application/json" },
  withCredentials: false,
});

// ── Request interceptor: attach JWT ─────────────────────────
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token") || localStorage.getItem("rozgar_token");

    if (config) {
      // Ensure headers object exists and preserve existing headers
      config.headers = { ...(config.headers || {}) };
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        // Some axios configs place defaults under `headers.common` — mirror for safety
        if (!config.headers.common) config.headers.common = {};
        config.headers.common.Authorization = `Bearer ${token}`;
      } else if (import.meta.env.DEV) {
        // Helpful debug info while developing — quiet in production
        console.debug(`API request without token -> ${config?.method?.toUpperCase()} ${config?.url}`);
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor: handle 401 ────────────────────────
API.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err && err.response) {
      if (err.response.status === 401) {
        localStorage.removeItem("rozgar_token");
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        localStorage.removeItem("user");
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      }
    } else if (import.meta.env.DEV) {
      // Network error or no response — debug in development
      console.error("API network error or no response:", err);
    }
    return Promise.reject(err);
  }
);

// ── Auth API ────────────────────────────────────────────────
export const authAPI = {
  login: (data) => API.post("/auth/login", data),
  register: (data) => API.post("/auth/register", data),
  googleLogin: (token, role) => API.post("/auth/google", { token, role }),
  googleCallback: (data) => API.post("/auth/google/callback", data),
  googleCompleteRegistration: (data) => API.post("/auth/google/complete-registration", data),
  forgotPassword: (data) => API.post("/auth/forgot-password", data),
  resetPassword: (data) => API.post("/auth/reset-password", data),
};

// ── Users API ───────────────────────────────────────────────
export const usersAPI = {
  getMe: () => API.get("/users/me"),
};

// ── Jobs API ────────────────────────────────────────────────
export const jobsAPI = {
  getJobs: (search = "") => {
    let url = "/jobs";
    if (search && search.trim()) {
      url += `?search=${encodeURIComponent(search.trim())}`;
    }
    return API.get(url);
  },
  getJob: (id) => API.get(`/jobs/${id}`),
  
  // Recommendations system link
  getRecommendations: () => API.get("/jobs/recommendations"),

  createJob: (data) => API.post("/jobs", data),
  getNearbyJobs: (lat, lng) => API.get(`/jobs/nearby?lat=${lat}&lng=${lng}`),
  getEmergencyJobs: (lat, lng) => {
    let url = "/jobs/emergency";
    if (lat != null && lng != null) url += `?lat=${lat}&lng=${lng}`;
    return API.get(url);
  },
  applyToJob: (jobId, payload = {}) => API.post(`/jobs/${jobId}/apply`, payload),
  getJobApplications: (jobId) => API.get(`/jobs/${jobId}/applications`),
};

// ── Cloudinary unsigned upload helper ───────────────────────
// Uploads a File/Blob directly from the browser using the project's unsigned
// preset and returns the secure HTTPS asset URL.
export const CLOUDINARY_UPLOAD_URL = "https://api.cloudinary.com/v1_1/bghopoqf/upload";
export const CLOUDINARY_UPLOAD_PRESET = "yaleneij";

export const uploadToCloudinary = async (fileOrBlob, fileName) => {
  const formData = new FormData();
  formData.append("file", fileOrBlob, fileName || undefined);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  const response = await fetch(CLOUDINARY_UPLOAD_URL, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    throw new Error("Cloudinary upload failed");
  }
  const data = await response.json();
  return data.secure_url;
};

// ── Applications API ────────────────────────────────────────
export const applicationsAPI = {
  getMyApplications: () => API.get("/applications/my-applications"),
  updateStatus: (appId, status) =>
    API.put(`/applications/${appId}/status`, { status }),
  cancel: (appId) => API.delete(`/applications/${appId}`),
  // Submit a proposal (with optional payment coordinates) to a job.
  apply: (jobId, payload = {}) => API.post(`/jobs/${jobId}/apply`, payload),
};

// ── Profiles API ────────────────────────────────────────────
export const profilesAPI = {
  getWorkerProfile: () => API.get("/profiles/worker"),
  updateWorkerProfile: (data) => API.put("/profiles/worker", data),
  getWorkerPaymentMethods: () => API.get("/profiles/worker/payment-methods"),
  updateWorkerPaymentMethods: (data) => API.put("/profiles/worker/payment-methods", data),
  uploadWorkerResume: (formData) => API.post("/profiles/worker/resume", formData),
  getEmployerProfile: () => API.get("/profiles/employer"),
  updateEmployerProfile: (data) => API.put("/profiles/employer", data),
  uploadPhoto: (formData) => API.post("/profiles/photo", formData),
  removeProfilePhoto: () => API.delete("/profiles/profile/avatar"),
};

// ── Chat API ────────────────────────────────────────────────
export const chatAPI = {
  getConversations: (includeContacts = false) => API.get(`/chat/conversations${includeContacts ? "?include_contacts=true" : ""}`),
  getChatHistory: (userId) => API.get(`/chat/history/${userId}`),
  getUnreadCount: () => API.get("/chat/unread-count"),
  sendMessage: (payload) => API.post("/chat/messages", payload),
  // Do not force Content-Type for FormData; browser sets proper boundary.
  upload: (formData) => API.post("/chat/upload", formData),
};

export const notificationsAPI = {
  getNotifications: () => API.get("/notifications"),
  getUnreadCount: () => API.get("/notifications/unread-count"),
  markRead: (notificationId) => API.put(`/notifications/${notificationId}/read`),
  markAllRead: () => API.put("/notifications/read-all"),
};

// ── Chatbot API ─────────────────────────────────────────────
export const chatbotAPI = {
  send: (message, history = [], currentPath = null) =>
    API.post("/chatbot", { message, history, current_path: currentPath }),
};

// ── Calls API ───────────────────────────────────────────────
export const callsAPI = {
  initiate: (receiverId) => API.post("/calls/initiate", { receiver_id: receiverId }),
};

// ── Reports API ─────────────────────────────────────────────
export const reportsAPI = {
  create: (data) => API.post("/reports", data),
};

// ── Admin API ───────────────────────────────────────────────
export const adminAPI = {
  getKpiStats: () => API.get("/admin/stats/kpi"),
  getChartData: (chartType, range) => API.get(`/admin/stats/charts/${chartType}?range=${range}`),
  getWorkers: () => API.get("/admin/users/workers"),
  getEmployers: () => API.get("/admin/users/employers"),
  getUser: (userId) => API.get(`/admin/users/${userId}`),
  updateUser: (userId, data) => API.put(`/admin/users/${userId}`, data),
  deleteUser: (userId) => API.delete(`/admin/users/${userId}`),
  updateUserStatus: (userId, isActive) => API.put(`/admin/users/${userId}/status`, { is_active: isActive }),
  getJobs: (status) => API.get(`/admin/jobs${status ? `?status=${status}` : ""}`),
  updateJob: (jobId, data) => API.put(`/admin/jobs/${jobId}`, data),
  deleteJob: (jobId) => API.delete(`/admin/jobs/${jobId}`),
  getApplications: (status) => API.get(`/admin/applications${status ? `?status=${status}` : ""}`),
  getReviews: () => API.get("/admin/reviews"),
  deleteReview: (reviewId) => API.delete(`/admin/reviews/${reviewId}`),
  getReports: () => API.get("/admin/reports"),
  getAuditLogs: () => API.get("/admin/audit-logs"),
  resolveReport: (reportId) => API.put(`/admin/reports/${reportId}/resolve`),
  // All transactions with enriched employer/worker/job info
  getTransactions: (status = "", gateway = "") => {
    const params = new URLSearchParams();
    if (status) params.append("status", status);
    if (gateway) params.append("gateway", gateway);
    const qs = params.toString();
    return API.get(`/admin/transactions${qs ? `?${qs}` : ""}`);
  },
  cancelTransaction: (transactionId) => API.put(`/admin/transactions/${transactionId}/cancel`),
};

// ── Payments API ──────────────────────────────────────────────
export const paymentsAPI = {
  completeJob: (jobId) => API.put(`/payments/jobs/${jobId}/complete`),
  getJobPayments: (jobId) => API.get(`/payments/job/${jobId}`),
  initiatePayment: (data) => API.post("/payments/initiate", data),
  initiateKhaltiPayment: (data) => API.post("/payments/initiate/khalti", data),
  getPaymentStatus: (transactionId) => API.get(`/payments/status/${transactionId}`),
  markPaymentFailed: (transactionId) => API.put(`/payments/status/${transactionId}/failed`),
  cancelPayment: (transactionId) => API.put(`/payments/status/${transactionId}/cancel`),
  updatePaymentNumbers: (data) => API.put("/payments/workers/profile/payment-numbers", data),
  // Server-side signature verification before a payment is released.
  verifyEsewa: (data) => API.post("/payments/verify/esewa", data),
  verifyKhalti: (data) => API.post("/payments/verify/khalti", data),
  // Returns all transactions for the logged-in user (worker or employer)
  getMyPayments: () => API.get("/payments/me"),
  getMyWallet: () => API.get("/payments/wallet/me"),
};

// ── Reviews API ───────────────────────────────────────────────────────────────
export const reviewsAPI = {
  // Submit a review for a completed job
  submitReview: (data) => API.post("/reviews/", data),

  // Get all reviews for a specific user (paginated)
  getUserReviews: (userId, page = 1, perPage = 10) =>
    API.get(`/reviews/user/${userId}?page=${page}&per_page=${perPage}`),

  getMySubmittedReviews: (page = 1, perPage = 50) =>
    API.get(`/reviews/me/submitted?page=${page}&per_page=${perPage}`),

  // Get aggregated rating summary for a user (for profile page)
  getReviewSummary: (userId) => API.get(`/reviews/summary/${userId}`),

  // Flag/report a review as inappropriate
  reportReview: (reviewId) => API.post(`/reviews/${reviewId}/report`),
};

export default API;
