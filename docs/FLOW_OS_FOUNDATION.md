# Flow OS Foundation

## Objetivo

Flow OS no debe nacer como un HIS gigante ni como un "Windows de pacientes".
Debe nacer como la **capa operativa del recorrido del paciente** para una clinica
concreta.

La promesa del producto queda definida asi:

> Flow OS coordina lo que debe pasar antes, durante y despues de la atencion para
> que el paciente no se pierda y el equipo no duplique trabajo.

## Principios canonicos

1. **Una clinica, una frontera de confianza.**
    - Cada clinica tiene su propio OpenClaw/runtime.
    - Cada clinica tiene sus credenciales, sesiones, storage y datos.
    - El codigo puede compartirse; los datos y secretos no.
2. **Un flujo cerrado antes que diez modulos sueltos.**
    - Registro -> preconsulta -> agenda -> atencion -> seguimiento.
3. **IA como orquestacion, no como sustituto del criterio clinico.**
    - GPT-5.4 para decisiones complejas, ambiguedad y supervisión.
    - GPT-5.4-mini para tareas repetitivas y subagentes operativos.
4. **Estados canonicos del paciente.**
    - Cada paciente/episodio debe estar en un estado claro.
    - Cada estado debe tener siguientes acciones definidas.
5. **El MVP se mide por continuidad asistencial.**
    - menos llamadas manuales
    - menos no-shows
    - mas controles completados
    - mejor tiempo de preparacion de consulta

## Alcance inicial recomendado

El alcance inicial debe ser una sola superficie operativa:

- clinica dermatologica
- consulta ambulatoria
- seguimiento por fotos/documentos
- citas/control
- postconsulta automatizada

No incluir de inicio:

- facturacion completa multi-sucursal
- farmacia
- laboratorio integral
- hospitalizacion
- IA diagnostica autonoma
- multi-especialidad compleja

## Modelo operativo

### Entidades nucleares

- **Clinic**: unidad aislada de operacion.
- **Patient**: identidad longitudinal.
- **Care Episode**: problema actual o motivo de consulta.
- **Journey Stage**: estado operativo del episodio.
- **Task**: accion pendiente para humano, sistema o agente.
- **Signal**: evento que cambia el estado del episodio.

### Estados canonicos del Journey

1. `lead_captured`
2. `registered`
3. `intake_pending`
4. `intake_completed`
5. `triaged`
6. `scheduled`
7. `checked_in`
8. `in_consultation`
9. `care_plan_ready`
10. `follow_up_active`
11. `resolved`
12. `dropped`

Cada estado debe responder tres preguntas:

- que ya ocurrio
- que falta por hacer
- quien es el actor responsable

## OpenClaw dentro de Flow OS

OpenClaw no es el producto; es el **runtime de orquestacion** por clinica.

### Rol del orquestador principal

El agente principal por clinica debe:

- leer el estado del episodio
- decidir la siguiente mejor accion
- delegar tareas acotadas a subagentes
- resumir resultados
- nunca mezclar datos entre clinicas

### Subagentes recomendados

- `intake-triage-worker`
- `appointment-worker`
- `followup-worker`
- `documentation-worker`
- `ops-audit-worker`

### Regla de delegacion

Se delega cuando la tarea es:

- repetitiva
- de alcance acotado
- con output verificable
- sin riesgo de alterar criterio clinico por si sola

No se delega solo por moda.

## Arquitectura recomendada

### Compartido

- codigo
- componentes UI
- contratos API
- manifest de estados y reglas
- tests y tooling

### Aislado por clinica

- base de datos
- storage de archivos
- sesiones OpenClaw
- credenciales OpenAI/OpenClaw
- logs y auditoria
- configuracion local

## MVP serio

Flow OS es serio cuando una clinica puede usarlo todos los dias para:

1. captar un paciente
2. completar preconsulta
3. agendar
4. atender
5. dejar plan
6. abrir seguimiento
7. cerrar o reactivar episodio

## Orden sugerido de construccion

### Fase 1

- manifest de estados
- modelo de episodio
- regla de siguientes acciones
- panel minimo de journey

### Fase 2

- orquestacion OpenClaw por clinica
- subagentes de intake y seguimiento
- timeline de señales

### Fase 3

- multi-clinica con aislamiento fuerte
- metricas operativas
- auditoria y observabilidad

## Fuente canonica en este repo

La fuente de verdad inicial para este frente queda en:

- `data/flow-os/manifest.v1.json`
- `src/domain/flow-os/patient-journey.js`
- `docs/FLOW_OS_FOUNDATION.md`
- `docs/FLOW_OS_ORCHESTRATION.md`
