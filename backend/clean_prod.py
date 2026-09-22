from app.database import engine
from sqlalchemy import text

with engine.connect() as c:
    c.execute(text("DELETE FROM productos WHERE codigo IN ('QDC-T1','QDC-F1')"))
    c.commit()
print("PROD TEST OUT")
