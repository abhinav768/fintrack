import axios from "axios";

const api = axios.create({ baseURL: "/api" });

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
