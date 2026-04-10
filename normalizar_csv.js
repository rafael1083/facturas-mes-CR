const fs = require("fs");
const iconv = require("iconv-lite");

const archivos = [
    "C:\\facturasMes\\proveedores.csv",
    "C:\\facturasMes\\facturas\\compras.etelgive@gmail.com\\proveedores.csv",
    "C:\\facturasMes\\facturas\\compras.multichunches@gmail.com\\proveedores.csv"
];

function repararYMayus(texto) {
    if (!texto) return "";
    try {
        // Si detectamos caracteres típicos de mala codificación, reparamos
        if (texto.includes("Ã") || texto.includes("Â")) {
            texto = iconv.decode(Buffer.from(texto, "latin1"), "utf8");
        }
    } catch (e) {}
    return texto.toUpperCase().trim();
}

archivos.forEach(ruta => {
    if (!fs.existsSync(ruta)) return;
    
    console.log(`Procesando: ${ruta}`);
    const contenido = fs.readFileSync(ruta, "utf8");
    const lineas = contenido.split("\n");
    
    const nuevasLineas = lineas.map((linea, index) => {
        if (index === 0 || !linea.trim()) return linea;
        
        const cols = linea.split(";");
        if (cols.length >= 3) {
            cols[1] = repararYMayus(cols[1]); // Nombre
            cols[2] = repararYMayus(cols[2]); // Nombre Comercial
        }
        return cols.join(";");
    });
    
    fs.writeFileSync(ruta, nuevasLineas.join("\n"), "utf8");
    console.log(`✅ Finalizado: ${ruta}`);
});
