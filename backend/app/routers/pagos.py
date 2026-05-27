from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from decimal import Decimal
from typing import Optional
from app.database import get_db
from app.models import Pago, Turno, Cliente, Deuda
from app.schemas import PagoCreate, PagoResponse
from datetime import datetime, timedelta
from sqlalchemy import func

router = APIRouter(prefix="/pagos", tags=["Pagos"])


#helpers

def _get_or_404(db: Session, model, id_field, id_value):
    obj = db.query(model).filter(id_field == id_value).first()
    if not obj:
        raise HTTPException(status_code=404, detail=f"{model.__name__} no encontrado")
    return obj


def _actualizar_deuda(db: Session, turno_id: int, monto_pagado: Decimal) -> Optional[Deuda]:
    deuda = db.query(Deuda).filter(Deuda.turno_id == turno_id).first()
    if not deuda:
        return None
    deuda.monto_pagado    += monto_pagado
    deuda.saldo_pendiente  = max(Decimal("0"), deuda.monto_original - deuda.monto_pagado)
    if deuda.saldo_pendiente == 0:
        deuda.estado = "saldada"
    elif deuda.monto_pagado > 0:
        deuda.estado = "parcial"
    return deuda




#endpoints

@router.get("/", response_model=list[PagoResponse])
def listar_pagos(db: Session = Depends(get_db)):
    return db.query(Pago).all()


#REPORTES 

@router.get("/reporte/mes-actual")
def reporte_mes_actual(db: Session = Depends(get_db)):
    from app.models import Cliente
    hoy    = datetime.now()
    inicio = datetime(hoy.year, hoy.month, 1)

    cobrado = db.query(func.sum(Pago.monto)).filter(
        Pago.estado_pago == "pagado",
        Pago.fecha_pago  >= inicio,
        Pago.fecha_pago  <= hoy,
    ).scalar() or 0

    # Usar saldo_corriente
    adeudado = db.query(func.sum(Cliente.saldo_corriente)).filter(
        Cliente.activo         == True,
        Cliente.saldo_corriente > 0
    ).scalar() or 0

    adeudado = round(float(adeudado), 2)
    total    = float(cobrado) + adeudado

    return {
        "cobrado":      float(cobrado),
        "adeudado":     adeudado,
        "total":        total,
        "pct_cobrado":  round(float(cobrado) / total * 100, 1) if total > 0 else 0,
        "pct_adeudado": round(adeudado / total * 100, 1) if total > 0 else 0,
        "mes":          hoy.strftime("%B %Y"),
    }


@router.get("/reporte/meses")
def ingresos_por_mes(meses: int = 1, db: Session = Depends(get_db)):
    hoy = datetime.now()

    if meses == 12:
        inicio = datetime(hoy.year, 1, 1)
        meses_a_mostrar = 12
    else:
        inicio = datetime(hoy.year, hoy.month, 1)
        for _ in range(meses - 1):
            if inicio.month == 1:
                inicio = datetime(inicio.year - 1, 12, 1)
            else:
                inicio = datetime(inicio.year, inicio.month - 1, 1)
        meses_a_mostrar = meses

    nombres_meses = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]

    pagos = (
        db.query(
            func.extract("year",  Pago.fecha_pago).label("anio"),
            func.extract("month", Pago.fecha_pago).label("mes"),
            func.sum(Pago.monto).label("total")
        )
        .filter(Pago.estado_pago == "pagado")
        .filter(Pago.fecha_pago >= inicio)
        .group_by(
            func.extract("year",  Pago.fecha_pago),
            func.extract("month", Pago.fecha_pago)
        )
        .all()
    )

    resultado = []
    cursor = datetime(inicio.year, inicio.month, 1)

    for _ in range(meses_a_mostrar):
        es_futuro = cursor.year > hoy.year or (cursor.year == hoy.year and cursor.month > hoy.month)
        pago_mes  = next((p for p in pagos if int(p.anio) == cursor.year and int(p.mes) == cursor.month), None)
        resultado.append({
            "mes":       nombres_meses[cursor.month - 1],
            "anio":      cursor.year,
            "total":     float(pago_mes.total) if pago_mes and not es_futuro else 0,
            "es_futuro": es_futuro,
        })
        if cursor.month == 12:
            cursor = datetime(cursor.year + 1, 1, 1)
        else:
            cursor = datetime(cursor.year, cursor.month + 1, 1)

    return resultado


