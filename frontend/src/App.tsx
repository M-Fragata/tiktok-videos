import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Home } from './pages/Home';
import { Studio } from './pages/Studio';
import { CreateVideo } from './pages/CreateVideo';
import { Dashboard } from './pages/Dashboard';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/video/:id" element={<Studio />} />
        <Route path="/create" element={<CreateVideo />} />
      </Routes>
    </BrowserRouter>
  );
};
