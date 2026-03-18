# Flow OS Orchestration

## Resumen

Flow OS necesita dos capas separadas:

- **Journey brain**: decide en que estado esta el episodio y que debe pasar.
- **Worker runtime**: ejecuta tareas acotadas.

OpenClaw entra en la segunda capa como runtime por clinica.

## Topologia minima por clinica

- `clinic-orchestrator`
- `intake-triage-worker`
- `appointment-worker`
- `followup-worker`
- `documentation-worker`

## Regla general

El orquestador principal:

1. recibe una senal
2. carga el episodio
3. calcula siguiente accion canonica
4. decide si la accion requiere subagente
5. recibe output resumido
6. actualiza estado y tareas

## Senales de entrada

- paciente se registra
- paciente sube fotos/documentos
- preconsulta finalizada
- agenda confirmada
- consulta cerrada
- mensaje de seguimiento recibido
- paciente no responde
- paciente empeora o requiere escalamiento

## Outputs esperados

Cada corrida del orquestador debe producir:

- `journey_stage`
- `next_actions[]`
- `owner`
- `delegation_plan[]`
- `alerts[]`

## GPT-5.4 vs GPT-5.4-mini

### GPT-5.4

Usar para:

- orquestacion principal
- decisiones ambiguas
- resolucion de conflicto entre senales
- revision final de resumenes delicados

### GPT-5.4-mini

Usar para:

- clasificar formularios
- resumir intake
- recordar seguimiento
- redactar mensajes operativos
- generar checklist por estado

## Patrón de seguridad

Una clinica no comparte:

- sesiones
- prompts con datos del paciente
- storage
- secretos
- memoria operativa

## Heuristica de delegacion

Delegar solo si la tarea cumple al menos 3 de 4 criterios:

- alcance acotado
- formato de salida definido
- poco riesgo clinico
- facil de verificar

## Heuristica de bloqueo

No avanzar automaticamente si ocurre cualquiera de estos casos:

- datos basicos incompletos
- alerta roja o emergencia
- inconsistencia entre senales
- necesidad de validacion humana explicita

## Primer tablero recomendado

El primer tablero operativo debe mostrar:

- paciente
- episodio actual
- estado actual
- proxima accion
- owner actual
- ultima senal
- riesgo operativo
