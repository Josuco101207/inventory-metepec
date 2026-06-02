-- ============================================================
-- SEED DATA - 10 items por categoría
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Insumos y Papelería
INSERT INTO public.cat_insumos (name, qty, threshold, marca, location, subcategory) VALUES
  ('Papel Bond A4', 50, 10, 'Repro', 'Bodega A', 'Papel'),
  ('Carpetas Manila', 30, 5, 'Generico', 'Bodega A', 'Archivero'),
  ('Boligrafos Azul', 100, 20, 'BIC', 'Escritorio', 'Escritura'),
  ('Cinta Adhesiva', 40, 8, 'Scotch', 'Bodega A', 'Adhesivos'),
  ('Grapadoras', 15, 3, 'Rapid', 'Bodega A', 'Herramienta Oficina'),
  ('Grapas Caja', 60, 10, 'Rapid', 'Bodega A', 'Herramienta Oficina'),
  ('Marcadores Permanentes', 25, 5, 'Sharpie', 'Escritorio', 'Escritura'),
  ('Folders Colgantes', 20, 5, 'Generico', 'Bodega A', 'Archivero'),
  ('Tijeras', 10, 2, 'Fiskars', 'Escritorio', 'Corte'),
  ('Post-it Notas', 35, 5, '3M', 'Escritorio', 'Papel');

-- 2. Repuestos Arcades
INSERT INTO public.cat_repuestos_arcades (name, qty, threshold, marca, location, subcategory) VALUES
  ('Joystick Sanwa JLF', 12, 3, 'Sanwa', 'Almacen Arcades', 'Controles'),
  ('Boton 30mm Rojo', 50, 10, 'Seimitsu', 'Almacen Arcades', 'Botones'),
  ('Boton 30mm Azul', 50, 10, 'Seimitsu', 'Almacen Arcades', 'Botones'),
  ('PCB JAMMA', 5, 1, 'Generico', 'Almacen Arcades', 'Electronica'),
  ('Monitor CRT 25in', 3, 1, 'Wells Gardner', 'Almacen Arcades', 'Pantallas'),
  ('Fuente 12V Arcade', 8, 2, 'Happ', 'Almacen Arcades', 'Energia'),
  ('Cable Harness JAMMA', 10, 2, 'Generico', 'Almacen Arcades', 'Cables'),
  ('Trackball 3in', 4, 1, 'Happ', 'Almacen Arcades', 'Controles'),
  ('Speaker 4in 8ohm', 15, 3, 'Generico', 'Almacen Arcades', 'Audio'),
  ('Monedero Acceptor', 6, 2, 'Coin Controls', 'Almacen Arcades', 'Monedero');

-- 3. Premios y Juguetes
INSERT INTO public.cat_premios (name, qty, threshold, marca, location, subcategory) VALUES
  ('Pelota Antiestres', 80, 15, 'Generico', 'Bodega Premios', 'Juguetes'),
  ('Yoyo Plastico', 60, 10, 'Generico', 'Bodega Premios', 'Juguetes'),
  ('Muneco Peluche Pequeno', 40, 8, 'Generico', 'Bodega Premios', 'Peluches'),
  ('Calcomania Pack', 100, 20, 'Generico', 'Bodega Premios', 'Stickers'),
  ('Llavero Figura', 70, 10, 'Generico', 'Bodega Premios', 'Accesorios'),
  ('Slime Colores', 50, 10, 'Generico', 'Bodega Premios', 'Juguetes'),
  ('Carta Pokemon Promo', 30, 5, 'Nintendo', 'Bodega Premios', 'Cartas'),
  ('Pulsera Silicona', 90, 15, 'Generico', 'Bodega Premios', 'Accesorios'),
  ('Mini Rompecabezas', 25, 5, 'Generico', 'Bodega Premios', 'Juegos'),
  ('Trompo Clasico', 45, 8, 'Generico', 'Bodega Premios', 'Juguetes');

