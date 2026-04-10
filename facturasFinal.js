const Imap = require("imap");
const { simpleParser } = require("mailparser");
const fs = require("fs-extra");
const moment = require("moment");
const xml2js = require("xml2js");
const iconv = require("iconv-lite");
const proveedores = require("./proveedoresCSV");

// --- CONFIGURACIÓN DINÁMICA ---
// Si hay argumentos, los usamos. Si no, leemos la primera línea de imap.txt (compatibilidad)
let user, password, mesConfig;

if (process.argv.length >= 5) {
  user = process.argv[2];
  password = process.argv[3];
  mesConfig = process.argv[4];
} else {
  const configFile = fs.readFileSync("imap.txt", "utf8").split("\n")[0].trim();
  [user, password, mesConfig] = configFile.split(",");
}

const yearActual = moment().format("YYYY");
const mesBuscar = mesConfig.padStart(2, "0");

const inicioBusqueda = moment(`${yearActual}-${mesBuscar}-01`);
const finBusqueda = inicioBusqueda.clone().endOf("month");

const sinceDate = inicioBusqueda.format("DD-MMM-YYYY");
const beforeDate = finBusqueda.add(1, "day").format("DD-MMM-YYYY");

const imap = new Imap({
  user: user,
  password: password,
  host: "imap.gmail.com",
  port: 993,
  tls: true,
  tlsOptions: { rejectUnauthorized: false }
});

// NUEVA RUTA: facturas / correo / año / mes
const BASE_PATH = `./Facturas/${user}`; 
const TIPOS_FILE = `${BASE_PATH}/tiposComprobantes.json`;
const TIPOS_SUBIR_FILE = `${BASE_PATH}/tiposXMLxSubir.json`;
const PROVEEDORES_FILE = `${BASE_PATH}/proveedores.csv`;

const EXT_IMAGENES = [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".svg"];

let LOG = [];
let contadorCorreo = 0;

let correosPendientes = 0;
let descargaTerminada = false;

let TIPOS_XML_SUBIR = [];

let XML_PROCESADOS = new Map(); // Ahora es un Map para guardar origen: clave -> { numero, fecha, email }
let CLAVES_CONTADAS = new Set();

let ESTADISTICAS = {
  correosEncontrados: 0,
  correosProcesados: 0,
  correosConAdjuntos: 0,
  noProcesados: 0,
  duplicados: 0,
  errores: 0,
  motivos: {},
  tipos: {}
};

const TIPOS_DEFAULT = [
  "FacturaElectronica",
  "TiqueteElectronico",
  "NotaCreditoElectronica",
  "NotaDebitoElectronica",
  "ReciboElectronicoPago"
];

let TIPOS_VALIDOS = [];

function cargarTipos() {
  if (!fs.existsSync(TIPOS_FILE)) {
    fs.outputJsonSync(TIPOS_FILE, TIPOS_DEFAULT, { spaces: 2 });
    TIPOS_VALIDOS = [...TIPOS_DEFAULT];
  } else {
    TIPOS_VALIDOS = fs.readJsonSync(TIPOS_FILE);
  }
}

function cargarTiposXMLSubir(){
  if(!fs.existsSync(TIPOS_SUBIR_FILE)){
    fs.outputJsonSync(TIPOS_SUBIR_FILE,[
      "FacturaElectronica",
      "NotaCreditoElectronica",
      "ReciboElectronicoPago"
    ],{spaces:2});
  }
  TIPOS_XML_SUBIR = fs.readJsonSync(TIPOS_SUBIR_FILE);
}

async function guardarXMLContable(attachment, tipoContable) {
  try {
    const datos = await leerXML(attachment.content);
    if (!datos) return null;
    const tipoDocumento = datos.tipoDocumento;
    if (!TIPOS_XML_SUBIR.includes(tipoDocumento)) return null;

    let ruta = "";
    if (tipoContable === "Compras" || tipoContable === "Gastos" || tipoContable === "Comisión x Venta") {
      ruta = `${BASE_PATH}/${yearActual}/${mesBuscar}/${tipoContable}/XML`;
    } else {
      ruta = `${BASE_PATH}/${yearActual}/${mesBuscar}/XML-ContableSinAsignar`;
    }

    fs.ensureDirSync(ruta);
    const filePath = `${ruta}/${attachment.filename}`;
    if (fs.existsSync(filePath)) return "EXISTE";

    fs.writeFileSync(filePath, attachment.content);
    return filePath;
  } catch {
    return "ERROR";
  }
}

