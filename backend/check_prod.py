from app.database import engine
from sqlalchemy import text

with engine.connect() as c:
    rows = c.execute(text("SELECT codigo FROM productos ORDER BY 1")).fetchall()
print("PRODUCTOS:", rows)