-- 4. Electronica y Gadgets
INSERT INTO public.cat_electronica (name, qty, threshold, marca, location, subcategory) VALUES
  ('Cable HDMI 2m', 20, 4, 'Ugreen', 'Bodega TI', 'Cables'),
  ('Cargador USB-C 65W', 15, 3, 'Anker', 'Bodega TI', 'Cargadores'),
  ('Mouse Inalambrico', 10, 2, 'Logitech', 'Bodega TI', 'Perifericos'),
  ('Teclado USB', 8, 2, 'HP', 'Bodega TI', 'Perifericos'),
  ('Hub USB 4 puertos', 12, 3, 'Anker', 'Bodega TI', 'Conectividad'),
  ('Memoria USB 32GB', 25, 5, 'Kingston', 'Bodega TI', 'Almacenamiento'),
  ('Adaptador HDMI-VGA', 10, 2, 'Ugreen', 'Bodega TI', 'Adaptadores'),
  ('Regleta 6 tomas', 7, 2, 'Belkin', 'Bodega TI', 'Energia'),
  ('Audifonos On-Ear', 5, 1, 'Sony', 'Bodega TI', 'Audio'),
  ('Lampara LED USB', 18, 4, 'Generico', 'Bodega TI', 'Iluminacion');

-- 5. Alimentos y Dulceria
INSERT INTO public.cat_alimentos (name, qty, threshold, marca, location, subcategory) VALUES
  ('Refresco Coca-Cola 600ml', 120, 24, 'Coca-Cola', 'Refrigerador', 'Bebidas'),
  ('Agua 500ml', 200, 40, 'Bonafont', 'Almacen Alimentos', 'Bebidas'),
  ('Papas Sabritas 45g', 80, 15, 'Sabritas', 'Almacen Alimentos', 'Snacks'),
  ('Palomitas Microondas', 60, 12, 'Pop Secret', 'Almacen Alimentos', 'Snacks'),
  ('Chicles Pelon Pelo Rico', 150, 30, 'Boing', 'Mostrador', 'Dulceria'),
  ('Chocolate Snickers', 90, 18, 'Mars', 'Mostrador', 'Dulceria'),
  ('Jugo Del Valle 250ml', 100, 20, 'Del Valle', 'Refrigerador', 'Bebidas'),
  ('Galletas Oreo', 70, 14, 'Nabisco', 'Almacen Alimentos', 'Snacks'),
  ('Paleta Payaso', 200, 40, 'Ricolino', 'Mostrador', 'Dulceria'),
  ('Gansito', 50, 10, 'Marinela', 'Mostrador', 'Snacks');

-- 6. Textiles y Uniformes
INSERT INTO public.cat_textiles (name, qty, threshold, marca, location, subcategory) VALUES
  ('Playera Polo Staff S', 10, 2, 'Hanes', 'Bodega Textiles', 'Uniformes'),
  ('Playera Polo Staff M', 15, 3, 'Hanes', 'Bodega Textiles', 'Uniformes'),
  ('Playera Polo Staff L', 12, 3, 'Hanes', 'Bodega Textiles', 'Uniformes'),
  ('Playera Polo Staff XL', 8, 2, 'Hanes', 'Bodega Textiles', 'Uniformes'),
  ('Gorra Bordada', 20, 4, 'Generico', 'Bodega Textiles', 'Accesorios'),
  ('Chaleco Seguridad', 10, 2, 'Truper', 'Bodega Textiles', 'Seguridad'),
  ('Delantal Cocina', 8, 2, 'Generico', 'Bodega Textiles', 'Cocina'),
  ('Pantalon Cargo Negro M', 6, 1, 'Generico', 'Bodega Textiles', 'Uniformes'),
  ('Calcetines Pack x3', 25, 5, 'Fruit of Loom', 'Bodega Textiles', 'Ropa Interior'),
  ('Cinturon Tactico', 7, 2, 'Generico', 'Bodega Textiles', 'Accesorios');

-- 7. Cristaleria y Souvenirs
INSERT INTO public.cat_souvenirs (name, qty, threshold, marca, location, subcategory) VALUES
  ('Taza Ceramica Logo', 30, 5, 'Generico', 'Vitrina', 'Tazas'),
  ('Vaso Vidrio 300ml', 40, 8, 'Cristar', 'Vitrina', 'Cristaleria'),
  ('Llavero Acrilico Logo', 60, 10, 'Generico', 'Mostrador', 'Llaveros'),
  ('Iman Refrigerador', 80, 15, 'Generico', 'Mostrador', 'Decoracion'),
  ('Bolsa Tote Canvas', 25, 5, 'Generico', 'Bodega Souvenirs', 'Bolsas'),
  ('Termos Acero 500ml', 15, 3, 'Contigo', 'Vitrina', 'Termos'),
  ('Plato Decorativo', 12, 2, 'Generico', 'Vitrina', 'Cristaleria'),
  ('Libreta Personalizada', 35, 7, 'Generico', 'Mostrador', 'Papeleria'),
  ('Pin Esmaltado', 100, 20, 'Generico', 'Mostrador', 'Pins'),
  ('Camiseta Souvenir M', 20, 4, 'Generico', 'Bodega Souvenirs', 'Ropa');