@router.get("/reporte/semana")
def ingresos_por_semana(fecha_inicio: str, db: Session = Depends(get_db)):
    try:
        inicio = datetime.strptime(fecha_inicio, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido. Usar YYYY-MM-DD")

    fin = inicio + timedelta(days=6)

    pagos = (
        db.query(
            func.date(Pago.fecha_pago).label("dia"),
            func.sum(Pago.monto).label("total")
        )
        .filter(Pago.estado_pago == "pagado")
        .filter(Pago.fecha_pago >= inicio)
        .filter(Pago.fecha_pago <= fin.replace(hour=23, minute=59, second=59))
        .group_by(func.date(Pago.fecha_pago))
        .all()
    )

    nombres = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
    resultado = []
    for i in range(7):
        dia     = inicio + timedelta(days=i)
        dia_str = dia.strftime("%Y-%m-%d")
        pago_dia = next((p for p in pagos if str(p.dia) == dia_str), None)
        resultado.append({
            "dia":   nombres[i],
            "fecha": dia_str,
            "total": float(pago_dia.total) if pago_dia else 0,
        })

    return resultado


@router.get("/reporte/metodos-pago")
def reporte_metodos_pago(mes: int, anio: int, db: Session = Depends(get_db)):
    inicio = datetime(anio, mes, 1)
    if mes == 12:
        fin = datetime(anio + 1, 1, 1)
    else:
        fin = datetime(anio, mes + 1, 1)

    pagos = (
        db.query(
            Pago.metodo_pago,
            func.sum(Pago.monto).label("total")
        )
        .filter(Pago.estado_pago == "pagado")
        .filter(Pago.fecha_pago >= inicio)
        .filter(Pago.fecha_pago < fin)
        .group_by(Pago.metodo_pago)
        .all()
    )

    return [{"metodo": p.metodo_pago, "total": float(p.total)} for p in pagos]

#CRUD por ID

@router.get("/{pago_id}", response_model=PagoResponse)
def obtener_pago(pago_id: int, db: Session = Depends(get_db)):
    return _get_or_404(db, Pago, Pago.pago_id, pago_id)


@router.post("/", response_model=PagoResponse, status_code=201)
def crear_pago(pago_in: PagoCreate, db: Session = Depends(get_db)):
    if pago_in.turno_id:
        turno = _get_or_404(db, Turno, Turno.turno_id, pago_in.turno_id)
        if not pago_in.cliente_id:
            pago_in.cliente_id = turno.cliente_id

    if pago_in.cliente_id:
        _get_or_404(db, Cliente, Cliente.id, pago_in.cliente_id)

    pago = Pago(**pago_in.dict())
    db.add(pago)

    # Actualizar saldo_corriente — restar lo que pagó
    if pago_in.tipo_pago not in ["propina", "recargo"] and pago_in.cliente_id:
        cliente = db.query(Cliente).filter(Cliente.id == pago_in.cliente_id).first()
        if cliente:
            cliente.saldo_corriente -= pago_in.monto

    db.commit()
    db.refresh(pago)
    return pago


@router.patch("/{pago_id}/cancelar", response_model=PagoResponse)
def cancelar_pago(pago_id: int, db: Session = Depends(get_db)):
    pago = _get_or_404(db, Pago, Pago.pago_id, pago_id)

    if pago.estado_pago == "cancelado":
        raise HTTPException(status_code=400, detail="El pago ya está cancelado")

    pago.estado_pago = "cancelado"

    # Revertir saldo_corriente
    if pago.tipo_pago not in ["propina", "recargo"] and pago.cliente_id:
        cliente = db.query(Cliente).filter(Cliente.id == pago.cliente_id).first()
        if cliente:
            cliente.saldo_corriente += pago.monto

    if pago.turno_id:
        deuda = db.query(Deuda).filter(Deuda.turno_id == pago.turno_id).first()
        if deuda:
            deuda.monto_pagado    = max(Decimal("0"), deuda.monto_pagado - pago.monto)
            deuda.saldo_pendiente = deuda.monto_original - deuda.monto_pagado
            deuda.estado          = "pendiente" if deuda.monto_pagado == 0 else "parcial"

            turno = db.query(Turno).filter(Turno.turno_id == pago.turno_id).first()
            if turno and turno.estado == "completado":
                turno.estado = "asistido"

    db.commit()
    db.refresh(pago)
    return pago