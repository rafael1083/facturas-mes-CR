const { execSync } = require("child_process");
const moment = require("moment");

/**
 * Función para automatizar el respaldo en GitHub
 */
function subirProyectoAgithub() {
  try {
    // 1. Obtener mensaje del respaldo (si se pasa por argumento, se usa, si no, se genera uno con la fecha)
    const mensajePersonalizado = process.argv.slice(2).join(" ");
    const fechaHora = moment().format("DD/MM/YYYY HH:mm:ss");
    const mensajeFinal = mensajePersonalizado || `Respaldo automático - ${fechaHora}`;

    console.log(`\n🚀 Iniciando respaldo en GitHub...`);
    console.log(`📝 Mensaje: "${mensajeFinal}"\n`);

    // 2. Ejecutar comandos de Git secuencialmente
    console.log("📦 Preparando archivos...");
    execSync("git add .", { stdio: "inherit" });

    console.log("💾 Creando punto de restauración (Commit)...");
    execSync(`git commit -m "${mensajeFinal}"`, { stdio: "inherit" });

    console.log("☁️  Subiendo cambios a la nube (GitHub)...");
    execSync("git push origin main", { stdio: "inherit" });

    console.log("\n✅ ¡Proyecto respaldado con éxito en GitHub!");
  } catch (error) {
    console.error("\n❌ Error durante el respaldo:");
    console.error("Asegúrate de tener conexión a internet y de haber configurado correctamente el repositorio.");
  }
}

// Ejecutar la función
subirProyectoAgithub();
