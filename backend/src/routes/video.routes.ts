import { Router } from 'express';
import {
  getVideoByIdController,
  listVideosController,
  renderVideoController,
} from '../controllers/video.controller.ts';

export const videoRoutes = Router();

videoRoutes.post('/render-video', renderVideoController);
videoRoutes.get('/videos/:id', getVideoByIdController);
videoRoutes.get('/videos', listVideosController);

