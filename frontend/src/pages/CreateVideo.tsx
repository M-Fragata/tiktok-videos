import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Redirecionador retroativo para o Dashboard (Home),
 * mantendo compatibilidade com o cache e rotas do Vite.
 */
export const CreateVideo: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/', { replace: true });
  }, [navigate]);

  return null;
};

