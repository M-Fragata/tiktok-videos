import express from 'express';
import cors from 'cors';
import { prisma } from './lib/prisma.ts';
import { videoRoutes } from './routes/video.routes.ts';
import {
  RENDERS_OUTPUT_DIR,
  STORAGE_OUTPUT_DIR,
} from './services/remotion.service.ts';

// Previne falhas de SSL (SELF_SIGNED_CERT_IN_CHAIN) causadas por inspeção de tráfego HTTPS
// de antivírus locais (Kaspersky, Avast, ESET), firewalls corporativos ou proxies de rede local
if (process.env.NODE_ENV !== 'production' && !process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const app = express();
const PORT = Number(process.env.PORT) || 3333;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve os ficheiros .mp4 renderizados em /renders/<id>.mp4
app.use('/renders', express.static(RENDERS_OUTPUT_DIR));

// Serve os assets gerados pela IA (áudio ElevenLabs e imagens Imagen) em /storage/<id>/...
app.use('/storage', express.static(STORAGE_OUTPUT_DIR));

// Rotas da API
app.use('/api', videoRoutes);

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'fragata-shorts-backend' });
});

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Fragata Shorts Back-end Express em execução em http://localhost:${PORT}`);
  try {
    const recovered = await prisma.video.updateMany({
      where: { status: 'PENDING' },
      data: { status: 'DRAFT' },
    });
    if (recovered.count > 0) {
      console.log(
        `[Auto-Recovery] ${recovered.count} vídeo(s) com status PENDING resetado(s) para DRAFT após reinício do servidor.`
      );
    }
  } catch (err) {
    console.warn('[Auto-Recovery] Falha ao verificar vídeos pendentes na inicialização:', err);
  }
});
