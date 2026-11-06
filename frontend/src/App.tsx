import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Home } from './pages/Home';
import { CreateVideo } from './pages/CreateVideo';
import { Studio } from './pages/Studio';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/create" element={<CreateVideo />} />
        <Route path="/video/:id" element={<Studio />} />
      </Routes>
    </BrowserRouter>
  );
};
