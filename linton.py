import os
import psycopg2
from psycopg2.extras import RealDictCursor
from flask import Flask, render_template, request, redirect, url_for, flash, send_file, jsonify
from datetime import datetime
from decimal import Decimal
import pandas as pd
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors
import io
import logging
import json

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')

# ============================================
# CONEXIÓN A SUPABASE (usando DATABASE_URL)
# ============================================
DATABASE_URL = os.environ.get('DATABASE_URL')
if not DATABASE_URL:
    raise ValueError("❌ DATABASE_URL no configurada en variables de entorno")
def get_db_connection():
    try:
        return psycopg2.connect(
            host=os.environ.get('PGHOST'),
            database=os.environ.get('PGDATABASE'),
            user=os.environ.get('PGUSER'),
            password=os.environ.get('PGPASSWORD'),
            port=os.environ.get('PGPORT'),
            connect_timeout=10
        )
    except Exception as e:
        print(f"Error conectando a la base de datos: {e}")
        raise
# ============================================
# RUTA PRINCIPAL
# ============================================
@app.route('/')
@app.route('/index')
def index():
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Transacciones activas
            cur.execute("""
                SELECT id, factura_numero, descripcion, monto, tipo, fecha_operacion 
                FROM transacciones 
                WHERE estado_registro = 'Activo' 
                ORDER BY id DESC
            """)
            transacciones = cur.fetchall()
            
            # KPIs
            cur.execute("SELECT COALESCE(SUM(monto), 0) FROM transacciones WHERE tipo='Ingreso' AND estado_registro='Activo'")
            total_ingresos = Decimal(cur.fetchone()['coalesce'])
            
            cur.execute("SELECT COALESCE(SUM(monto), 0) FROM transacciones WHERE tipo='Egreso' AND estado_registro='Activo'")
            total_egresos = Decimal(cur.fetchone()['coalesce'])
            
            balance_total = total_ingresos - total_egresos
            
            # Auditoría
            cur.execute("SELECT COUNT(*) FROM auditoria_cambios")
            total_auditoria = cur.fetchone()['count']
            
            cur.execute("""
                SELECT id, transaccion_id, accion, datos_previos, datos_nuevos, fecha 
                FROM auditoria_cambios 
                ORDER BY id DESC 
                LIMIT 50
            """)
            auditoria = cur.fetchall()
            
        return render_template(
            'dashboard.html',
            transacciones=transacciones,
            balance_total=float(balance_total),
            total_ingresos=float(total_ingresos),
            total_egresos=float(total_egresos),
            total_auditoria=total_auditoria,
            auditoria=auditoria,
            balance_mensual=None
        )
    except Exception as e:
        logger.error(f"Error en index: {e}")
        return f"Error crítico: {str(e)}", 500
    finally:
        if conn:
            conn.close()

