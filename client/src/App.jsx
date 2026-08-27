import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Landing from "./Landing.jsx";
import Login from "./Login.jsx";
import Register from "./Register.jsx";
import CustomerDashboard from "./CustomerDashboard.jsx";
import MerchantDashboard from "./MerchantDashboard.jsx";
import AdminDashboard from "./AdminDashboard.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/customer" element={<CustomerDashboard />} />
      <Route path="/merchant" element={<MerchantDashboard />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
