import axios from "axios";

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || "/api" });

// Attach the login token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// An expired / invalid token logs the user out
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const isLogin = err.config?.url?.includes("/auth/login");
    if (err.response?.status === 401 && !isLogin) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      if (window.location.pathname !== "/login") window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export const getErrorMessage = (err) =>
  err.response?.data?.message || (err.request ? "Cannot reach the server. Is the Flask backend running?" : err.message);

export const getFieldErrors = (err) => err.response?.data?.errors || {};

const get = (url, params) => api.get(url, { params }).then((r) => r.data);
const post = (url, body) => api.post(url, body).then((r) => r.data);
const put = (url, body) => api.put(url, body).then((r) => r.data);
const del = (url) => api.delete(url).then((r) => r.data);

export const authApi = {
  login: (email, password) => post("/auth/login", { email, password }),
  register: (data) => post("/auth/register", data),
  me: () => get("/auth/me"),
  changePassword: (data) => post("/auth/change-password", data),
};

export const dashboardApi = { stats: () => get("/dashboard/stats") };

export const studentsApi = {
  list: (params) => get("/students", params),
  me: () => get("/students/me"),
  updateMe: (data) => put("/students/me", data),
  create: (data) => post("/students", data),
  update: (id, data) => put(`/students/${id}`, data),
  remove: (id) => del(`/students/${id}`),
};

export const facultyApi = {
  list: (params) => get("/faculty", params),
  me: () => get("/faculty/me"),
  create: (data) => post("/faculty", data),
  update: (id, data) => put(`/faculty/${id}`, data),
  remove: (id) => del(`/faculty/${id}`),
};

export const departmentsApi = {
  list: () => get("/departments"),
  create: (data) => post("/departments", data),
  update: (id, data) => put(`/departments/${id}`, data),
  remove: (id) => del(`/departments/${id}`),
};

export const semestersApi = {
  list: () => get("/semesters"),
  create: (data) => post("/semesters", data),
  update: (id, data) => put(`/semesters/${id}`, data),
  remove: (id) => del(`/semesters/${id}`),
};

export const coursesApi = {
  list: (params) => get("/courses", params),
  get: (id) => get(`/courses/${id}`),
  students: (id) => get(`/courses/${id}/students`),
  create: (data) => post("/courses", data),
  update: (id, data) => put(`/courses/${id}`, data),
  assignFaculty: (id, facultyId) => put(`/courses/${id}/faculty`, { faculty_id: facultyId || null }),
  remove: (id) => del(`/courses/${id}`),
};

export const enrollmentsApi = {
  list: (params) => get("/enrollments", params),
  create: (data) => post("/enrollments", data),
  update: (id, data) => put(`/enrollments/${id}`, data),
  drop: (id) => post(`/enrollments/${id}/drop`),
  remove: (id) => del(`/enrollments/${id}`),
};

export const attendanceApi = {
  roster: (courseId, date) => get(`/attendance/course/${courseId}`, { date }),
  dates: (courseId) => get(`/attendance/course/${courseId}/dates`),
  save: (courseId, date, records) => post(`/attendance/course/${courseId}`, { date, records }),
  report: (params) => get("/attendance/report", params),
  mine: () => get("/attendance/me"),
  mineForCourse: (courseId) => get(`/attendance/me/course/${courseId}`),
};

export const examsApi = {
  list: (params) => get("/exams", params),
  create: (data) => post("/exams", data),
  update: (id, data) => put(`/exams/${id}`, data),
  remove: (id) => del(`/exams/${id}`),
  marks: (id) => get(`/exams/${id}/marks`),
  saveMarks: (id, records) => post(`/exams/${id}/marks`, { records }),
  myMarks: () => get("/marks/me"),
};

export const reportsApi = {
  performance: (params) => get("/reports/performance", params),
  cgpa: () => get("/reports/cgpa"),
  course: (id) => get(`/reports/course/${id}`),
  myHistory: () => get("/reports/history"),
  studentHistory: (id) => get(`/reports/history/${id}`),
};

export default api;
