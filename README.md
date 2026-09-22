# La Casa del Queso — MVP

Stack: Python 3.14 + FastAPI + SQLAlchemy + PostgreSQL (psycopg 3) + React + Vite + Tailwind.

## Backend

```powershell
cd backend
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m app.seed
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

- API: http://127.0.0.1:8000 — Docs: http://127.0.0.1:8000/docs
- Salud: `GET /health`
- Auth: `POST /api/v1/auth/login {"username":"admin","password":"admin"}`

## Frontend

```powershell
cd frontend
npm install
npm run dev
```

- App: http://localhost:5173 (proxy `/api` → `127.0.0.1:8000`)
- Login redirige a `/dashboard`. Rutas protegidas con JWT.

## Credenciales DEMO

- Usuario: `admin` — Contraseña: `admin` (rol `administrador`)

## Flujo verificado (E2E)

compra → recibir (costo promedio ponderado, movimiento ENTRADA) →
POS por peso 2.5 kg (movimiento SALIDA, venta PAGADA) →
pedido (NO descuenta) → facturar pedido (descuenta) →
dashboard (9 métricas) → caja apertura/cierre con cuadre.

## Futuro (NO implementado, solo seams)

Siigo (`ventas.siigo_id`), DIAN, báscula física (`WeightInput` manual por ahora),
impresora (`TicketPreview` en pantalla), pagos online, WhatsApp, Docker/despliegue.