function guardarNuevoTipo(tipo) {
  if (!TIPOS_VALIDOS.includes(tipo)) {
    TIPOS_VALIDOS.push(tipo);
    fs.writeJsonSync(TIPOS_FILE, TIPOS_VALIDOS, { spaces: 2 });
  }
}

function registrarMotivo(motivo){
  if(!ESTADISTICAS.motivos[motivo]){
    ESTADISTICAS.motivos[motivo] = 0;
  }
  ESTADISTICAS.motivos[motivo]++;
}

function obtenerTipoContable(cedula){
  try{
    if(!fs.existsSync(PROVEEDORES_FILE)) return "SinClasificar";
    const data = fs.readFileSync(PROVEEDORES_FILE,"utf8");
    const lineas = data.split("\n");
    for(let i=1;i<lineas.length;i++){
      const cols = lineas[i].split(";");
      if(cols[0] && cols[0].trim() === cedula){
        const contable = (cols[5] || "").trim().toLowerCase();
        if(contable === "c") return "Compras";
        if(contable === "g") return "Gastos";
        if(contable === "cv") return "Comisión x Venta";
      }
    }
    return "SinClasificar";
  }catch{
    return "SinClasificar";
  }
}

function repararTexto(texto) {
  if (!texto) return "";
  try {
    if (texto.includes("Ã") || texto.includes("Â")) {
      return iconv.decode(Buffer.from(texto, "latin1"), "utf8");
    }
    return texto;
  } catch {
    return texto;
  }
}

