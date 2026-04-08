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

// Iniciar descarga para una cuenta específica
app.post("/api/descargar", (req, res) => {
  const { email, mes, anio } = req.body;
  
  try {
    const lines = fs.readFileSync(IMAP_FILE, "utf8").trim().split("\n");
    const account = lines.find(line => line.startsWith(email));
    
    if (!account) {
      return res.status(404).json({ error: "Cuenta no encontrada en imap.txt" });
    }

    const [u, p] = account.split(",");
    
    // Ejecutamos el script pasando los argumentos: email password mes
    // El año lo manejamos internamente en el script o podríamos pasarlo también
    console.log(`Iniciando descarga para ${email} - Periodo: ${mes}/${anio}...`);
    
    const command = `node facturasFinal.js "${u}" "${p}" "${mes}"`;
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error: ${error.message}`);
        return res.status(500).json({ error: "Error en la ejecución", detalle: error.message });
      }
      res.json({ mensaje: "Descarga completada con éxito", logs: stdout });
    });
    
  } catch (error) {
    res.status(500).json({ error: "Error al procesar la solicitud" });
  }
});

app.listen(PORT, () => {
  console.log(`Dashboard Multicuenta corriendo en http://localhost:${PORT}`);
});
