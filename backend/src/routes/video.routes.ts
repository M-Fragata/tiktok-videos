import { Router } from 'express';
import {
  generateVideoController,
  getVideoByIdController,
  listVideosController,
  renderVideoController,
  rerenderVideoController,
} from '../controllers/video.controller.ts';

export const videoRoutes = Router();

videoRoutes.post('/generate-video', generateVideoController);
videoRoutes.post('/videos/:id/rerender', rerenderVideoController);
videoRoutes.post('/render-video', renderVideoController);
videoRoutes.get('/videos/:id', getVideoByIdController);
videoRoutes.get('/videos', listVideosController);
