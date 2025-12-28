import { Router } from 'express';
import type { Database } from '../lib/db.js';

export function createRouter(db: Database): Router {
  const router = Router();

  // Mount generated routes (these will be populated by fd generate)
  // router.use(generatedRoutes);

  // Placeholder action endpoint
  router.all('/actions/:actionName', async (req, res) => {
    const { actionName } = req.params;

    res.status(501).json({
      error: {
        code: 'NOT_IMPLEMENTED',
        message: `Action '${actionName}' not implemented. Run 'fd generate' to generate action handlers.`,
      },
    });
  });

  // Upload endpoint
  router.post('/upload', async (req, res) => {
    res.status(501).json({
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'File upload not implemented. Run fd generate first.',
      },
    });
  });

  return router;
}
