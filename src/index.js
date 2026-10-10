import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import os from 'os';
import pool, { initDb, checkDbHealth } from './db.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;
const appVersion = process.env.APP_VERSION || '1.0.0';

app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Liveness & Readiness probe endpoint for Kubernetes / Docker
app.get('/healthz', async (req, res) => {
  const dbHealth = await checkDbHealth();
  if (dbHealth.healthy) {
    res.status(200).json({ status: 'UP', database: 'connected', timestamp: new Date() });
  } else {
    res.status(503).json({ status: 'DOWN', database: 'disconnected', error: dbHealth.error });
  }
});

// Node / Pod metadata status
app.get('/api/status', async (req, res) => {
  const dbHealth = await checkDbHealth();
  res.json({
    appName: 'PulseOps DevSecOps API',
    version: appVersion,
    hostname: os.hostname(),
    uptime: `${Math.floor(process.uptime())}s`,
    database: dbHealth,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Get all deployment logs/tasks
app.get('/api/deployments', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM deployments ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching deployments:', err);
    res.status(500).json({ error: 'Failed to fetch deployments' });
  }
});

// Create a new deployment log/task
app.post('/api/deployments', async (req, res) => {
  const { title, environment, status } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO deployments (title, environment, status) VALUES ($1, $2, $3) RETURNING *',
      [title, environment || 'production', status || 'pending']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating deployment:', err);
    res.status(500).json({ error: 'Failed to create deployment' });
  }
});

// Update status
app.patch('/api/deployments/:id', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const result = await pool.query(
      'UPDATE deployments SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Deployment record not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating deployment:', err);
    res.status(500).json({ error: 'Failed to update deployment' });
  }
});

// Delete deployment
app.delete('/api/deployments/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM deployments WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Deployment record not found' });
    }
    res.json({ message: 'Deployment deleted successfully', id });
  } catch (err) {
    console.error('Error deleting deployment:', err);
    res.status(500).json({ error: 'Failed to delete deployment' });
  }
});

// Start server
async function startServer() {
  try {
    console.log('Connecting to PostgreSQL database...');
    await initDb();
    console.log('Database connected successfully.');
  } catch (err) {
    console.warn('Warning: Database connection failed at startup. Will retry on request.', err.message);
  }

  const server = app.listen(port, () => {
    console.log(`PulseOps Backend running on port ${port} (Host: ${os.hostname()})`);
  });

  // Graceful shutdown handling for K8s SIGTERM
  const handleShutdown = (signal) => {
    console.log(`Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      console.log('HTTP server closed.');
      await pool.end();
      console.log('Database pool drained.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}

startServer();
