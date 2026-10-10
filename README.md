# PulseOps Backend Service

Standalone Node.js / Express microservice connecting to PostgreSQL with DevSecOps CI/CD gates.

## Features
- **Express REST API** with automatic schema initialization
- **Kubernetes Probes**: `/healthz` (liveness/readiness), `/api/status`
- **Trivy-compliant Dockerfile**: Minimal Alpine base, clean `npm ci` install inside container, non-root `USER node`
- **GitHub Actions CI**: Automated unit tests, SonarQube SAST analysis, Trivy image CVE scanning, and push to GitHub Container Registry (`ghcr.io`)

---

## 🚀 Running Locally

### Option A: Using Docker Compose (Backend + PostgreSQL)
```bash
docker compose up --build
```
- API Base: `http://localhost:5000`
- Health Probe: `http://localhost:5000/healthz`
- PostgreSQL: `localhost:5433`

### Option B: Bare-Metal (Node.js)
```bash
npm install
npm test
npm run dev
```
Make sure PostgreSQL is running and update `.env` accordingly (see `.env.example`).
