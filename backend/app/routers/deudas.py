from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from decimal import Decimal
from typing import Optional
from app.database import get_db
from app.models import Deuda, Cliente, Turno, Pago, Servicio
from app.schemas import DeudaCreate, DeudaPagoCreate, DeudaResponse, ResumenDeudaCliente

router = APIRouter(prefix="/deudas", tags=["Deudas"])


def _get_or_404(db: Session, model, id_field, id_value):
    obj = db.query(model).filter(id_field == id_value).first()
    if not obj:
        raise HTTPException(status_code=404, detail=f"{model.__name__} no encontrado")
    return obj


@router.get("/", response_model=list[DeudaResponse])
def listar_deudas(estado: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Deuda)
    if estado:
        if estado not in ("pendiente", "parcial", "saldada"):
            raise HTTPException(status_code=400, detail="Estado inválido")
        query = query.filter(Deuda.estado == estado)
    return query.order_by(Deuda.fecha_generacion.desc()).all()


@router.get("/detalle/")
def listar_deudas_detalle(estado: Optional[str] = None, db: Session = Depends(get_db)):
    query = (
        db.query(Deuda)
        .join(Turno,    Deuda.turno_id    == Turno.turno_id)
        .join(Cliente,  Deuda.cliente_id  == Cliente.id)
        .join(Servicio, Turno.servicio_id == Servicio.id)
    )
    if estado:
        if estado not in ("pendiente", "parcial", "saldada"):
            raise HTTPException(status_code=400, detail="Estado inválido")
        query = query.filter(Deuda.estado == estado)

    deudas = query.order_by(Deuda.fecha_generacion.desc()).all()

    return [
        {
            "deuda_id":        d.deuda_id,
            "cliente_id":      d.cliente_id,
            "turno_id":        d.turno_id,
            "monto_original":  float(d.monto_original),
            "monto_pagado":    float(d.monto_pagado),
            "saldo_pendiente": float(d.saldo_pendiente),
            "estado":          d.estado,
            "cliente_nombre":  d.turno.cliente.nombre,
            "cliente_celular": d.turno.cliente.celular,
            "servicio_nombre": d.turno.servicio.nombre,
            "fecha_turno":     d.turno.fecha_hora_inicio.isoformat(),
        }
        for d in deudas
    ]


@router.post("/", response_model=DeudaResponse, status_code=201)
def crear_deuda(deuda_in: DeudaCreate, db: Session = Depends(get_db)):
    _get_or_404(db, Cliente, Cliente.id, deuda_in.cliente_id)
    _get_or_404(db, Turno,   Turno.turno_id, deuda_in.turno_id)

    existente = db.query(Deuda).filter(Deuda.turno_id == deuda_in.turno_id).first()
    if existente:
        raise HTTPException(status_code=400, detail="Ya existe una deuda para este turno")

    deuda = Deuda(
        cliente_id        = deuda_in.cliente_id,
        turno_id          = deuda_in.turno_id,
        monto_original    = deuda_in.monto_original,
        monto_pagado      = Decimal("0"),
        saldo_pendiente   = deuda_in.monto_original,
        estado            = "pendiente",
        fecha_vencimiento = deuda_in.fecha_vencimiento,
        observacion       = deuda_in.observacion,
    )
    db.add(deuda)
    db.commit()
    db.refresh(deuda)
    return deuda


@router.post("/{deuda_id}/pagar", response_model=DeudaResponse)
def pagar_deuda(deuda_id: int, pago_in: DeudaPagoCreate, db: Session = Depends(get_db)):
    deuda   = _get_or_404(db, Deuda,   Deuda.deuda_id, deuda_id)
    cliente = _get_or_404(db, Cliente, Cliente.id,      deuda.cliente_id)

    if deuda.estado == "saldada":
        raise HTTPException(status_code=400, detail="Esta deuda ya está saldada")

    monto_a_pagar   = min(Decimal(str(pago_in.monto)), deuda.saldo_pendiente)
    monto_excedente = Decimal(str(pago_in.monto)) - deuda.saldo_pendiente
    if monto_excedente < 0:
        monto_excedente = Decimal("0")

    # Actualizar deuda
    deuda.monto_pagado    += monto_a_pagar
    deuda.saldo_pendiente  = deuda.saldo_pendiente - monto_a_pagar

    if deuda.saldo_pendiente == 0:
        deuda.estado = "saldada"
    else:
        deuda.estado = "parcial"

    # Pago principal
    pago_principal = Pago(
        turno_id    = deuda.turno_id,
        cliente_id  = deuda.cliente_id,
        monto       = monto_a_pagar,
        metodo_pago = pago_in.metodo_pago,
        tipo_pago   = "parcial" if deuda.saldo_pendiente > 0 else "total",
        estado_pago = "pagado",
        observacion = pago_in.observacion,
    )
    db.add(pago_principal)
    cliente.saldo_corriente -= monto_a_pagar

    # Excedente — puede ser saldo_favor o recargo
    
    if monto_excedente > 0:
        if pago_in.con_recargo:
            # Es un recargo por mora — no reduce saldo_corriente futuro
            tipo = "recargo"
            actualizar_saldo = False
        else:
            # Es un excedente real — queda a favor del cliente
            tipo = "saldo_favor"
            actualizar_saldo = True

        pago_excedente = Pago(
            turno_id    = deuda.turno_id,
            cliente_id  = deuda.cliente_id,
            monto       = monto_excedente,
            metodo_pago = pago_in.metodo_pago,
            tipo_pago   = tipo,
            estado_pago = "pagado",
            observacion = "Recargo por mora" if pago_in.con_recargo else "Saldo a favor por excedente",
        )
        db.add(pago_excedente)
        if actualizar_saldo:
            cliente.saldo_corriente -= monto_excedente
    db.commit()
    db.refresh(deuda)
    return deuda

@router.get("/{deuda_id}", response_model=DeudaResponse)
def obtener_deuda(deuda_id: int, db: Session = Depends(get_db)):
    return _get_or_404(db, Deuda, Deuda.deuda_id, deuda_id)


@router.get("/cliente/{cliente_id}", response_model=list[DeudaResponse])
def deudas_por_cliente(
    cliente_id:      int,
    solo_pendientes: bool = True,
    db: Session = Depends(get_db)
):
    _get_or_404(db, Cliente, Cliente.id, cliente_id)
    query = db.query(Deuda).filter(Deuda.cliente_id == cliente_id)
    if solo_pendientes:
        query = query.filter(Deuda.estado != "saldada")
    return query.order_by(Deuda.fecha_generacion.desc()).all()


@router.get("/cliente/{cliente_id}/resumen", response_model=ResumenDeudaCliente)
def resumen_cliente(cliente_id: int, db: Session = Depends(get_db)):
    cliente = _get_or_404(db, Cliente, Cliente.id, cliente_id)

    deudas_activas = (
        db.query(Deuda)
        .filter(Deuda.cliente_id == cliente_id)
        .filter(Deuda.estado     != "saldada")
        .order_by(Deuda.fecha_generacion.desc())
        .all()
    )

    total_adeudado = sum(d.saldo_pendiente for d in deudas_activas)

    return ResumenDeudaCliente(
        cliente_id        = cliente.id,
        nombre            = cliente.nombre,
        saldo_favor       = cliente.saldo_corriente,
        total_adeudado    = Decimal(str(total_adeudado)),
        deudas_pendientes = deudas_activas,
    )