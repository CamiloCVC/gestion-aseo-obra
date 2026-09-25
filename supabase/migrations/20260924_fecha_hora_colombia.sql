-- Corrige órdenes creadas ANTES del deploy del fix de zona horaria (b2c8990).
-- Antes, el formulario mandaba la hora digitada sin zona y Postgres la guardó como UTC
-- (16:25 digitado en Colombia quedó 16:25+00). Ahora se guarda con -05:00, así que a las
-- órdenes viejas hay que sumarles 5 horas para que representen el instante real.
--
-- CORRER UNA SOLA VEZ. El corte por created_at deja intactas las órdenes creadas con el
-- código nuevo. Revisa a mano las creadas justo alrededor del corte.

update ordenes
set fecha_hora = fecha_hora + interval '5 hours'
where created_at < '2026-09-25 04:14:05+00';