-- 8. Infraestructura y TI
INSERT INTO public.cat_ti (name, qty, threshold, marca, location, subcategory) VALUES
  ('Router WiFi 6 TP-Link', 3, 1, 'TP-Link', 'Rack TI', 'Red'),
  ('Switch 8 puertos', 4, 1, 'Cisco', 'Rack TI', 'Red'),
  ('UPS 1200VA', 2, 1, 'APC', 'Rack TI', 'Energia'),
  ('Disco Duro Externo 1TB', 5, 1, 'Seagate', 'Bodega TI', 'Almacenamiento'),
  ('Raspberry Pi 4 4GB', 4, 1, 'Raspberry', 'Bodega TI', 'Computo'),
  ('Cable Cat6 100m', 2, 1, 'Nexxt', 'Bodega TI', 'Cables'),
  ('Patch Panel 24p', 2, 1, 'AMP', 'Rack TI', 'Red'),
  ('Monitor 24in FHD', 3, 1, 'LG', 'Oficina TI', 'Pantallas'),
  ('Mini PC Intel N100', 2, 1, 'Beelink', 'Oficina TI', 'Computo'),
  ('Impresora Etiquetas', 1, 1, 'Zebra', 'Almacen', 'Perifericos');

-- 9. Juegos y Entretenimiento
INSERT INTO public.cat_juegos (name, qty, threshold, marca, location, subcategory) VALUES
  ('Billar Pool Set Completo', 5, 1, 'Brunswick', 'Area Billar', 'Billar'),
  ('Taco Billar 57in', 16, 4, 'Generico', 'Area Billar', 'Billar'),
  ('Volante Racing Logitech', 3, 1, 'Logitech', 'Area Racing', 'Simuladores'),
  ('Control Xbox Series', 8, 2, 'Microsoft', 'Area Gaming', 'Consolas'),
  ('Dardo Profesional Set', 6, 2, 'Winmau', 'Area Dardos', 'Dardos'),
  ('Pelota Futbol No.5', 10, 2, 'Adidas', 'Area Deportes', 'Deportes'),
  ('Raqueta Ping Pong', 8, 2, 'Stiga', 'Area Ping Pong', 'Ping Pong'),
  ('Pelota Ping Pong x6', 20, 4, 'DHS', 'Area Ping Pong', 'Ping Pong'),
  ('Boliche Bola 12lb', 6, 2, 'Brunswick', 'Area Boliche', 'Boliche'),
  ('VR Headset Quest 2', 2, 1, 'Meta', 'Area VR', 'VR');

-- 10. Promocionales
INSERT INTO public.cat_publicidad (name, qty, threshold, marca, location, subcategory) VALUES
  ('Banner Roll-Up 85x200', 5, 1, 'Generico', 'Bodega Publicidad', 'Banners'),
  ('Flyer A5 Pack 500', 10, 2, 'Generico', 'Mostrador', 'Impresos'),
  ('Lona 3x2m', 3, 1, 'Generico', 'Bodega Publicidad', 'Lonas'),
  ('Globos Logo Pack 100', 8, 2, 'Qualatex', 'Bodega Publicidad', 'Globos'),
  ('Boligrafo Promo x50', 20, 4, 'Generico', 'Mostrador', 'Articulos Promo'),
  ('Pulsera Evento x100', 15, 3, 'Generico', 'Mostrador', 'Eventos'),
  ('Tarjeta Presentacion x250', 12, 2, 'Vistaprint', 'Recepcion', 'Impresos'),
  ('Carpa Publicidad 3x3m', 2, 1, 'Generico', 'Bodega Publicidad', 'Estructuras'),
  ('Display Acrilico A4', 10, 2, 'Generico', 'Mostrador', 'Displays'),
  ('Sticker Vinilo Logo 10cm', 200, 40, 'Generico', 'Bodega Publicidad', 'Stickers');
