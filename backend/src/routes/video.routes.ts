import { Router } from 'express';
import {
  createDraftVideoController,
  deleteVideoController,
  generateAudioController,
  generateSceneImagesController,
  generateSceneSfxController,
  generateScriptController,
  generateVideoController,
  getVideoByIdController,
  listVideosController,
  renderVideoController,
  rerenderVideoController,
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
videoRoutes.post('/videos/:id/generate-scene-sfx', generateSceneSfxController);
videoRoutes.post(
  '/videos/:id/upload-scene-image',
  uploadSceneImageController
);
videoRoutes.post('/videos/:id/generate-audio', generateAudioController);
videoRoutes.put('/videos/:id/storyboard', saveStoryboardController);
videoRoutes.patch('/videos/:id/title', updateVideoTitleController);
videoRoutes.delete('/videos/:id', deleteVideoController);

// Renderização MP4 e consulta
videoRoutes.post('/videos/:id/rerender', rerenderVideoController);
videoRoutes.post('/generate-video', generateVideoController);
videoRoutes.post('/render-video', renderVideoController);
videoRoutes.get('/videos/:id', getVideoByIdController);
videoRoutes.get('/videos', listVideosController);
