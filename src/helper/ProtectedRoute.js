import React from "react";
import { Navigate, Outlet } from "react-router-dom";

const ProtectedRoute = () => {
  const jwt = localStorage.getItem("jwt");

  if (!jwt) {
    return <Navigate to="/signup" />;
  }

  return <Outlet />;
};

export default ProtectedRoute;