import { useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ToastProvider } from "./components/ui/Toaster";
import { DialogHost } from "./components/ui/Dialog";
import HomePage from "./pages/Home";
import SequencesPage from "./pages/Sequences";
import CyclePage from "./pages/Cycle";
import CycleListPage from "./pages/CycleList";
import SpendPage from "./pages/Spend";
import RoadmapPage from "./pages/Roadmap";

function Shell() {
  const [subtitle, setSubtitle] = useState<string | undefined>(undefined);
  return (
    <Routes>
      <Route element={<LayoutWrapper subtitle={subtitle} setSubtitle={setSubtitle} />}>
        <Route index element={<HomePage />} />
        <Route path="/sequences" element={<SequencesPage />} />
        <Route path="/cycle" element={<CycleListPage />} />
        <Route path="/cycle/:id" element={<CyclePage />} />
        <Route path="/spend" element={<SpendPage />} />
        <Route path="/roadmap" element={<RoadmapPage />} />
      </Route>
    </Routes>
  );
}

function LayoutWrapper({
  subtitle,
  setSubtitle,
}: {
  subtitle: string | undefined;
  setSubtitle: (s: string | undefined) => void;
}) {
  return <Layout subtitle={subtitle} context={{ setSubtitle }} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Shell />
        <DialogHost />
      </ToastProvider>
    </BrowserRouter>
  );
}
