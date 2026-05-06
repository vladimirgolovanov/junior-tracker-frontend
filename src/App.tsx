import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import RequireAuth from "./components/RequireAuth";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ChartPage from "./pages/ChartPage";
import AddEventPage from "./pages/AddEventPage";
import ChildSettingsPage from "./pages/ChildSettingsPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route element={<RequireAuth />}>
            <Route path="/chart" element={<ChartPage />} />
            <Route path="/add-event" element={<AddEventPage />} />
            <Route path="/child-settings" element={<ChildSettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/chart" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