function limpiarTexto(texto) {
  if (!texto) return "";
  texto = repararTexto(texto);
  return texto
    .replace(/[<>:"/\\|?*]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function leerXML(xmlBuffer) {
  try {
    let xml = iconv.decode(xmlBuffer, "utf8");
    xml = repararTexto(xml);
    const parser = new xml2js.Parser({
      explicitArray: false,
      tagNameProcessors: [xml2js.processors.stripPrefix]
    });
    const result = await parser.parseStringPromise(xml);
    const tipoDocumento = Object.keys(result)[0];
    guardarNuevoTipo(tipoDocumento);
    const data = result[tipoDocumento];
    const clave = data.Clave || "";
    let proveedor = "";
    let cedula = "";
    let nombreComercial = "";
    let correo = "";
    let telefono = "";

    if (data.Emisor) {
      proveedor = limpiarTexto(data.Emisor.Nombre || "").toUpperCase();
      if (data.Emisor.Identificacion) {
        cedula = data.Emisor.Identificacion.Numero || "";
      }
      nombreComercial = limpiarTexto(data.Emisor.NombreComercial || "").toUpperCase();
      if (data.Emisor.CorreoElectronico) {
        if(Array.isArray(data.Emisor.CorreoElectronico)){
          correo = limpiarTexto(data.Emisor.CorreoElectronico[0]);
        }else{
          correo = limpiarTexto(data.Emisor.CorreoElectronico);
        }
      }
      if (data.Emisor.Telefono) {
        telefono = data.Emisor.Telefono.NumTelefono || "";
      }
    }

    if (tipoDocumento === "MensajeHacienda") {
      proveedor = limpiarTexto(data.NombreEmisor || "").toUpperCase();
      cedula = data.NumeroCedulaEmisor || "";
    }

    return { proveedor, cedula, nombreComercial, correo, telefono, tipoDocumento, clave };
  } catch {
    ESTADISTICAS.errores++;
    return null;
  }
}

function guardarAdjuntosCorreo(numeroCorreo,emailOrigen,fechaCorreo,attachments){
  const ruta = `${BASE_PATH}/${yearActual}/${mesBuscar}/Adjuntos/${numeroCorreo} - ${emailOrigen} - ${fechaCorreo.replace(/\//g,"-")}`;
  fs.ensureDirSync(ruta);
  for (let att of attachments){
    if(!att.filename) continue;
    const filePath = `${ruta}/${att.filename}`;
    if(!fs.existsSync(filePath)){
      fs.writeFileSync(filePath,att.content);
    }
  }
}

async function cargarHistorial() {
  if (!fs.existsSync(BASE_PATH)) return;
  console.log("Cargando historial de facturas previas...");
  try {
    const anios = fs.readdirSync(BASE_PATH);
    for (let anio of anios) {
      const anioPath = `${BASE_PATH}/${anio}`;
      if (!fs.statSync(anioPath).isDirectory()) continue;
      const meses = fs.readdirSync(anioPath);
      for (let mes of meses) {
        const adjuntosPath = `${anioPath}/${mes}/Adjuntos`;
        if (!fs.existsSync(adjuntosPath)) continue;
        const correos = fs.readdirSync(adjuntosPath);
        for (let carpeta of correos) {
          const folderPath = `${adjuntosPath}/${carpeta}`;
          if (!fs.statSync(folderPath).isDirectory()) continue;
          const archivos = fs.readdirSync(folderPath);
          for (let archivo of archivos) {
            if (archivo.toLowerCase().endsWith(".xml") && !archivo.toLowerCase().includes("respu")) {
              try {
                const xml = fs.readFileSync(`${folderPath}/${archivo}`, "utf8");
                const claveMatch = xml.match(/<Clave>(\d+)<\/Clave>/i);
                if (claveMatch) {
                  const clave = claveMatch[1];
                  if (!XML_PROCESADOS.has(clave)) {
                    XML_PROCESADOS.set(clave, {
                      numero: "Historial",
                      fecha: `${anio}/${mes}`,
                      email: carpeta,
                      esHistorial: true,
                      ruta: `facturas\\${anio}\\${mes}\\Adjuntos\\${carpeta}`
                    });
                  }
                }
              } catch (e) {}
            }
          }
        }
      }
    }
  } catch (e) {}
  console.log(`Historial cargado: ${XML_PROCESADOS.size} claves indexadas.`);
}

async function procesarAdjuntos(mail) {
  contadorCorreo++;
  const numeroCorreo = contadorCorreo;
  const fechaCorreo = moment(mail.date).format("DD/MM/YYYY");
  const emailOrigen = limpiarTexto(mail.from?.value?.[0]?.address || "desconocido");

  console.log(`\n[${numeroCorreo}/${ESTADISTICAS.correosEncontrados}] 📧 Correo de: ${emailOrigen} (${fechaCorreo})`);

  ESTADISTICAS.correosProcesados++;

  let logCorreo = `\n-----------------------------------------------------\n`;
  logCorreo += `CORREO #${numeroCorreo} - ${fechaCorreo} - ${emailOrigen}\n`;
  logCorreo += `-----------------------------------------------------\n`;

  if (!mail.attachments || mail.attachments.length === 0) {
    console.log(`   ⚠️  Sin adjuntos. Omitiendo.`);
    ESTADISTICAS.noProcesados++;
    registrarMotivo("Sin adjuntos");
    logCorreo += `Estado: NO PROCESADO - Motivo: Sin adjuntos\n`;
    logCorreo += `-----------------------------------------------------\n`;
    LOG.push(logCorreo);
    correosPendientes--;
    verificarFin();
    return;
  }

  ESTADISTICAS.correosConAdjuntos++;

  let proveedor = "";
  let cedula = "";
  let tipoDocumento = "";
  let clave = "";
  let xmlPrincipal = false;
  let detallesAdjuntos = [];
  let totalXMLEncontrados = 0;

  let primerDuplicadoInfo = null;

  for (let attachment of mail.attachments) {
    if (!attachment.filename) continue;
    const nombre = attachment.filename;
    const nombreLower = nombre.toLowerCase();
    let statusAdjunto = "";

    if (nombreLower.endsWith(".xml")) {
      const datos = await leerXML(attachment.content);
      if (!datos) {
        statusAdjunto = `ERROR: No se pudo leer XML`;
        console.log(`   ❌ XML: ${nombre} -> Error de lectura`);
      } else if (datos.tipoDocumento === "MensajeHacienda") {
        statusAdjunto = `Identificado (Respuesta Hacienda)`;
        console.log(`   ℹ️  XML: ${nombre} -> Respuesta de Hacienda`);
      } else {
        totalXMLEncontrados++;
        if (XML_PROCESADOS.has(datos.clave)) {
          const orig = XML_PROCESADOS.get(datos.clave);
          statusAdjunto = `OMITIDO (Duplicado) - Clave: ${datos.clave}`;
          console.log(`   🟡 XML: ${nombre} -> DUPLICADO (Ya procesado)`);
          if (!primerDuplicadoInfo) primerDuplicadoInfo = orig;
        } else {
          statusAdjunto = `Procesado (XML) - Clave: ${datos.clave}`;
          console.log(`   ✅ XML: ${nombre} -> NUEVO DOCUMENTO (${datos.tipoDocumento})`);
          if (!xmlPrincipal) {
            xmlPrincipal = true;
            proveedor = datos.proveedor;
            cedula = datos.cedula;
            tipoDocumento = datos.tipoDocumento;
            clave = datos.clave;
            
            XML_PROCESADOS.set(datos.clave, {
              numero: numeroCorreo,
              fecha: fechaCorreo,
              email: emailOrigen
            });

            if (!CLAVES_CONTADAS.has(datos.clave)) {
              CLAVES_CONTADAS.add(datos.clave);
              if (!ESTADISTICAS.tipos[tipoDocumento]) ESTADISTICAS.tipos[tipoDocumento] = 0;
              ESTADISTICAS.tipos[tipoDocumento]++;
            }

            proveedores.registrarProveedor({
              Numero: datos.cedula,
              Nombre: datos.proveedor,
              NombreComercial: datos.nombreComercial,
              Correo: datos.correo,
              Telefono: datos.telefono
            }, PROVEEDORES_FILE);
          }
        }
      }
    } else if (nombreLower.endsWith(".pdf")) {
      statusAdjunto = `Identificado (PDF)`;
      console.log(`   📄 PDF: ${nombre}`);
    } else if (EXT_IMAGENES.some(ext => nombreLower.endsWith(ext))) {
      statusAdjunto = `Ignorado (Imagen/Logo)`;
    } else {
      statusAdjunto = `Ignorado (Otro tipo)`;
    }
    detallesAdjuntos.push(`- Adjunto: ${nombre} -> ${statusAdjunto}`);
  }

  logCorreo += detallesAdjuntos.join("\n") + "\n";

  if (totalXMLEncontrados > 0 && !xmlPrincipal) {
    ESTADISTICAS.duplicados++;
    registrarMotivo("Correo duplicado (Claves ya procesadas)");
    const d = primerDuplicadoInfo;
    let ref = d.esHistorial ? `@${d.ruta}` : `- CORREO # ${d.numero} - ${d.fecha} - ${d.email}`;
    console.log(`   🚫 Omitiendo correo completo por duplicidad.`);
    logCorreo += `Estado: NO PROCESADO - Motivo: Duplicado - CORREO # ${numeroCorreo} - ${fechaCorreo} - ${emailOrigen} ${ref}\n`;
    logCorreo += `-----------------------------------------------------\n`;
    LOG.push(logCorreo);
    correosPendientes--;
    verificarFin();
    return;
  }

  if (!xmlPrincipal) {
    ESTADISTICAS.noProcesados++;
    registrarMotivo("Sin XML válido");
    console.log(`   ⚠️  No se encontró ningún XML de factura válido.`);
    logCorreo += `Estado: NO PROCESADO - Sin XML válido\n`;
    logCorreo += `-----------------------------------------------------\n`;
    guardarAdjuntosCorreo(numeroCorreo, emailOrigen, fechaCorreo, mail.attachments);
    LOG.push(logCorreo);
    correosPendientes--;
    verificarFin();
    return;
  }

  const tipoContable = obtenerTipoContable(cedula);
  const carpetaProveedor = `${proveedor}_${cedula}-${emailOrigen}`;
  console.log(`   📂 Clasificado como: ${tipoContable} -> ${proveedor}`);

  for (let attachment of mail.attachments) {
    if (!attachment.filename) continue;
    const nombre = attachment.filename.toLowerCase();
    let tipoArchivo = "";
    if (nombre.endsWith(".xml")) tipoArchivo = "XML";
    if (nombre.endsWith(".pdf")) tipoArchivo = "PDF";
    if (!tipoArchivo) continue;

    const ruta = `${BASE_PATH}/${yearActual}/${mesBuscar}/${tipoContable}/${carpetaProveedor}/${tipoDocumento}/${tipoArchivo}`;
    fs.ensureDirSync(ruta);
    const filePath = `${ruta}/${attachment.filename}`;

    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, attachment.content);
      logCorreo += `  [Guardado] ${tipoArchivo}: ${attachment.filename}\n`;
      console.log(`   💾 Guardado: ${tipoArchivo} en carpeta del proveedor.`);
    } else {
      logCorreo += `  [Ya existe] ${tipoArchivo}: ${attachment.filename}\n`;
    }

    if (tipoArchivo === "XML") {
      const resContable = await guardarXMLContable(attachment, tipoContable);
      if (resContable && resContable !== "EXISTE" && resContable !== "ERROR") {
        logCorreo += `  [Copia Contable] ${attachment.filename}\n`;
        console.log(`   💾 Copia Contable creada.`);
      }
    }
  }

  console.log(`   ✨ Procesado exitosamente.`);
  logCorreo += `Estado: PROCESADO EXITOSAMENTE\n`;
  logCorreo += `-----------------------------------------------------\n`;
  LOG.push(logCorreo);

  correosPendientes--;
  verificarFin();
}

