ALTER TABLE turno DROP CONSTRAINT IF EXISTS ck_turno_estado;
ALTER TABLE turno ADD CONSTRAINT ck_turno_estado 
CHECK (estado IN ('reservado', 'confirmado', 'asistido', 'completado', 'cancelado', 'ausente'));

ALTER TABLE pago DROP CONSTRAINT IF EXISTS ck_pago_tipo;
ALTER TABLE pago ADD CONSTRAINT ck_pago_tipo 
CHECK (tipo_pago IN ('senia', 'parcial', 'total', 'saldo_favor', 'recargo', 'propina'));