import express from 'express';
import cors from 'cors';
import { videoRoutes } from './routes/video.routes.ts';
import {
  RENDERS_OUTPUT_DIR,
  STORAGE_OUTPUT_DIR,
} from './services/remotion.service.ts';

const app = express();
const PORT = Number(process.env.PORT) || 3333;

app.use(cors());
app.use(express.json());

// Serve os ficheiros .mp4 renderizados em /renders/<id>.mp4
app.use('/renders', express.static(RENDERS_OUTPUT_DIR));

// Serve os assets gerados pela IA (áudio ElevenLabs e imagens Imagen) em /storage/<id>/...
app.use('/storage', express.static(STORAGE_OUTPUT_DIR));

// Rotas da API
app.use('/api', videoRoutes);

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'fragata-shorts-backend' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Fragata Shorts Back-end Express em execução em http://localhost:${PORT}`);
});