function verificarFin(){
  if(descargaTerminada && correosPendientes === 0){
    generarLog();
    imap.end();
  }
}

function buscarCorreos() {
  console.log(`\n🔍 Buscando correos desde ${sinceDate} hasta ${beforeDate}...`);
  imap.search([["SINCE", sinceDate], ["BEFORE", beforeDate]], (err, results) => {
    if (err) { console.log("❌ Error en la búsqueda:", err); return; }
    
    ESTADISTICAS.correosEncontrados = results.length;
    correosPendientes = results.length;
    
    if (!results.length) { 
      console.log("ℹ️  No se encontraron correos en este periodo."); 
      imap.end(); 
      return; 
    }
    
    console.log(`✅ Se encontraron ${results.length} correos. Iniciando descarga y procesamiento...\n`);
    
    const f = imap.fetch(results, { bodies: "" });
    f.on("message", (msg, seqno) => {
      console.log(`📥 [${seqno}] Obteniendo datos del servidor de correo...`);
      msg.on("body", (stream) => {
        simpleParser(stream, async (err, mail) => {
          if (err) {
            console.log(`   ❌ Error al leer contenido del correo #${seqno}`);
            return;
          }
          await procesarAdjuntos(mail);
        });
      });
    });
    f.once("end", () => {
      descargaTerminada = true;
      verificarFin();
    });
  });
}

