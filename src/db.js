import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'pulseops',
  connectionTimeoutMillis: 5000,
});

export async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS deployments (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        environment VARCHAR(50) DEFAULT 'production',
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Seed initial records if empty
    const res = await client.query('SELECT COUNT(*) FROM deployments');
    if (parseInt(res.rows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO deployments (title, environment, status)
        VALUES 
          ('Initial Postgres Setup', 'development', 'healthy'),
          ('Backend Express Containerization', 'staging', 'healthy'),
          ('K8s GitOps Deployment', 'production', 'in_progress');
      `);
      console.log('Seeded initial deployments data.');
    }
    console.log('Database schema verified & ready.');
  } finally {
    client.release();
  }
}

export async function checkDbHealth() {
  try {
    const res = await pool.query('SELECT NOW() as now');
    return { healthy: true, timestamp: res.rows[0].now };
  } catch (err) {
    return { healthy: false, error: err.message };
  }
}

export default pool;
