import { Routes, Route, Navigate } from "react-router-dom";

import Home from "./pages/Home.jsx";
import Login from "./pages/login.jsx";
import Inspection from "./pages/Inspection.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import ReviewFindings from "./pages/ReviewFindings.jsx";
import Report from "./pages/report.jsx";


// ======================================================
// PROTECTED ROUTE
// ======================================================

function ProtectedRoute({ children }) {
  const token = localStorage.getItem("sahipack_token");

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}


// ======================================================
// APP
// ======================================================

export default function App() {
  return (
    <Routes>

      {/* ================================================
          PUBLIC PAGES
          ================================================ */}

      <Route
        path="/"
        element={<Home />}
      />

      <Route
        path="/login"
        element={<Login />}
      />


      {/* ================================================
          INSPECTOR DASHBOARD
          ================================================ */}

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />


      {/* ================================================
          NEW INSPECTION
          ================================================ */}

      <Route
        path="/inspection"
        element={
          <ProtectedRoute>
            <Inspection />
          </ProtectedRoute>
        }
      />


      {/* ================================================
          REVIEW FINDINGS
          Example:
          /inspection/9/findings
          ================================================ */}

      <Route
        path="/inspection/:inspectionId/findings"
        element={
          <ProtectedRoute>
            <ReviewFindings />
          </ProtectedRoute>
        }
      />


      {/* ================================================
          FINAL REPORT
          Example:
          /inspection/9/report
          ================================================ */}

      <Route
        path="/inspection/:inspectionId/report"
        element={
          <ProtectedRoute>
            <Report />
          </ProtectedRoute>
        }
      />


      {/* ================================================
          FALLBACK
          ================================================ */}

      <Route
        path="*"
        element={<Navigate to="/" replace />}
      />

    </Routes>
  );
}