function generarLog() {
  console.log("\n🏁 Proceso de descarga finalizado. Generando resumen...");
  const ruta = `${BASE_PATH}/${yearActual}/${mesBuscar}/Adjuntos`;
  // ... resto de la función ...
  fs.ensureDirSync(ruta);
  let resumen = "=====================================================\n";
  resumen += "RESUMEN DEL PROCESO\n";
  resumen += "=====================================================\n";
  resumen += `Fecha de ejecución: ${moment().format("DD/MM/YYYY HH:mm:ss")}\n`;
  resumen += `Correos encontrados: ${ESTADISTICAS.correosEncontrados}\n`;
  resumen += `Correos procesados: ${ESTADISTICAS.correosProcesados}\n`;
  resumen += `Correos con adjuntos: ${ESTADISTICAS.correosConAdjuntos}\n`;
  resumen += `Correos DUPLICADOS omitidos: ${ESTADISTICAS.duplicados}\n`;
  resumen += `Correos NO procesados: ${ESTADISTICAS.noProcesados}\n`;
  resumen += `Errores XML: ${ESTADISTICAS.errores}\n\n`;
  resumen += "Motivos de NO procesado / Duplicado:\n";
  for (let m in ESTADISTICAS.motivos) resumen += `- ${m}: ${ESTADISTICAS.motivos[m]}\n`;
  resumen += "\nTipos detectados:\n";
  for (let t in ESTADISTICAS.tipos) resumen += `- ${t}: ${ESTADISTICAS.tipos[t]}\n`;
  resumen += "=====================================================\n";
  
  // Imprimir en consola
  console.log("\n" + resumen);
  
  resumen += "\nDETALLE POR CORREO:\n";
  fs.writeFileSync(`${ruta}/log.txt`, resumen + LOG.join(""), "utf8");
  console.log(`Log completo guardado en: ${ruta}/log.txt\n`);
}

imap.once("ready", async () => {
  cargarTipos();
  cargarTiposXMLSubir();
  await cargarHistorial();
  console.log("Conectado a correo y historial cargado");
  imap.openBox("INBOX", false, buscarCorreos);
});

imap.once("error", (err) => { console.log("Error IMAP:", err); });
imap.connect();
