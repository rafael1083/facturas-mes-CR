const fs = require("fs-extra");
const path = require("path");

function registrarProveedor(datos, filePath) {
  const PROVEEDORES_FILE = filePath || "./proveedores.csv";
  
  // Asegurar que el directorio exista
  fs.ensureDirSync(path.dirname(PROVEEDORES_FILE));

  if (!fs.existsSync(PROVEEDORES_FILE)) {
    const cabecera = "Numero;Nombre;NombreComercial;Correo;Telefono;Contable\n";
    fs.writeFileSync(PROVEEDORES_FILE, cabecera, "utf8");
  }

  try {
    const data = fs.readFileSync(PROVEEDORES_FILE, "utf8");
    const lineas = data.split("\n");

    const existe = lineas.some(linea => {
      const cols = linea.split(";");
      return cols[0] && cols[0].trim() === String(datos.Numero).trim();
    });

    if (!existe) {
      const nuevaLinea = `${datos.Numero || ""};${datos.Nombre || ""};${datos.NombreComercial || ""};${datos.Correo || ""};${datos.Telefono || ""};\n`;
      fs.appendFileSync(PROVEEDORES_FILE, nuevaLinea, "utf8");
    }
  } catch (error) {
    console.log("Error al registrar proveedor:", error.message);
  }
}

module.exports = {
  registrarProveedor
};
