# FlowOS HCE Compliance Matrix

## Objetivo
Convertir los requisitos regulatorios y operativos del producto en una matriz accionable para desarrollo.

## Leyenda de prioridad
- **P0**: obligatorio para una primera version comercial seria.
- **P1**: muy importante para escalamiento y adopcion institucional.
- **P2**: posterior a MVP comercial.

| Requisito | Requisito funcional | Modulo FlowOS | Prioridad | Evidencia esperada |
|---|---|---|---|---|
| Historia clinica unica longitudinal | Un expediente por paciente con episodios vinculados | HCU Core | P0 | ID unico de historia, episodios, persistencia longitudinal |
| Captura conversacional con salida estructurada | Chat/dictado libre convertido en nota clinica formal | Conversational Capture | P0 | Vista conversacion + nota estructurada |
| Formularios clinicos versionados | Plantillas por tipo de atencion y version normativa | Form Engine | P0 | Motor de formularios y versionado |
| Consulta externa / anamnesis / examen | Estructura completa para atencion ambulatoria | HCU Core | P0 | Plantilla de consulta externa lista |
| Evolucion clinica | Registro de cambios y controles posteriores | HCU Core | P0 | Nota de evolucion versionada |
| Plan, indicaciones y cierre | Cierre del episodio con resumen y proxima accion | Episode & Follow-up | P0 | Resumen final y estado del episodio |
| Consentimiento informado | Registro de aceptacion, negativa y revocatoria | Consent Manager | P0 | Documento vinculado al episodio |
| Autoridad humana final | Validacion clinica obligatoria antes de cerrar | Compliance Engine | P0 | Accion explicita de validacion profesional |
| Trazabilidad de IA | Registrar sugerencias, aceptacion y rechazo | AI Governance | P0 | Log de sugerencias IA |
| Trazabilidad de acceso y cambios | Saber quien vio, edito, exporto e imprimio | Audit & Privacy | P0 | Audit trail por evento |
| Control de acceso por roles | Permisos segun usuario y funcion | Security Layer | P0 | Matriz de roles y permisos |
| Archivo y custodia | Politicas de historia activa/inactiva y resguardo | Privacy & Records | P0 | Estado documental y politicas de archivo |
| Proteccion de datos sensibles | Gobierno de datos de salud y control de uso | Data Governance | P0 | Politica y registro de tratamiento |
| Validacion de completitud | Bloquear cierres con datos minimos faltantes | Compliance Engine | P0 | Lista de errores de cierre |
| Banderas rojas y faltantes clinicos | Detectar huecos relevantes durante la captura | Clinical Guidance | P1 | Panel de faltantes y alertas |
| Sugerencia de diferenciales | Apoyo clinico estructurado, no diagnostico automatico | Clinical Guidance | P1 | Lista de diferenciales revisable |
| Versionado de reglas clinicas | Reglas atadas a guias y fuentes configurables | Clinical Rules & Guidance | P1 | Version y fuente de regla visible |
| Exportacion estructurada | Exportar historia y episodio de forma ordenada | Interoperability Hub | P1 | Export JSON/PDF/documental |
| Integracion futura HL7/FHIR | Preparacion para interoperabilidad progresiva | Interoperability Hub | P1 | Esquema de recursos y mapeos |
| Flujos especiales VBG / grupos prioritarios | Rutas especificas con privacidad reforzada | Priority Care Pathways | P1 | Plantillas y acceso restringido |
| Firma / validacion fuerte para cierre | Cierre con evidencia del profesional responsable | Security Layer | P1 | Firma o accion fuerte registrada |
| Analitica operativa clinica | Medir seguimiento, cierres y continuidad | Episode & Follow-up | P2 | KPIs de uso y continuidad |

## Reglas de interpretacion

### Regla 1
Ningun modulo conversacional puede reemplazar el documento clinico final persistido.

### Regla 2
Toda sugerencia automatica debe quedar separada de la autoridad final del profesional.

### Regla 3
No se debe abrir comercializacion seria sin cubrir todos los puntos P0.

### Regla 4
Los puntos P1 deben quedar disenados desde el inicio aunque no todos se implementen en la primera entrega.

## Orden recomendado de implementacion
1. HCU Core
2. Conversational Capture
3. Compliance Engine
4. Audit & Privacy
5. Consent Manager
6. Episode & Follow-up
7. Clinical Guidance
8. Interoperability Hub

## Uso de esta matriz
Esta matriz debe servir como base para:
- priorizar tareas;
- abrir paquetes de trabajo para Codex;
- revisar brechas antes de vender;
- mapear evidencia de cumplimiento del producto.