# ============================================
# AGREGAR TRANSACCIÓN CON VALIDACIÓN
# ============================================
@app.route('/agregar', methods=['POST'])
def agregar():
    conn = None
    try:
        factura = request.form.get('factura_numero', '').strip()
        desc = request.form.get('descripcion', '').strip()
        monto = request.form.get('monto', '0').strip()
        tipo = request.form.get('tipo', '').strip()
        
        # Validaciones
        if not factura:
            flash("⚠️ El número de factura es obligatorio.")
            return redirect(url_for('index'))
        
        if not desc:
            flash("⚠️ La descripción es obligatoria.")
            return redirect(url_for('index'))
        
        try:
            monto_decimal = Decimal(monto)
            if monto_decimal <= 0:
                flash("⚠️ El monto debe ser mayor a cero.")
                return redirect(url_for('index'))
        except:
            flash("⚠️ Formato de monto inválido.")
            return redirect(url_for('index'))
        
        if tipo not in ['Ingreso', 'Egreso']:
            flash("⚠️ Tipo de operación inválido.")
            return redirect(url_for('index'))
        
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO transacciones (factura_numero, descripcion, monto, tipo, fecha_operacion)
                VALUES (%s, %s, %s, %s, %s)
            """, (factura, desc, float(monto_decimal), tipo, datetime.now()))
            conn.commit()
        
        flash(f"✅ Asiento registrado correctamente. Factura: {factura}")
        return redirect(url_for('index'))
    
    except psycopg2.errors.UniqueViolation:
        flash("❌ Error: Ya existe una factura con ese número y tipo.")
        return redirect(url_for('index'))
    except Exception as e:
        flash(f"❌ Error guardando: {str(e)}")
        return redirect(url_for('index'))
    finally:
        if conn:
            conn.close()

# ============================================
# ELIMINAR CON AUDITORÍA AUTOMÁTICA
# ============================================
@app.route('/eliminar/<int:id>', methods=['POST'])
def eliminar(id):
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("DELETE FROM transacciones WHERE id = %s", (id,))
            conn.commit()
        flash("🗑️ Transacción eliminada (registro en auditoría).")
        return redirect(url_for('index'))
    except Exception as e:
        flash(f"❌ Error eliminando: {str(e)}")
        return redirect(url_for('index'))
    finally:
        if conn:
            conn.close()

# ============================================
# CIERRE MENSUAL
# ============================================
@app.route('/cierre_mensual', methods=['GET'])
def cierre_mensual():
    mes = request.args.get('mes', '')
    if not mes:
        flash("Selecciona un mes válido.")
        return redirect(url_for('index'))
    
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Transacciones del mes
            cur.execute("""
                SELECT id, factura_numero, descripcion, monto, tipo, fecha_operacion
                FROM transacciones
                WHERE DATE_TRUNC('month', fecha_operacion) = %s::date
                AND estado_registro = 'Activo'
                ORDER BY id DESC
            """, (mes + '-01',))
            transacciones = cur.fetchall()
            
            # Totales del mes
            cur.execute("""
                SELECT COALESCE(SUM(monto), 0) FROM transacciones
                WHERE DATE_TRUNC('month', fecha_operacion) = %s::date
                AND tipo = 'Ingreso' AND estado_registro = 'Activo'
            """, (mes + '-01',))
            ingresos = Decimal(cur.fetchone()['coalesce'])
            
            cur.execute("""
                SELECT COALESCE(SUM(monto), 0) FROM transacciones
                WHERE DATE_TRUNC('month', fecha_operacion) = %s::date
                AND tipo = 'Egreso' AND estado_registro = 'Activo'
            """, (mes + '-01',))
            egresos = Decimal(cur.fetchone()['coalesce'])
            
            balance = ingresos - egresos
            
            # KPIs generales
            cur.execute("SELECT COALESCE(SUM(monto), 0) FROM transacciones WHERE tipo='Ingreso' AND estado_registro='Activo'")
            total_ingresos = Decimal(cur.fetchone()['coalesce'])
            
            cur.execute("SELECT COALESCE(SUM(monto), 0) FROM transacciones WHERE tipo='Egreso' AND estado_registro='Activo'")
            total_egresos = Decimal(cur.fetchone()['coalesce'])
            
            balance_total = total_ingresos - total_egresos
            
            cur.execute("SELECT COUNT(*) FROM auditoria_cambios")
            total_auditoria = cur.fetchone()['count']
            
            cur.execute("""
                SELECT id, transaccion_id, accion, datos_previos, datos_nuevos, fecha 
                FROM auditoria_cambios 
                ORDER BY id DESC 
                LIMIT 50
            """)
            auditoria = cur.fetchall()
            
            balance_mensual = {
                'mes': mes,
                'ingresos': float(ingresos),
                'egresos': float(egresos),
                'balance': float(balance)
            }
            
        return render_template(
            'dashboard.html',
            transacciones=transacciones,
            balance_total=float(balance_total),
            total_ingresos=float(total_ingresos),
            total_egresos=float(total_egresos),
            total_auditoria=total_auditoria,
            auditoria=auditoria,
            balance_mensual=balance_mensual
        )
    except Exception as e:
        flash(f"❌ Error generando balance: {str(e)}")
        return redirect(url_for('index'))
    finally:
        if conn:
            conn.close()

# ============================================
# API REST
# ============================================
@app.route('/api/transacciones', methods=['GET'])
def api_transacciones():
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT id, factura_numero, descripcion, monto, tipo, fecha_operacion, estado_registro
                FROM transacciones
                WHERE estado_registro = 'Activo'
                ORDER BY id DESC
                LIMIT 1000
            """)
            rows = cur.fetchall()
            for row in rows:
                row['monto'] = float(row['monto'])
                row['fecha_operacion'] = row['fecha_operacion'].isoformat() if row['fecha_operacion'] else None
        
        return jsonify({
            'status': 'success',
            'total': len(rows),
            'data': rows,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500
    finally:
        if conn:
            conn.close()

# ============================================
# EXPORTAR EXCEL
# ============================================
@app.route('/exportar/excel')
def exportar_excel():
    conn = None
    try:
        conn = get_db_connection()
        df = pd.read_sql_query("""
            SELECT fecha_operacion, factura_numero, descripcion, tipo, monto, estado_registro
            FROM transacciones
            ORDER BY id DESC
        """, conn)
        
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Libro_Contable')
        output.seek(0)
        
        return send_file(
            output,
            as_attachment=True,
            download_name=f"Contabilidad_{datetime.now().strftime('%Y%m%d')}.xlsx",
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    except Exception as e:
        return f"Error exportando Excel: {str(e)}", 500
    finally:
        if conn:
            conn.close()

# ============================================
# EXPORTAR PDF
# ============================================
@app.route('/exportar/pdf')
def exportar_pdf():
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT fecha_operacion, factura_numero, descripcion, tipo, monto FROM transacciones ORDER BY id DESC")
            rows = cur.fetchall()
        
        output = io.BytesIO()
        doc = SimpleDocTemplate(output, pagesize=letter)
        styles = getSampleStyleSheet()
        story = []
        
        story.append(Paragraph("<b>REPORTE DE LIBROS CONTABLES - MICONTABETA</b>", styles['Title']))
        story.append(Spacer(1, 15))
        story.append(Paragraph(f"Generado: {datetime.now().strftime('%d/%m/%Y %H:%M')}", styles['Normal']))
        story.append(Spacer(1, 15))
        
        data = [["Fecha", "Factura", "Detalle", "Tipo", "Monto"]]
        for r in rows:
            fecha = r['fecha_operacion'].strftime('%d/%m/%Y') if r['fecha_operacion'] else 'N/A'
            data.append([fecha, r['factura_numero'], r['descripcion'], r['tipo'], f"{r['monto']:.2f}"])
        
        t = Table(data, colWidths=[70, 80, 200, 70, 80])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1a56db')),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('GRID', (0,0), (-1,-1), 0.5, colors.grey),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f8fafc')])
        ]))
        story.append(t)
        
        doc.build(story)
        output.seek(0)
        return send_file(
            output,
            as_attachment=True,
            download_name=f"Balance_{datetime.now().strftime('%Y%m%d')}.pdf",
            mimetype="application/pdf"
        )
    except Exception as e:
        return f"Error exportando PDF: {str(e)}", 500
    finally:
        if conn:
            conn.close()

