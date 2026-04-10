const express = require("express");
const fs = require("fs-extra");
const path = require("path");
const { exec } = require("child_process");
const cors = require("cors");
const moment = require("moment");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const IMAP_FILE = "imap.txt";

// Obtener lista de cuentas desde imap.txt
app.get("/api/config", (req, res) => {
  try {
    if (!fs.existsSync(IMAP_FILE)) {
      return res.status(404).json({ error: "Archivo imap.txt no encontrado" });
    }
    // Usamos regex para manejar saltos de línea de Windows (\r\n) o Unix (\n)
    const rawContent = fs.readFileSync(IMAP_FILE, "utf8").trim();
    const lines = rawContent.split(/\r?\n/).filter(line => line.trim() !== "");
    
    const accounts = lines.map(line => {
      const parts = line.split(",");
      if (parts.length < 3) return null;
      return { 
        email: parts[0].trim(), 
        mesDefault: parts[2].trim() 
      };
    }).filter(acc => acc !== null);
    
    res.json({
      accounts: accounts,
      anioActual: moment().format("YYYY")
    });
  } catch (error) {
    console.error("Error API Config:", error);
    res.status(500).json({ error: "Error al leer imap.txt" });
  }
});

const { spawn } = require("child_process");

// Iniciar descarga para una cuenta específica con STREAMING de logs
app.post("/api/descargar", (req, res) => {
  const { email, mes, anio } = req.body;
  
  try {
    const lines = fs.readFileSync(IMAP_FILE, "utf8").trim().split("\n");
    const account = lines.find(line => line.startsWith(email));
    
    if (!account) {
      return res.status(404).json({ error: "Cuenta no encontrada en imap.txt" });
    }

    const [u, p] = account.split(",");
    
    console.log(`Iniciando descarga para ${email} - Periodo: ${mes}/${anio}...`);
    
    // Configuramos cabeceras para streaming agresivo
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    // ENVIAR PADDING INICIAL: Esto obliga al navegador a empezar a mostrar el contenido
    // Algunos navegadores esperan a recibir ~1KB de datos para empezar a renderizar el stream
    res.write(" ".repeat(1024) + "\n"); 
    res.write("🚀 CONEXIÓN ESTABLECIDA: Iniciando motor de descarga...\n");
    res.write("------------------------------------------------------------\n\n");

    const child = spawn("node", ["facturasFinal.js", u, p, mes]);

    child.stdout.on("data", (data) => {
      // Convertimos a string y enviamos inmediatamente
      res.write(data.toString());
    });

    child.stderr.on("data", (data) => {
      res.write(`\n❌ ERROR EN PROCESO: ${data.toString()}`);
    });

    child.on("close", (code) => {
      res.write(`\n\n✅ --- PROCESO FINALIZADO (Código: ${code}) ---`);
      res.end();
    });
    
  } catch (error) {
    console.error("Error en /api/descargar:", error);
    res.status(500).write("Error interno del servidor al iniciar la descarga.");
    res.end();
  }
});

// Obtener proveedores de una cuenta específica
app.get("/api/proveedores/:email", (req, res) => {
  const email = req.params.email;
  const PROVEEDORES_FILE = path.join(__dirname, "facturas", email, "proveedores.csv");

  try {
    if (!fs.existsSync(PROVEEDORES_FILE)) {
      return res.json([]); // Si no existe, devolvemos lista vacía
    }
    const content = fs.readFileSync(PROVEEDORES_FILE, "utf8");
    const lines = content.trim().split(/\r?\n/).filter(line => line.trim() !== "");
    
    if (lines.length === 0) return res.json([]);

    const headers = lines[0].split(";");
    
    const data = lines.slice(1).map(line => {
      const cols = line.split(";");
      let obj = {};
      headers.forEach((h, i) => {
        const key = h.trim();
        obj[key] = (cols[i] !== undefined) ? cols[i].trim() : "";
      });
      return obj;
    });
    
    res.json(data);
  } catch (error) {
    console.error("Error al leer proveedores:", error);
    res.status(500).json({ error: "Error al leer proveedores" });
  }
});

// Guardar proveedores de una cuenta específica
app.post("/api/proveedores/:email", (req, res) => {
  const email = req.params.email;
  const proveedores = req.body.proveedores;
  const PROVEEDORES_FILE = path.join(__dirname, "facturas", email, "proveedores.csv");

  try {
    const cabecera = "Numero;Nombre;NombreComercial;Correo;Telefono;Contable\n";
    const contenido = proveedores.map(p => 
      `${p.Numero};${p.Nombre};${p.NombreComercial};${p.Correo};${p.Telefono};${p.Contable}`
    ).join("\n");

    fs.ensureDirSync(path.dirname(PROVEEDORES_FILE));
    fs.writeFileSync(PROVEEDORES_FILE, cabecera + contenido, "utf8");
    res.json({ mensaje: "Proveedores guardados correctamente" });
  } catch (error) {
    res.status(500).json({ error: "Error al guardar proveedores" });
  }
});

app.listen(PORT, () => {
  console.log(`Dashboard Multicuenta corriendo en http://localhost:${PORT}`);
});
