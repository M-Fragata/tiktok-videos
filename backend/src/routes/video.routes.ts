import { Router } from 'express';
import {
  createDraftVideoController,
  deleteCustomSfxController,
  deleteVideoController,
  generateAudioController,
  generateSceneImagesController,
  generateScenePromptController,
  generateSceneSfxController,
  generateScriptController,
  generateVideoController,
  getVideoByIdController,
  listSeriesController,
  listSfxLibraryController,
  listVideosController,
  listVoicesController,
  promoteSfxController,
  renderVideoController,
  rerenderVideoController,
  reviewFinalScriptController,
  saveStoryboardController,
  updateVideoTitleController,
  uploadSceneImageController,
} from '../controllers/video.controller.ts';

export const videoRoutes = Router();

// Criação de rascunho inicial para abrir no modo Briefing do Studio
videoRoutes.post('/videos', createDraftVideoController);

// Rotas Granulares do Modo Storyboard (3 Etapas)
videoRoutes.post('/videos/:id/generate-script', generateScriptController);
videoRoutes.post(
  '/videos/:id/generate-scene-images',
  generateSceneImagesController
);
videoRoutes.post(
  '/videos/:id/generate-scene-prompt',
  generateScenePromptController
);
videoRoutes.post(
  '/videos/:id/review-final-script',
  reviewFinalScriptController
);
videoRoutes.post('/videos/:id/generate-scene-sfx', generateSceneSfxController);
videoRoutes.post(
  '/videos/:id/upload-scene-image',
  uploadSceneImageController
);
videoRoutes.post('/videos/:id/generate-audio', generateAudioController);
videoRoutes.put('/videos/:id/storyboard', saveStoryboardController);
videoRoutes.patch('/videos/:id/title', updateVideoTitleController);
videoRoutes.delete('/videos/:id', deleteVideoController);

// Biblioteca Global de SFX (Padrões + CustomSfx)
videoRoutes.get('/sfx-library', listSfxLibraryController);
videoRoutes.post('/sfx-library/promote', promoteSfxController);
videoRoutes.delete('/sfx-library/:slug', deleteCustomSfxController);

// Catálogo Central Multi-Voz ElevenLabs
videoRoutes.get('/voices', listVoicesController);

// Mini-Séries & Continuidade Episódica
videoRoutes.get('/series', listSeriesController);

// Renderização MP4 e consulta
videoRoutes.post('/videos/:id/rerender', rerenderVideoController);
videoRoutes.post('/generate-video', generateVideoController);
videoRoutes.post('/render-video', renderVideoController);
videoRoutes.get('/videos/:id', getVideoByIdController);
videoRoutes.get('/videos', listVideosController);
