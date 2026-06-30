// Vercel serverless entry point for the backend.
// NOTE: Vercel's serverless runtime does not keep long-lived processes, so the
// in-process scheduler and SSE stream (/api/events) are best run on a persistent
// host (Render/VPS/Docker). REST endpoints work fine on Vercel.
import { createApp } from '../src/app';

const app = createApp();
export default app;
