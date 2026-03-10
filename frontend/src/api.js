import axios from "axios";

const api = axios.create({ baseURL: "/api" });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const profileId = localStorage.getItem("profile_id");
  if (profileId) {
    const skipProfileRoutes = ["/auth/", "/profiles"];
    const url = config.url || "";
    const needsProfile = !skipProfileRoutes.some((r) => url.startsWith(r));
    if (needsProfile) {
      config.params = { ...config.params, profile_id: profileId };
    }
  }

  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 || err.response?.status === 403) {
      const path = window.location.pathname;
      if (path !== "/login" && path !== "/signup") {
        localStorage.removeItem("token");
        localStorage.removeItem("profile_id");
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

export const authApi = {
  signup: (data) => api.post("/auth/signup", data).then((r) => r.data),
  login: (data) => api.post("/auth/login", data).then((r) => r.data),
  getMe: () => api.get("/auth/me").then((r) => r.data),
};

export const profileApi = {
  list: () => api.get("/profiles").then((r) => r.data),
  create: (data) => api.post("/profiles", data).then((r) => r.data),
  update: (id, data) => api.put(`/profiles/${id}`, data).then((r) => r.data),
  delete: (id) => api.delete(`/profiles/${id}`).then((r) => r.data),
};

export const getDashboard = () => api.get("/dashboard").then((r) => r.data);
export const getBorrowers = () => api.get("/borrowers").then((r) => r.data);
export const createBorrower = (data) =>
  api.post("/borrowers", data).then((r) => r.data);
export const deleteBorrower = (id) =>
  api.delete(`/borrowers/${id}`).then((r) => r.data);
export const getLoans = () => api.get("/loans").then((r) => r.data);
export const createLoan = (data) =>
  api.post("/loans", data).then((r) => r.data);
export const getLoan = (id) => api.get(`/loans/${id}`).then((r) => r.data);
export const deleteLoan = (id) =>
  api.delete(`/loans/${id}`).then((r) => r.data);
export const addPayment = (loanId, data) =>
  api.post(`/loans/${loanId}/payments`, data).then((r) => r.data);
export const deletePayment = (id) =>
  api.delete(`/payments/${id}`).then((r) => r.data);
export const getBalance = () => api.get("/balance").then((r) => r.data);
export const updateBalance = (data) =>
  api.put("/balance", data).then((r) => r.data);
export const getMonthlyCollection = () =>
  api.get("/monthly-collection").then((r) => r.data);
export const getNotificationSettings = () =>
  api.get("/settings/notifications").then((r) => r.data);
export const updateNotificationSettings = (data) =>
  api.put("/settings/notifications", data).then((r) => r.data);
export const sendTestNotification = () =>
  api.post("/notify/test").then((r) => r.data);
