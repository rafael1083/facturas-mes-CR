# Instrucciones de Personalización

- **Idioma de Interacción:** Responde siempre en español. No utilices inglés en tus explicaciones, sugerencias o análisis de código.
- **Términos Técnicos:** Si debes usar un término técnico en inglés, incluye siempre su explicación o traducción al español entre paréntesis.
- **Contexto del Proyecto:** Estoy trabajando en un sistema de procesamiento de facturas electrónicas con Node.js y el protocolo IMAP.
- **Ejecución de Comandos:** Antes de proponer un comando para ejecutar (como `node facturasFinal.js`), explícame en español qué va a hacer ese comando.

---

# 📁 Sistema de Descarga y Procesamiento de Facturas Electrónicas (Costa Rica)

## 🎯 Propósito del Proyecto
Automatizar la descarga, clasificación y almacenamiento de facturas electrónicas (XML y PDF) desde cuentas de correo Gmail utilizando el protocolo IMAP. El sistema organiza los documentos recibidos por Año, Mes y Categoría Contable según los estándares del Ministerio de Hacienda de Costa Rica.

## 🛠️ Stack Tecnológico
- **Lenguaje:** Node.js
- **Protocolo:** IMAP (librería `imap`) para conexión con servidores de correo.
- **Procesamiento:** 
  - `mailparser`: Para diseccionar los correos y extraer adjuntos.
  - `xml2js`: Para convertir los XML de Hacienda en objetos JavaScript.
  - `iconv-lite`: Para manejar correctamente los caracteres especiales (tildes, ñ) en los nombres de proveedores.
  - `moment`: Para el manejo de fechas y periodos fiscales.
- **Frontend:** Servidor local con Express (`dashboardServer.js`) para visualizar estadísticas.

## 📂 Lógica de Almacenamiento y Clasificación
La ruta base es `./Facturas/[correo_usuario]/[año]/[mes]/`.
El sistema clasifica automáticamente según el archivo `proveedores.csv`:
- **Compras (`c`):** Facturas de proveedores de inventario o materia prima.
- **Gastos (`g`):** Facturas de servicios operativos (luz, agua, internet, etc.).
- **Comisión x Venta (`cv`):** Comprobantes específicos de comisiones.
- **SinClasificar:** Proveedores que aún no tienen una letra asignada en la columna "Contable".
- **Adjuntos:** Carpeta de respaldo que contiene todos los archivos originales organizados por remitente y número de correo.

## ⚙️ Componentes Clave
- **`facturasFinal.js`**: El motor del sistema. Realiza la descarga, validación de duplicados (mediante la Clave de 50 dígitos) y la organización física de archivos.
- **`proveedoresCSV.js`**: Módulo que centraliza la lógica del archivo de proveedores.
- **`proveedores.csv`**: El "corazón" de la clasificación. Almacena: `Numero (Cédula);Nombre;NombreComercial;Correo;Telefono;Contable`.
- **`tiposComprobantes.json`**: Registro automático de los tipos de documentos encontrados (Factura, Tiquete, Nota de Crédito).

## 🔄 Reglas de Negocio Implementadas
- **Mayúsculas Obligatorias:** Los campos "Nombre" y "Nombre Comercial" de los proveedores se transforman a **MAYÚSCULAS** automáticamente al descargar facturas o actualizar el CSV.
- **Actualización Inteligente:** Si un proveedor ya existe, el sistema actualiza sus datos de contacto (correo, teléfono) si han cambiado en el XML, pero **respeta siempre la clasificación contable** manual del usuario.
- **Protección contra Duplicados:** El sistema carga un historial de claves procesadas al inicio para evitar descargar o contar dos veces la misma factura.
- **Reparación de Texto:** Incluye lógica para corregir errores de codificación comunes en los nombres enviados por los emisores.
