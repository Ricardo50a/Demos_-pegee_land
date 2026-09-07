import os
import psycopg2
from psycopg2.extras import RealDictCursor
from flask import Flask, request, render_template_string
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

def get_db():
    try:
        return psycopg2.connect(
            host=os.getenv('PGHOST'),
            port=os.getenv('PGPORT', 5432),
            user=os.getenv('PGUSER'),
            password=os.getenv('PGPASSWORD'),
            database=os.getenv('PGDATABASE'),
            # Importante para Render/Supabase
            connect_timeout=5
        )
    except Exception as e:
        print(f"Error de conexión a DB: {e}")
        return None

HTML_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <title>MiContaBeta</title>
</head>
<body class="p-3" style="max-width:500px; margin:auto;">
    <div class="card p-4">
        <h2 class="text-center">📊 MiContaBeta</h2>
        <form action="/agregar" method="POST">
            <input class="form-control mb-2" type="text" name="descripcion" placeholder="Descripción" required>
            <input class="form-control mb-2" type="number" step="0.01" name="monto" placeholder="Monto" required>
            <select class="form-select mb-3" name="tipo">
                <option value="Ingreso">Ingreso</option>
                <option value="Egreso">Egreso</option>
            </select>
            <button class="btn btn-success w-100" type="submit">Guardar</button>
        </form>
        <div class="alert alert-info text-center mt-3">
            Balance: ${{ balance }}
        </div>
        <h5>Historial</h5>
        <ul class="list-group">
            {% for t in transacciones %}
            <li class="list-group-item d-flex justify-content-between">
                <span><strong>{{ t.tipo }}</strong> - {{ t.descripcion }}</span>
                <span>${{ t.monto }}</span>
            </li>
            {% endfor %}
        </ul>
    </div>
</body>
</html>
"""

@app.route('/')
@app.route('/index')
def index():
    try:
        conn = get_db()
        if conn is None:
            return "Error: No se pudo conectar a la base de datos"
        
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT * FROM transacciones ORDER BY id DESC")
        transacciones = cur.fetchall()
        
        cur.execute("SELECT COALESCE(SUM(CASE WHEN tipo='Ingreso' THEN monto ELSE -monto END), 0) FROM transacciones")
        resultado_balance = cur.fetchone()
        balance = resultado_balance['coalesce'] if resultado_balance else 0.0
        
        conn.close()
        return render_template_string(HTML_TEMPLATE, transacciones=transacciones, balance=round(balance, 2))
    except Exception as e:
        return f"Error en la Base de Datos: {str(e)}"

@app.route('/agregar', methods=['POST'])
def agregar():
    try:
        desc = request.form['descripcion']
        monto = float(request.form['monto'])
        tipo = request.form['tipo']
        conn = get_db()
        if conn is None:
            return "Error: No se pudo conectar a la base de datos"
        
        cur = conn.cursor()
        cur.execute("INSERT INTO transacciones (descripcion, monto, tipo) VALUES (%s, %s, %s)", (desc, monto, tipo))
        conn.commit()
        conn.close()
        return '<script>window.location.href="/";</script>'
    except Exception as e:
        return f"Error al guardar datos: {str(e)}"

if __name__ == '__main__':
    # Render asigna el puerto automáticamente
    port = int(os.getenv('PORT', 10000))
    app.run(host='0.0.0.0', port=port)