# ============================================
# IMPORTAR EXCEL CON VALIDACIÓN
# ============================================
@app.route('/importar', methods=['POST'])
def importar_excel():
    conn = None
    try:
        file = request.files.get('archivo_excel')
        if not file:
            flash("❌ No se seleccionó ningún archivo.")
            return redirect(url_for('index'))
        
        df = pd.read_excel(file)
        
        columnas_req = ['factura_numero', 'descripcion', 'monto', 'tipo']
        if not all(col in df.columns for col in columnas_req):
            flash("❌ El Excel debe tener columnas: factura_numero, descripcion, monto, tipo")
            return redirect(url_for('index'))
        
        conn = get_db_connection()
        registros_insertados = 0
        errores = []
        
        with conn.cursor() as cur:
            for idx, row in df.iterrows():
                try:
                    factura = str(row['factura_numero']).strip()
                    desc = str(row['descripcion']).strip()
                    monto = float(row['monto'])
                    tipo = str(row['tipo']).strip()
                    
                    if not factura or not desc or monto <= 0 or tipo not in ['Ingreso', 'Egreso']:
                        errores.append(f"Fila {idx+1}: Datos inválidos")
                        continue
                    
                    cur.execute("""
                        INSERT INTO transacciones (factura_numero, descripcion, monto, tipo, fecha_operacion)
                        VALUES (%s, %s, %s, %s, %s)
                    """, (factura, desc, monto, tipo, datetime.now()))
                    registros_insertados += 1
                
                except psycopg2.errors.UniqueViolation:
                    conn.rollback()
                    errores.append(f"Fila {idx+1}: Factura duplicada ({row['factura_numero']})")
                except Exception as e:
                    conn.rollback()
                    errores.append(f"Fila {idx+1}: {str(e)}")
        
        conn.commit()
        
        mensaje = f"✅ {registros_insertados} registros importados correctamente."
        if errores:
            mensaje += f" ⚠️ {len(errores)} errores: " + ", ".join(errores[:5])
            if len(errores) > 5:
                mensaje += f" y {len(errores)-5} más."
        
        flash(mensaje)
        return redirect(url_for('index'))
    
    except Exception as e:
        flash(f"❌ Error procesando el archivo: {str(e)}")
        return redirect(url_for('index'))
    finally:
        if conn:
            conn.close()

# ============================================
# MAIN
# ============================================
if __name__ == '__main__':
    port = int(os.getenv('PORT', 10000))
    app.run(host='0.0.0.0', port=port, debug=False)
