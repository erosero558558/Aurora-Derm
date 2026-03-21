# FlowOS HCE Ecuador Foundation

## Proposito
Definir la base funcional y normativa para evolucionar FlowOS hacia una **Historia Clinica Conversacional** comercializable en Ecuador.

## Tesis del producto
FlowOS HCE Ecuador **no** es un chat medico aislado.
Es un sistema de **Historia Clinica Unica** con una interfaz conversacional de captura.

Principio rector:

**entrada libre, salida normativa**

Esto significa:
- el profesional puede escribir o dictar el caso en lenguaje natural;
- el sistema transforma esa captura en una estructura clinica formal;
- el cierre final sigue siendo responsabilidad del profesional;
- ninguna atencion puede cerrarse sin cumplir campos, validaciones y trazabilidad requeridos.

## Objetivo de negocio
Construir una historia clinica que:
- agilice el trabajo medico;
- reduzca friccion documental;
- mantenga cumplimiento documental y medico-legal;
- sea defendible para comercializacion en Ecuador.

## Objetivo funcional
Permitir que el medico trabaje como conversa hoy, pero convertir esa interaccion en:
- anamnesis estructurada;
- examen fisico estructurado;
- impresion diagnostica;
- plan e indicaciones;
- seguimiento;
- evidencia auditable.

## Principios de diseno

### 1. Conversacion como interfaz, no como documento final
La conversacion es la entrada primaria.
La historia clinica final es el documento medico-legal persistido.

### 2. Autoridad humana final
La IA puede resumir, ordenar, detectar faltantes y sugerir.
La aprobacion final siempre corresponde al profesional responsable.

### 3. Cumplimiento por diseno
El sistema debe impedir cierres incompletos cuando falten campos, consentimientos, validaciones o evidencia minima.

### 4. Trazabilidad total
Toda sugerencia, edicion, aceptacion, rechazo, firma y exportacion debe dejar huella.

### 5. Modularidad progresiva
La primera ola debe enfocarse en consulta externa y episodio ambulatorio.
Las integraciones, especialidades y caminos complejos vienen despues.

## Definicion del producto
FlowOS HCE Ecuador debe entenderse como la union de 6 capas:

1. **HCU Core**
   - expediente longitudinal del paciente
   - episodios y atenciones
   - formularios clinicos versionados

2. **Conversational Capture**
   - chat o dictado libre
   - extraccion a campos estructurados
   - borrador clinico revisable

3. **Compliance Engine**
   - validacion de campos obligatorios
   - control de consentimiento
   - reglas de cierre
   - alertas de incompletitud

4. **Audit & Privacy**
   - bitacora de acceso
   - bitacora de cambios
   - trazabilidad de sugerencias IA
   - control de exportaciones

5. **Clinical Guidance**
   - sugerencias de diferenciales
   - datos faltantes
   - red flags
   - reglas configurables segun guias oficiales

6. **Episode & Follow-up**
   - estado del episodio
   - siguiente accion
   - tareas y seguimiento
   - continuidad asistencial

## Alcance inicial recomendado
La primera version comercial defendible debe cubrir:
- identificacion/admision del paciente;
- consulta externa;
- anamnesis y examen fisico;
- evolucion;
- indicaciones y plan;
- consentimiento informado cuando aplique;
- cierre de episodio;
- auditoria basica;
- historia clinica conversacional.

## No alcance inicial
No abrir en esta etapa:
- hospitalizacion completa;
- quirurgico complejo;
- interoperabilidad nacional completa;
- facturacion compleja;
- analitica avanzada;
- automatizaciones de gran escala.

## Guardrails del sistema

### Prohibido
- cerrar automaticamente una historia clinica sin validacion humana;
- emitir diagnostico final sin revision del profesional;
- borrar trazabilidad de sugerencias IA;
- permitir accesos amplios sin rol;
- usar el chat como unico respaldo documental.

### Obligatorio
- guardar la nota final estructurada;
- guardar el estado del episodio;
- guardar que partes fueron generadas por IA;
- guardar quien valido y cuando;
- bloquear el cierre cuando falten minimos requeridos.

## Forma correcta de vender el producto
No venderlo como "chat medico".
Venderlo como:

**Historia Clinica Conversacional con salida normativa ecuatoriana.**

## Resultado esperado de esta linea
Un sistema donde el medico trabaja rapido, pero el producto garantiza:
- estructura formal;
- consistencia documental;
- continuidad del episodio;
- cumplimiento por diseno;
- trazabilidad medico-legal.
