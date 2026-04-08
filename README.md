# Sistema de Procesamiento de Facturas Electrónicas (Costa Rica) 🇨🇷

Este proyecto es una herramienta automatizada construida con **Node.js** para descargar, clasificar y respaldar facturas electrónicas directamente desde una cuenta de correo electrónico (Gmail) utilizando el protocolo **IMAP**.

## 🚀 Características

- **Descarga Automática:** Extrae archivos XML y PDF de los correos recibidos en un mes específico.
- **Clasificación Inteligente:** Organiza las facturas en carpetas por Categoría (Compras, Gastos, Comisión x Venta) y por Proveedor (Cédula y Nombre).
- **Validación de Duplicados:** Evita procesar la misma factura varias veces mediante un índice de claves de comprobantes.
- **Panel de Control (Dashboard):** Interfaz web sencilla para gestionar múltiples cuentas de correo y disparar procesos de descarga.
- **Gestión de Proveedores:** Registra automáticamente nuevos emisores en un archivo CSV para su posterior clasificación contable.

## 🛠️ Requisitos Previos

- [Node.js](https://nodejs.org/) (Versión 18 o superior recomendada).
- Una cuenta de Gmail con **Contraseña de Aplicación** activada (debido a las políticas de seguridad de Google).

## 📦 Instalación

1. Clona este repositorio o descarga los archivos.
2. Abre una terminal en la carpeta del proyecto y ejecuta:
   ```powershell
   npm install
   ```

## ⚙️ Configuración Segura

Por motivos de seguridad, los datos sensibles **no se suben a GitHub** (están protegidos por `.gitignore`). Debes crear los siguientes archivos localmente:

### 1. Archivo `imap.txt`
Crea un archivo llamado `imap.txt` en la raíz del proyecto con el siguiente formato (una línea por cuenta):
```text
tu_correo@gmail.com,tu_contraseña_de_aplicacion,mes_por_defecto
```
*Ejemplo: `compras@gmail.com,abcd efgh ijkl mnop,01`*

## 🖥️ Uso

### Iniciar el Dashboard Web
Para usar la interfaz gráfica:
```powershell
node dashboardServer.js
```
Luego abre tu navegador en: `http://localhost:3000`

### Ejecutar por Línea de Comandos
Si prefieres ejecutar el script de procesamiento directamente:
```powershell
node facturasFinal.js "usuario" "password" "mes"
```

## 📂 Estructura de Archivos Generada

Las facturas se organizan automáticamente de la siguiente forma:
`Facturas / [Correo] / [Año] / [Mes] / [TipoContable] / [Proveedor] / [TipoDocumento] / [XML o PDF]`

## 🔒 Seguridad y Privacidad

Este proyecto está configurado para **ignorar** las carpetas de datos reales (`Facturas/`, `proveedores.csv`, `imap.txt`) mediante Git. Solo se respalda el código fuente, protegiendo la información sensible de tus proveedores y clientes.

---
Desarrollado para la gestión eficiente de comprobantes electrónicos.
