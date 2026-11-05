// GET /api/ping/deployment → the Deployment, its pods and its container settings.
export function createDeploymentController({ deploymentService }) {
  return {
    get: async () => ({ status: 200, body: await deploymentService.snapshot() }),
  };
}
