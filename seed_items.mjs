const URL = "https://rpaihoyotvinucbelaew.supabase.co/rest/v1";
const KEY = "sb_publishable_VFD2__G0DFFL_rLQ-VpwHA_pKebfVbR";

const headers = {
  "apikey": KEY,
  "Authorization": `Bearer ${KEY}`,
  "Content-Type": "application/json",
  "Prefer": "return=minimal",
};

const seed = {
  cat_insumos: [
    { name: "Papel Bond A4", qty: 50, threshold: 10, marca: "Repro", location: "Bodega A", subcategory: "Papel" },
    { name: "Carpetas Manila", qty: 30, threshold: 5, marca: "Generico", location: "Bodega A", subcategory: "Archivero" },
    { name: "Boligrafos Azul", qty: 100, threshold: 20, marca: "BIC", location: "Escritorio", subcategory: "Escritura" },
    { name: "Cinta Adhesiva", qty: 40, threshold: 8, marca: "Scotch", location: "Bodega A", subcategory: "Adhesivos" },
    { name: "Grapadoras", qty: 15, threshold: 3, marca: "Rapid", location: "Bodega A", subcategory: "Herramienta Oficina" },
    { name: "Grapas Caja", qty: 60, threshold: 10, marca: "Rapid", location: "Bodega A", subcategory: "Herramienta Oficina" },
    { name: "Marcadores Permanentes", qty: 25, threshold: 5, marca: "Sharpie", location: "Escritorio", subcategory: "Escritura" },
    { name: "Folders Colgantes", qty: 20, threshold: 5, marca: "Generico", location: "Bodega A", subcategory: "Archivero" },
    { name: "Tijeras", qty: 10, threshold: 2, marca: "Fiskars", location: "Escritorio", subcategory: "Corte" },
    { name: "Post-it Notas", qty: 35, threshold: 5, marca: "3M", location: "Escritorio", subcategory: "Papel" },
  ],
  cat_repuestos_arcades: [
    { name: "Joystick Sanwa JLF", qty: 12, threshold: 3, marca: "Sanwa", location: "Almacen Arcades", subcategory: "Controles" },
    { name: "Boton 30mm Rojo", qty: 50, threshold: 10, marca: "Seimitsu", location: "Almacen Arcades", subcategory: "Botones" },
    { name: "Boton 30mm Azul", qty: 50, threshold: 10, marca: "Seimitsu", location: "Almacen Arcades", subcategory: "Botones" },
    { name: "PCB JAMMA", qty: 5, threshold: 1, marca: "Generico", location: "Almacen Arcades", subcategory: "Electronica" },
    { name: "Monitor CRT 25in", qty: 3, threshold: 1, marca: "Wells Gardner", location: "Almacen Arcades", subcategory: "Pantallas" },
    { name: "Fuente 12V Arcade", qty: 8, threshold: 2, marca: "Happ", location: "Almacen Arcades", subcategory: "Energia" },
    { name: "Cable Harness JAMMA", qty: 10, threshold: 2, marca: "Generico", location: "Almacen Arcades", subcategory: "Cables" },
    { name: "Trackball 3in", qty: 4, threshold: 1, marca: "Happ", location: "Almacen Arcades", subcategory: "Controles" },
    { name: "Speaker 4in 8ohm", qty: 15, threshold: 3, marca: "Generico", location: "Almacen Arcades", subcategory: "Audio" },
    { name: "Monedero Acceptor", qty: 6, threshold: 2, marca: "Coin Controls", location: "Almacen Arcades", subcategory: "Monedero" },
  ],
  cat_premios: [
    { name: "Pelota Antiestres", qty: 80, threshold: 15, marca: "Generico", location: "Bodega Premios", subcategory: "Juguetes" },
    { name: "Yoyo Plastico", qty: 60, threshold: 10, marca: "Generico", location: "Bodega Premios", subcategory: "Juguetes" },
    { name: "Muneco Peluche Pequeno", qty: 40, threshold: 8, marca: "Generico", location: "Bodega Premios", subcategory: "Peluches" },
    { name: "Calcomania Pack", qty: 100, threshold: 20, marca: "Generico", location: "Bodega Premios", subcategory: "Stickers" },
    { name: "Llavero Figura", qty: 70, threshold: 10, marca: "Generico", location: "Bodega Premios", subcategory: "Accesorios" },
    { name: "Slime Colores", qty: 50, threshold: 10, marca: "Generico", location: "Bodega Premios", subcategory: "Juguetes" },
    { name: "Carta Pokemon Promo", qty: 30, threshold: 5, marca: "Nintendo", location: "Bodega Premios", subcategory: "Cartas" },
    { name: "Pulsera Silicona", qty: 90, threshold: 15, marca: "Generico", location: "Bodega Premios", subcategory: "Accesorios" },
    { name: "Mini Rompecabezas", qty: 25, threshold: 5, marca: "Generico", location: "Bodega Premios", subcategory: "Juegos" },
    { name: "Trompo Clasico", qty: 45, threshold: 8, marca: "Generico", location: "Bodega Premios", subcategory: "Juguetes" },
  ],
  cat_electronica: [
    { name: "Cable HDMI 2m", qty: 20, threshold: 4, marca: "Ugreen", location: "Bodega TI", subcategory: "Cables" },
    { name: "Cargador USB-C 65W", qty: 15, threshold: 3, marca: "Anker", location: "Bodega TI", subcategory: "Cargadores" },
    { name: "Mouse Inalambrico", qty: 10, threshold: 2, marca: "Logitech", location: "Bodega TI", subcategory: "Perifericos" },
    { name: "Teclado USB", qty: 8, threshold: 2, marca: "HP", location: "Bodega TI", subcategory: "Perifericos" },
    { name: "Hub USB 4 puertos", qty: 12, threshold: 3, marca: "Anker", location: "Bodega TI", subcategory: "Conectividad" },
    { name: "Memoria USB 32GB", qty: 25, threshold: 5, marca: "Kingston", location: "Bodega TI", subcategory: "Almacenamiento" },
    { name: "Adaptador HDMI-VGA", qty: 10, threshold: 2, marca: "Ugreen", location: "Bodega TI", subcategory: "Adaptadores" },
    { name: "Regleta 6 tomas", qty: 7, threshold: 2, marca: "Belkin", location: "Bodega TI", subcategory: "Energia" },
    { name: "Audifonos On-Ear", qty: 5, threshold: 1, marca: "Sony", location: "Bodega TI", subcategory: "Audio" },
    { name: "Lampara LED USB", qty: 18, threshold: 4, marca: "Generico", location: "Bodega TI", subcategory: "Iluminacion" },
  ],
  cat_alimentos: [
    { name: "Refresco Coca-Cola 600ml", qty: 120, threshold: 24, marca: "Coca-Cola", location: "Refrigerador", subcategory: "Bebidas" },
    { name: "Agua 500ml", qty: 200, threshold: 40, marca: "Bonafont", location: "Almacen Alimentos", subcategory: "Bebidas" },
    { name: "Papas Sabritas 45g", qty: 80, threshold: 15, marca: "Sabritas", location: "Almacen Alimentos", subcategory: "Snacks" },
    { name: "Palomitas Microondas", qty: 60, threshold: 12, marca: "Pop Secret", location: "Almacen Alimentos", subcategory: "Snacks" },
    { name: "Chicles Pelon Pelo Rico", qty: 150, threshold: 30, marca: "Boing", location: "Mostrador", subcategory: "Dulceria" },
    { name: "Chocolate Snickers", qty: 90, threshold: 18, marca: "Mars", location: "Mostrador", subcategory: "Dulceria" },
    { name: "Jugo Del Valle 250ml", qty: 100, threshold: 20, marca: "Del Valle", location: "Refrigerador", subcategory: "Bebidas" },
    { name: "Galletas Oreo", qty: 70, threshold: 14, marca: "Nabisco", location: "Almacen Alimentos", subcategory: "Snacks" },
    { name: "Paleta Payaso", qty: 200, threshold: 40, marca: "Ricolino", location: "Mostrador", subcategory: "Dulceria" },
    { name: "Gansito", qty: 50, threshold: 10, marca: "Marinela", location: "Mostrador", subcategory: "Snacks" },
  ],
  cat_textiles: [
    { name: "Playera Polo Staff S", qty: 10, threshold: 2, marca: "Hanes", location: "Bodega Textiles", subcategory: "Uniformes" },
    { name: "Playera Polo Staff M", qty: 15, threshold: 3, marca: "Hanes", location: "Bodega Textiles", subcategory: "Uniformes" },
    { name: "Playera Polo Staff L", qty: 12, threshold: 3, marca: "Hanes", location: "Bodega Textiles", subcategory: "Uniformes" },
    { name: "Playera Polo Staff XL", qty: 8, threshold: 2, marca: "Hanes", location: "Bodega Textiles", subcategory: "Uniformes" },
    { name: "Gorra Bordada", qty: 20, threshold: 4, marca: "Generico", location: "Bodega Textiles", subcategory: "Accesorios" },
    { name: "Chaleco Seguridad", qty: 10, threshold: 2, marca: "Truper", location: "Bodega Textiles", subcategory: "Seguridad" },
    { name: "Delantal Cocina", qty: 8, threshold: 2, marca: "Generico", location: "Bodega Textiles", subcategory: "Cocina" },
    { name: "Pantalon Cargo Negro M", qty: 6, threshold: 1, marca: "Generico", location: "Bodega Textiles", subcategory: "Uniformes" },
    { name: "Calcetines Pack x3", qty: 25, threshold: 5, marca: "Fruit of Loom", location: "Bodega Textiles", subcategory: "Ropa Interior" },
    { name: "Cinturon Tactico", qty: 7, threshold: 2, marca: "Generico", location: "Bodega Textiles", subcategory: "Accesorios" },
  ],
  cat_souvenirs: [
    { name: "Taza Ceramica Logo", qty: 30, threshold: 5, marca: "Generico", location: "Vitrina", subcategory: "Tazas" },
    { name: "Vaso Vidrio 300ml", qty: 40, threshold: 8, marca: "Cristar", location: "Vitrina", subcategory: "Cristaleria" },
    { name: "Llavero Acrilico Logo", qty: 60, threshold: 10, marca: "Generico", location: "Mostrador", subcategory: "Llaveros" },
    { name: "Iman Refrigerador", qty: 80, threshold: 15, marca: "Generico", location: "Mostrador", subcategory: "Decoracion" },
    { name: "Bolsa Tote Canvas", qty: 25, threshold: 5, marca: "Generico", location: "Bodega Souvenirs", subcategory: "Bolsas" },
    { name: "Termos Acero 500ml", qty: 15, threshold: 3, marca: "Contigo", location: "Vitrina", subcategory: "Termos" },
    { name: "Plato Decorativo", qty: 12, threshold: 2, marca: "Generico", location: "Vitrina", subcategory: "Cristaleria" },
    { name: "Libreta Personalizada", qty: 35, threshold: 7, marca: "Generico", location: "Mostrador", subcategory: "Papeleria" },
    { name: "Pin Esmaltado", qty: 100, threshold: 20, marca: "Generico", location: "Mostrador", subcategory: "Pins" },
    { name: "Camiseta Souvenir M", qty: 20, threshold: 4, marca: "Generico", location: "Bodega Souvenirs", subcategory: "Ropa" },
  ],
  cat_ti: [
    { name: "Router WiFi 6 TP-Link", qty: 3, threshold: 1, marca: "TP-Link", location: "Rack TI", subcategory: "Red" },
    { name: "Switch 8 puertos", qty: 4, threshold: 1, marca: "Cisco", location: "Rack TI", subcategory: "Red" },
    { name: "UPS 1200VA", qty: 2, threshold: 1, marca: "APC", location: "Rack TI", subcategory: "Energia" },
    { name: "Disco Duro Externo 1TB", qty: 5, threshold: 1, marca: "Seagate", location: "Bodega TI", subcategory: "Almacenamiento" },
    { name: "Raspberry Pi 4 4GB", qty: 4, threshold: 1, marca: "Raspberry", location: "Bodega TI", subcategory: "Computo" },
    { name: "Cable Cat6 100m", qty: 2, threshold: 1, marca: "Nexxt", location: "Bodega TI", subcategory: "Cables" },
    { name: "Patch Panel 24p", qty: 2, threshold: 1, marca: "AMP", location: "Rack TI", subcategory: "Red" },
    { name: "Monitor 24in FHD", qty: 3, threshold: 1, marca: "LG", location: "Oficina TI", subcategory: "Pantallas" },
    { name: "Mini PC Intel N100", qty: 2, threshold: 1, marca: "Beelink", location: "Oficina TI", subcategory: "Computo" },
    { name: "Impresora Etiquetas", qty: 1, threshold: 1, marca: "Zebra", location: "Almacen", subcategory: "Perifericos" },
  ],
  cat_juegos: [
    { name: "Billar Pool Set Completo", qty: 5, threshold: 1, marca: "Brunswick", location: "Area Billar", subcategory: "Billar" },
    { name: "Taco Billar 57in", qty: 16, threshold: 4, marca: "Generico", location: "Area Billar", subcategory: "Billar" },
    { name: "Volante Racing Logitech", qty: 3, threshold: 1, marca: "Logitech", location: "Area Racing", subcategory: "Simuladores" },
    { name: "Control Xbox Series", qty: 8, threshold: 2, marca: "Microsoft", location: "Area Gaming", subcategory: "Consolas" },
    { name: "Dardo Profesional Set", qty: 6, threshold: 2, marca: "Winmau", location: "Area Dardos", subcategory: "Dardos" },
    { name: "Pelota Futbol No.5", qty: 10, threshold: 2, marca: "Adidas", location: "Area Deportes", subcategory: "Deportes" },
    { name: "Raqueta Ping Pong", qty: 8, threshold: 2, marca: "Stiga", location: "Area Ping Pong", subcategory: "Ping Pong" },
    { name: "Pelota Ping Pong x6", qty: 20, threshold: 4, marca: "DHS", location: "Area Ping Pong", subcategory: "Ping Pong" },
    { name: "Boliche Bola 12lb", qty: 6, threshold: 2, marca: "Brunswick", location: "Area Boliche", subcategory: "Boliche" },
    { name: "VR Headset Quest 2", qty: 2, threshold: 1, marca: "Meta", location: "Area VR", subcategory: "VR" },
  ],
  cat_publicidad: [
    { name: "Banner Roll-Up 85x200", qty: 5, threshold: 1, marca: "Generico", location: "Bodega Publicidad", subcategory: "Banners" },
    { name: "Flyer A5 Pack 500", qty: 10, threshold: 2, marca: "Generico", location: "Mostrador", subcategory: "Impresos" },
    { name: "Lona 3x2m", qty: 3, threshold: 1, marca: "Generico", location: "Bodega Publicidad", subcategory: "Lonas" },
    { name: "Globos Logo Pack 100", qty: 8, threshold: 2, marca: "Qualatex", location: "Bodega Publicidad", subcategory: "Globos" },
    { name: "Boligrafo Promo x50", qty: 20, threshold: 4, marca: "Generico", location: "Mostrador", subcategory: "Articulos Promo" },
    { name: "Pulsera Evento x100", qty: 15, threshold: 3, marca: "Generico", location: "Mostrador", subcategory: "Eventos" },
    { name: "Tarjeta Presentacion x250", qty: 12, threshold: 2, marca: "Vistaprint", location: "Recepcion", subcategory: "Impresos" },
    { name: "Carpa Publicidad 3x3m", qty: 2, threshold: 1, marca: "Generico", location: "Bodega Publicidad", subcategory: "Estructuras" },
    { name: "Display Acrilico A4", qty: 10, threshold: 2, marca: "Generico", location: "Mostrador", subcategory: "Displays" },
    { name: "Sticker Vinilo Logo 10cm", qty: 200, threshold: 40, marca: "Generico", location: "Bodega Publicidad", subcategory: "Stickers" },
  ],
};

let total = 0;
for (const [table, items] of Object.entries(seed)) {
  const res = await fetch(`${URL}/${table}`, {
    method: "POST",
    headers,
    body: JSON.stringify(items),
  });
  const text = await res.text();
  if (res.ok) {
    console.log(`✅ ${table} — ${items.length} items (HTTP ${res.status})`);
    total += items.length;
  } else {
    console.error(`❌ ${table} — HTTP ${res.status}: ${text}`);
  }
}
console.log(`\nTotal insertados: ${total}/100`);
