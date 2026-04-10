const fs = require("fs-extra");
const path = require("path");

function registrarProveedor(datos, filePath) {
  const PROVEEDORES_FILE = filePath || "./proveedores.csv";
  
  // Asegurar que el directorio exista
  fs.ensureDirSync(path.dirname(PROVEEDORES_FILE));

  // Convertir a MAYÚSCULAS los campos solicitados
  const nombreMayus = (datos.Nombre || "").toUpperCase().trim();
  const nombreComercialMayus = (datos.NombreComercial || "").toUpperCase().trim();
  const numeroBusqueda = String(datos.Numero || "").trim();

  if (!fs.existsSync(PROVEEDORES_FILE)) {
    const cabecera = "Numero;Nombre;NombreComercial;Correo;Telefono;Contable\n";
    fs.writeFileSync(PROVEEDORES_FILE, cabecera, "utf8");
  }

  try {
    const data = fs.readFileSync(PROVEEDORES_FILE, "utf8");
    const lineas = data.split("\n").filter(l => l.trim() !== "");
    let encontrado = false;

    const nuevasLineas = lineas.map((linea, index) => {
      // Omitir cabecera en la comparación pero mantenerla en el archivo
      if (index === 0) return linea;

      const cols = linea.split(";");
      const numeroActual = (cols[0] || "").trim();

      if (numeroActual === numeroBusqueda) {
        encontrado = true;
        // Actualizamos manteniendo la columna "Contable" (index 5) si existe
        const contableActual = cols[5] || "";
        return `${numeroActual};${nombreMayus};${nombreComercialMayus};${datos.Correo || ""};${datos.Telefono || ""};${contableActual}`;
      }
      return linea;
    });

    if (!encontrado && numeroBusqueda !== "") {
      // Si no existe, lo añadimos al final
      nuevasLineas.push(`${numeroBusqueda};${nombreMayus};${nombreComercialMayus};${datos.Correo || ""};${datos.Telefono || ""};`);
    }

    // Escribir el archivo completo con un salto de línea al final
    fs.writeFileSync(PROVEEDORES_FILE, nuevasLineas.join("\n") + "\n", "utf8");

  } catch (error) {
    console.log("Error al registrar/actualizar proveedor:", error.message);
  }
}

module.exports = {
  registrarProveedor
};
