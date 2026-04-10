# CLAUDE.md — facturasMes

## Idioma
Responde siempre en **español**. Si usas términos técnicos en inglés, incluye la traducción o explicación entre paréntesis.
Antes de proponer un comando para ejecutar, explica qué va a hacer ese comando.

---

## Descripción del Proyecto
Sistema **multicuenta** en Node.js para descargar, clasificar y respaldar facturas electrónicas (XML y PDF) desde cuentas Gmail vía protocolo IMAP. Cumple con los estándares del Ministerio de Hacienda de Costa Rica.

---

## Comandos del Proyecto

```bash
# Iniciar el dashboard web (interfaz en http://localhost:3000)
node dashboardServer.js

# Ejecutar descarga directamente por línea de comandos
node facturasFinal.js "correo@gmail.com" "contraseña_de_aplicacion" "01"

# Normalizar (reparar codificación y pasar a mayúsculas) el CSV de proveedores
node normalizar_csv.js

# Respaldar el proyecto en GitHub (con mensaje opcional)
npm run subir
# o con mensaje personalizado:
node subirProyecto.js "mi mensaje de commit"

# Ejecutar prueba de lógica de proveedores
node test_logica.js
```

---

## Stack Tecnológico
| Librería | Uso |
|---|---|
| `imap` | Conexión IMAP con Gmail (puerto 993, TLS) |
| `mailparser` | Parsear correos y extraer adjuntos |
| `xml2js` | Convertir XML de Hacienda en objetos JS |
| `iconv-lite` | Reparar caracteres mal codificados (Ã, Â, tildes, ñ) |
| `moment` | Manejo de fechas y periodos fiscales |
| `express` + `cors` | Servidor HTTP del dashboard en puerto 3000 |
| `fs-extra` | Operaciones de archivos con `ensureDirSync` |
| `xlsx` | (Disponible, no activo aún) |

---

## Archivos del Proyecto
| Archivo | Función |
|---|---|
| `facturasFinal.js` | Motor principal: descarga, valida duplicados, organiza archivos |
| `dashboardServer.js` | Servidor Express del panel de control web multicuenta |
| `proveedoresCSV.js` | Módulo CRUD para el CSV de proveedores (registrar/actualizar) |
| `normalizar_csv.js` | Script utilitario para reparar codificación en CSVs existentes |
| `subirProyecto.js` | Automatización de `git add + commit + push` a GitHub |
| `test_logica.js` | Prueba manual de la lógica de `proveedoresCSV.js` |
| `public/index.html` | Frontend SPA del dashboard (Inicio / Sistema / Proveedores) |
| `imap.txt` | Credenciales IMAP, una línea por cuenta: `correo,contraseña,mes` |
| `proveedores.csv` | Clasificación contable de emisores (ignorado por git) |
| `tiposComprobantes.json` | Registro auto-actualizado de tipos de XML encontrados |
| `tiposXMLxSubir.json` | Lista de tipos de XML que se copian a la carpeta contable |

---

## API del Dashboard (`dashboardServer.js`)
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/config` | Devuelve las cuentas de `imap.txt` y el año actual |
| `POST` | `/api/descargar` | Lanza `facturasFinal.js` con streaming chunked de logs |
| `GET` | `/api/proveedores/:email` | Lee el CSV de proveedores de una cuenta |
| `POST` | `/api/proveedores/:email` | Guarda el CSV de proveedores de una cuenta |

**Nota importante:** El dashboard usa `Transfer-Encoding: chunked` para transmitir los logs en tiempo real al navegador. El frontend parsea el patrón `[X/Y]` en los logs para actualizar la barra de progreso.

---

## Estructura de Carpetas Generada

```
Facturas/
  [correo@gmail.com]/
    proveedores.csv          ← clasificación contable por cuenta
    tiposComprobantes.json
    tiposXMLxSubir.json
    [año]/
      [mes]/
        Compras/             ← proveedores con Contable = "c"
          [PROVEEDOR_cedula-correoOrigen]/
            [TipoDocumento]/
              XML/
              PDF/
        Gastos/              ← proveedores con Contable = "g"
        Comisión x Venta/    ← proveedores con Contable = "cv"
        SinClasificar/       ← proveedores sin letra asignada
        XML-ContableSinAsignar/  ← copia contable de SinClasificar
        Adjuntos/
          [N° - correoOrigen - fecha]/  ← respaldo original
          log.txt            ← resumen completo del proceso
```

---

## Tipos de Documentos Reconocidos
Definidos en `tiposComprobantes.json` (se auto-actualizan al encontrar nuevos tipos):
- `FacturaElectronica`
- `TiqueteElectronico`
- `NotaCreditoElectronica`
- `NotaDebitoElectronica`
- `ReciboElectronicoPago`
- `MensajeHacienda` — respuesta de Hacienda, se identifica pero **no** se guarda como factura

Los tipos configurados en `tiposXMLxSubir.json` (por defecto: Factura, NotaCredito, Recibo) son los que generan una **copia contable** adicional en la carpeta `[TipoContable]/XML`.

---

## Reglas de Negocio Críticas
1. **Clave única de 50 dígitos:** identifica cada comprobante. Se usa `XML_PROCESADOS` (Map) para evitar duplicados en tiempo de ejecución y `cargarHistorial()` para cargar claves previas desde disco al arrancar.
2. **Nombres en MAYÚSCULAS:** `Nombre` y `NombreComercial` del proveedor siempre se transforman a mayúsculas. La función `repararTexto()` corrige primero errores de codificación (Ã → Á, etc.).
3. **Clasificación contable respetada:** `proveedoresCSV.js` nunca sobreescribe la columna `Contable` al actualizar un proveedor existente.
4. **Actualización de contacto:** Si el proveedor ya existe, se actualizan `Correo` y `Telefono` con los datos del XML más reciente.
5. **Carpeta Adjuntos:** Todos los adjuntos de cada correo (incluso los no clasificados) se guardan en `Adjuntos/` como respaldo original, numerados por orden de llegada.

---

## Advertencia: Inconsistencia de Rutas
`facturasFinal.js` usa `./Facturas/${user}` (F **mayúscula**).
`dashboardServer.js` usa `./facturas/${email}` (f **minúscula**) para leer/escribir proveedores.
En Windows esto funciona porque el sistema de archivos no distingue mayúsculas, pero podría ser un problema en Linux/Mac. Revisar si se quiere unificar la ruta.

---

## Formato del archivo `imap.txt`
```
correo1@gmail.com,contraseña_de_aplicacion,01
correo2@gmail.com,contraseña_de_aplicacion,03
```
- Campo 1: correo Gmail
- Campo 2: contraseña de aplicación (Google App Password — no es la contraseña normal)
- Campo 3: mes por defecto para pre-llenar el dashboard

---

## Archivos Ignorados por Git (Sensibles / Locales)
- `imap.txt` — credenciales de correo
- `proveedores.csv` — datos de emisores
- `Facturas/` y `facturas/` — documentos descargados
- `tiposComprobantes.json`, `tiposXMLxSubir.json`
- `node_modules/`, `*.log`
