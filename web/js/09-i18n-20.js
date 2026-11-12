// ---------- i18n: 2.0 ----------
Object.assign(UI.it, {
  orderShuffle: 'Ordine casuale delle pagine (nuovo a ogni giro, senza ripetere la stessa due volte di fila)',
  quietInterval: 'Di notte: cambio pagina ogni N minuti (0 = ferma)',
  st_idle: 'schermo aggiornato ({s} s)', st_drawing: 'lo schermo si sta aggiornando…',
  st_old_pools: 'Queste pagine richiedono il firmware 2.0: aggiornalo da Sistema',
  show_dev: 'Mostra sul display', pg_show: 'Mostra subito questa pagina sul display',
  st_show: 'Sul display: {p}', st_show_stale: 'Il display ha altre pagine: premi prima "Invia tutte le pagine"',
  st_show_none: 'Questa pagina non è nella rotazione',
  sy_fw_part: 'Questa scheda ha la vecchia tabella delle partizioni: per avere lo spazio della 2.0 serve un flash completo (file factory o installer web).',
});
Object.assign(UI.en, {
  orderShuffle: 'Pages in random order (a new one every round, never the same page twice in a row)',
  quietInterval: 'At night: change page every N minutes (0 = stay)',
  st_idle: 'screen updated ({s} s)', st_drawing: 'the screen is updating…',
  st_old_pools: 'These pages need firmware 2.0: update it from System',
  show_dev: 'Show on the display', pg_show: 'Show this page on the display now',
  st_show: 'On the display: {p}', st_show_stale: 'The display holds other pages: press "Send all pages" first',
  st_show_none: 'This page is not in the rotation',
  sy_fw_part: 'This board has the old partition table: to get the 2.0 space it needs a full flash (factory file or web installer).',
});
Object.assign(UI.es, {
  orderShuffle: 'Páginas en orden aleatorio (uno nuevo en cada vuelta, nunca la misma página dos veces seguidas)',
  quietInterval: 'De noche: cambiar de página cada N minutos (0 = quieta)',
  st_idle: 'pantalla actualizada ({s} s)', st_drawing: 'la pantalla se está actualizando…',
  st_old_pools: 'Estas páginas necesitan el firmware 2.0: actualízalo desde Sistema',
  show_dev: 'Mostrar en la pantalla', pg_show: 'Mostrar ahora esta página en la pantalla',
  st_show: 'En la pantalla: {p}', st_show_stale: 'La pantalla tiene otras páginas: pulsa antes "Enviar todas las páginas"',
  st_show_none: 'Esta página no está en la rotación',
  sy_fw_part: 'Esta placa tiene la tabla de particiones antigua: para tener el espacio de la 2.0 hace falta un flasheo completo (archivo factory o instalador web).',
});
Object.assign(UI.fr, {
  orderShuffle: 'Pages dans un ordre aléatoire (nouveau à chaque tour, jamais la même page deux fois de suite)',
  quietInterval: 'La nuit : changer de page toutes les N minutes (0 = fixe)',
  st_idle: 'écran mis à jour ({s} s)', st_drawing: 'l\'écran se met à jour…',
  st_old_pools: 'Ces pages nécessitent le firmware 2.0 : mettez-le à jour depuis Système',
  show_dev: 'Afficher sur l\'écran', pg_show: 'Afficher cette page sur l\'écran maintenant',
  st_show: 'Sur l\'écran : {p}', st_show_stale: 'L\'écran contient d\'autres pages : appuyez d\'abord sur « Envoyer toutes les pages »',
  st_show_none: 'Cette page n\'est pas dans la rotation',
  sy_fw_part: 'Cette carte a l\'ancienne table de partitions : pour avoir l\'espace de la 2.0, il faut un flash complet (fichier factory ou installateur web).',
});
Object.assign(UI.de, {
  orderShuffle: 'Seiten in zufälliger Reihenfolge (jede Runde neu, nie zweimal hintereinander dieselbe Seite)',
  quietInterval: 'Nachts: Seite alle N Minuten wechseln (0 = bleibt)',
  st_idle: 'Bildschirm aktualisiert ({s} s)', st_drawing: 'der Bildschirm wird aktualisiert…',
  st_old_pools: 'Diese Seiten brauchen Firmware 2.0: über System aktualisieren',
  show_dev: 'Auf dem Display zeigen', pg_show: 'Diese Seite jetzt auf dem Display zeigen',
  st_show: 'Auf dem Display: {p}', st_show_stale: 'Das Display hat andere Seiten: zuerst „Alle Seiten senden“ drücken',
  st_show_none: 'Diese Seite ist nicht in der Rotation',
  sy_fw_part: 'Dieses Board hat die alte Partitionstabelle: für den Platz von 2.0 ist ein vollständiges Flashen nötig (Factory-Datei oder Web-Installer).',
});

// pages added in 2.0 (settings, buttons) — UI
Object.assign(UI.it, {
  g_shiny: 'Caccia shiny', pg_whosthat: 'Chi è quel Pokémon?', pg_shiny: 'Contatore shiny', pg_dexprog: 'Progresso Pokédex', pg_itemday: 'Strumento del giorno',
  wtpCount: 'Chi è quel Pokémon?: quanti nel gruppo (1-14)', itemKind: 'Strumento del giorno: tipo', ik_item: 'Strumenti', ik_berry: 'Bacche',
  itemCount: 'Strumento del giorno: quanti nel gruppo (1-14)', dexScope: 'Progresso Pokédex: quale', ds_national: 'Nazionale (1-1025)', ds_gen: 'Generazione {g}',
  dexUseCol: 'Conta anche i Pokémon di collezione, scheda e squadra', dexCaught: 'Progresso Pokédex: numeri presi (es. 1-151, 155, 200-210)',
  shTarget: 'Pokémon cercato (n° Pokédex; vuoto = quello della scheda)', shOdds: 'Probabilità',
  so_4096: '1/4096 (gen 6+)', so_8192: '1/8192 (gen 2-5)', so_1365: '1/1365 (Cromamuleto)', so_683: '1/683 (Masuda)', so_512: '1/512 (Masuda + Cromamuleto)', so_1024: '1/1024 (concatena / bonus)', so_2731: '1/2731 (Cromamuleto, gen 5)',
  shMethod: 'Metodo (testo libero, es. Masuda · Scarlatto)', shPhases: 'Fasi / note (es. fase 2: Gloom)',
  ba_4: 'Contatore shiny +1', ba_5: 'Contatore shiny −1',
  sc_set: 'Imposta', sc_reset: 'Azzera', sc_reset_c: 'Azzerare il contatore shiny?',
  sc_info: 'Il conteggio è salvato sulla board: con Display → Pulsante → "Contatore shiny +1" lo aumenti senza aprire questa pagina, e il numero sullo schermo si aggiorna da solo.',
  sc_nodev: 'Nessun display collegato: il conteggio resta in questo browser e si vede solo nell\'anteprima.',
});
Object.assign(UI.en, {
  g_shiny: 'Shiny hunt', pg_whosthat: 'Who\'s that Pokémon?', pg_shiny: 'Shiny counter', pg_dexprog: 'Pokédex progress', pg_itemday: 'Item of the day',
  wtpCount: 'Who\'s that Pokémon?: how many in the pool (1-14)', itemKind: 'Item of the day: kind', ik_item: 'Items', ik_berry: 'Berries',
  itemCount: 'Item of the day: how many in the pool (1-14)', dexScope: 'Pokédex progress: which', ds_national: 'National (1-1025)', ds_gen: 'Generation {g}',
  dexUseCol: 'Also count the Pokémon of the collection, the card and the team', dexCaught: 'Pokédex progress: numbers caught (e.g. 1-151, 155, 200-210)',
  shTarget: 'Target Pokémon (Pokédex no.; empty = the one on the card)', shOdds: 'Odds',
  so_4096: '1/4096 (gen 6+)', so_8192: '1/8192 (gen 2-5)', so_1365: '1/1365 (Shiny Charm)', so_683: '1/683 (Masuda)', so_512: '1/512 (Masuda + Charm)', so_1024: '1/1024 (chain / bonus)', so_2731: '1/2731 (Shiny Charm, gen 5)',
  shMethod: 'Method (free text, e.g. Masuda · Scarlet)', shPhases: 'Phases / notes (e.g. phase 2: Gloom)',
  ba_4: 'Shiny counter +1', ba_5: 'Shiny counter −1',
  sc_set: 'Set', sc_reset: 'Reset', sc_reset_c: 'Reset the shiny counter?',
  sc_info: 'The count is kept on the board: with Display → Button → "Shiny counter +1" you add encounters without opening this page, and the number on screen updates by itself.',
  sc_nodev: 'No display connected: the count stays in this browser and only shows in the preview.',
});
Object.assign(UI.es, {
  g_shiny: 'Caza shiny', pg_whosthat: '¿Quién es ese Pokémon?', pg_shiny: 'Contador shiny', pg_dexprog: 'Progreso de la Pokédex', pg_itemday: 'Objeto del día',
  wtpCount: '¿Quién es ese Pokémon?: cuántos en el grupo (1-14)', itemKind: 'Objeto del día: tipo', ik_item: 'Objetos', ik_berry: 'Bayas',
  itemCount: 'Objeto del día: cuántos en el grupo (1-14)', dexScope: 'Progreso de la Pokédex: cuál', ds_national: 'Nacional (1-1025)', ds_gen: 'Generación {g}',
  dexUseCol: 'Contar también los Pokémon de la colección, la ficha y el equipo', dexCaught: 'Progreso de la Pokédex: números capturados (p. ej. 1-151, 155, 200-210)',
  shTarget: 'Pokémon buscado (n.º Pokédex; vacío = el de la ficha)', shOdds: 'Probabilidad',
  so_4096: '1/4096 (gen 6+)', so_8192: '1/8192 (gen 2-5)', so_1365: '1/1365 (Amuleto iris)', so_683: '1/683 (Masuda)', so_512: '1/512 (Masuda + Amuleto)', so_1024: '1/1024 (cadena / bonus)', so_2731: '1/2731 (Amuleto iris, gen 5)',
  shMethod: 'Método (texto libre, p. ej. Masuda · Escarlata)', shPhases: 'Fases / notas (p. ej. fase 2: Gloom)',
  ba_4: 'Contador shiny +1', ba_5: 'Contador shiny −1',
  sc_set: 'Fijar', sc_reset: 'Poner a cero', sc_reset_c: '¿Poner a cero el contador shiny?',
  sc_info: 'La cuenta se guarda en la placa: con Pantalla → Botón → "Contador shiny +1" sumas encuentros sin abrir esta página, y el número en pantalla se actualiza solo.',
  sc_nodev: 'Ninguna pantalla conectada: la cuenta se queda en este navegador y solo se ve en la vista previa.',
});
Object.assign(UI.fr, {
  g_shiny: 'Chasse au shiny', pg_whosthat: 'Quel est ce Pokémon ?', pg_shiny: 'Compteur shiny', pg_dexprog: 'Progression du Pokédex', pg_itemday: 'Objet du jour',
  wtpCount: 'Quel est ce Pokémon ? : combien dans le groupe (1-14)', itemKind: 'Objet du jour : type', ik_item: 'Objets', ik_berry: 'Baies',
  itemCount: 'Objet du jour : combien dans le groupe (1-14)', dexScope: 'Progression du Pokédex : lequel', ds_national: 'National (1-1025)', ds_gen: 'Génération {g}',
  dexUseCol: 'Compter aussi les Pokémon de la collection, de la fiche et de l\'équipe', dexCaught: 'Progression du Pokédex : numéros capturés (p. ex. 1-151, 155, 200-210)',
  shTarget: 'Pokémon recherché (n° Pokédex ; vide = celui de la fiche)', shOdds: 'Probabilité',
  so_4096: '1/4096 (gén. 6+)', so_8192: '1/8192 (gén. 2-5)', so_1365: '1/1365 (Charme Chroma)', so_683: '1/683 (Masuda)', so_512: '1/512 (Masuda + Charme)', so_1024: '1/1024 (chaîne / bonus)', so_2731: '1/2731 (Charme Chroma, gén. 5)',
  shMethod: 'Méthode (texte libre, p. ex. Masuda · Écarlate)', shPhases: 'Phases / notes (p. ex. phase 2 : Ortide)',
  ba_4: 'Compteur shiny +1', ba_5: 'Compteur shiny −1',
  sc_set: 'Définir', sc_reset: 'Remettre à zéro', sc_reset_c: 'Remettre le compteur shiny à zéro ?',
  sc_info: 'Le compte est gardé sur la carte : avec Écran → Bouton → « Compteur shiny +1 » vous ajoutez des rencontres sans ouvrir cette page, et le nombre à l\'écran se met à jour tout seul.',
  sc_nodev: 'Aucun écran connecté : le compte reste dans ce navigateur et ne se voit que dans l\'aperçu.',
});
Object.assign(UI.de, {
  g_shiny: 'Shiny-Jagd', pg_whosthat: 'Wer ist das Pokémon?', pg_shiny: 'Shiny-Zähler', pg_dexprog: 'Pokédex-Fortschritt', pg_itemday: 'Item des Tages',
  wtpCount: 'Wer ist das Pokémon?: wie viele in der Gruppe (1-14)', itemKind: 'Item des Tages: Art', ik_item: 'Items', ik_berry: 'Beeren',
  itemCount: 'Item des Tages: wie viele in der Gruppe (1-14)', dexScope: 'Pokédex-Fortschritt: welcher', ds_national: 'National (1-1025)', ds_gen: 'Generation {g}',
  dexUseCol: 'Auch die Pokémon aus Sammlung, Karte und Team zählen', dexCaught: 'Pokédex-Fortschritt: gefangene Nummern (z. B. 1-151, 155, 200-210)',
  shTarget: 'Gesuchtes Pokémon (Pokédex-Nr.; leer = das der Karte)', shOdds: 'Chance',
  so_4096: '1/4096 (Gen 6+)', so_8192: '1/8192 (Gen 2-5)', so_1365: '1/1365 (Schillerpin)', so_683: '1/683 (Masuda)', so_512: '1/512 (Masuda + Schillerpin)', so_1024: '1/1024 (Kette / Bonus)', so_2731: '1/2731 (Schillerpin, Gen 5)',
  shMethod: 'Methode (freier Text, z. B. Masuda · Karmesin)', shPhases: 'Phasen / Notizen (z. B. Phase 2: Duflor)',
  ba_4: 'Shiny-Zähler +1', ba_5: 'Shiny-Zähler −1',
  sc_set: 'Setzen', sc_reset: 'Zurücksetzen', sc_reset_c: 'Shiny-Zähler zurücksetzen?',
  sc_info: 'Der Zählerstand liegt auf dem Board: mit Display → Taste → „Shiny-Zähler +1“ zählst du Begegnungen, ohne diese Seite zu öffnen, und die Zahl auf dem Bildschirm aktualisiert sich selbst.',
  sc_nodev: 'Kein Display verbunden: der Zählerstand bleibt in diesem Browser und ist nur in der Vorschau zu sehen.',
});

// pages added in 2.0 — on the e-paper
Object.assign(DISP.it, {whosthat: 'Chi è?', wtp_q: 'Chi è quel Pokémon?', wtp_a: 'È {n}!', shiny: 'Caccia shiny', sh_count: 'Incontri', sh_chance: 'Probabilità di averlo già trovato', sh_odds: 'Probabilità',
  dexprog: 'Pokédex', dex_nat: 'Pokédex nazionale', dex_gen: 'Generazione {g}', itemday: 'Del giorno', it_cat: 'Categoria', it_firm: 'Consistenza', it_size: 'Dimensione', it_grow: 'Crescita', it_cost: 'Prezzo', it_fling: 'Potenza lancio'});
Object.assign(DISP.en, {whosthat: 'Who is it?', wtp_q: 'Who\'s that Pokémon?', wtp_a: 'It\'s {n}!', shiny: 'Shiny hunt', sh_count: 'Encounters', sh_chance: 'Chance it should have shown up', sh_odds: 'Odds',
  dexprog: 'Pokédex', dex_nat: 'National Pokédex', dex_gen: 'Generation {g}', itemday: 'Of the day', it_cat: 'Category', it_firm: 'Firmness', it_size: 'Size', it_grow: 'Growth', it_cost: 'Price', it_fling: 'Fling power'});
Object.assign(DISP.es, {whosthat: '¿Quién es?', wtp_q: '¿Quién es ese Pokémon?', wtp_a: '¡Es {n}!', shiny: 'Caza shiny', sh_count: 'Encuentros', sh_chance: 'Probabilidad de haberlo encontrado', sh_odds: 'Probabilidad',
  dexprog: 'Pokédex', dex_nat: 'Pokédex Nacional', dex_gen: 'Generación {g}', itemday: 'Del día', it_cat: 'Categoría', it_firm: 'Firmeza', it_size: 'Tamaño', it_grow: 'Crecimiento', it_cost: 'Precio', it_fling: 'Potencia lanzar'});
Object.assign(DISP.fr, {whosthat: 'Qui est-ce ?', wtp_q: 'Quel est ce Pokémon ?', wtp_a: 'C\'est {n} !', shiny: 'Chasse shiny', sh_count: 'Rencontres', sh_chance: 'Chance de l\'avoir déjà trouvé', sh_odds: 'Probabilité',
  dexprog: 'Pokédex', dex_nat: 'Pokédex national', dex_gen: 'Génération {g}', itemday: 'Du jour', it_cat: 'Catégorie', it_firm: 'Fermeté', it_size: 'Taille', it_grow: 'Croissance', it_cost: 'Prix', it_fling: 'Puissance Dégommage'});
Object.assign(DISP.de, {whosthat: 'Wer ist das?', wtp_q: 'Wer ist das Pokémon?', wtp_a: 'Es ist {n}!', shiny: 'Shiny-Jagd', sh_count: 'Begegnungen', sh_chance: 'Chance, es schon gefunden zu haben', sh_odds: 'Chance',
  dexprog: 'Pokédex', dex_nat: 'Nationaler Pokédex', dex_gen: 'Generation {g}', itemday: 'Des Tages', it_cat: 'Kategorie', it_firm: 'Festigkeit', it_size: 'Größe', it_grow: 'Wachstum', it_cost: 'Preis', it_fling: 'Schleuder-Stärke'});

// split screen and your images
Object.assign(UI.it, {
  g_split: 'Schermo diviso', g_gallery: 'Immagini', pg_split: 'Schermo diviso', pg_images: 'Le tue immagini',
  splitLayout: 'Disposizione', sl_h2: '2 affiancati', sl_v2: '2 uno sopra l\'altro', sl_q4: '4 riquadri', splitTitle: 'Titolo (vuoto = nome del Pokémon)', splitW: 'Riquadro {n}',
  sw_sprite: 'Sprite', sw_days: 'Giorni insieme', sw_countdown: 'Conto alla rovescia', sw_shiny: 'Contatore shiny', sw_team: 'Squadra', sw_dexprog: 'Progresso Pokédex', sw_stats: 'Statistiche', sw_none: 'Vuoto',
  im_info: 'Le immagini vengono salvate sul display (400×300, ~30 KB l\'una) e la pagina "Le tue immagini" ne mostra una nuova ogni volta che torna nella rotazione.',
  im_up: 'Aggiungi immagini…', im_caption: 'Didascalia (facoltativa)', im_cover: 'Riempie (ritaglia)', im_contain: 'Intera (bordi bianchi)',
  im_none: 'Nessuna immagine: aggiungile nella sezione Immagini', im_nodev: 'Collega il display: le immagini vengono salvate lì',
});
Object.assign(UI.en, {
  g_split: 'Split screen', g_gallery: 'Images', pg_split: 'Split screen', pg_images: 'Your images',
  splitLayout: 'Layout', sl_h2: '2 side by side', sl_v2: '2 stacked', sl_q4: '4 boxes', splitTitle: 'Title (empty = the Pokémon\'s name)', splitW: 'Box {n}',
  sw_sprite: 'Sprite', sw_days: 'Days together', sw_countdown: 'Countdown', sw_shiny: 'Shiny counter', sw_team: 'Team', sw_dexprog: 'Pokédex progress', sw_stats: 'Stats', sw_none: 'Empty',
  im_info: 'Pictures are stored on the display (400×300, ~30 KB each) and the "Your images" page shows a new one every time it comes back in the rotation.',
  im_up: 'Add pictures…', im_caption: 'Caption (optional)', im_cover: 'Fill (crop)', im_contain: 'Whole (white borders)',
  im_none: 'No pictures: add them in the Images section', im_nodev: 'Connect the display: pictures are stored there',
});
Object.assign(UI.es, {
  g_split: 'Pantalla dividida', g_gallery: 'Imágenes', pg_split: 'Pantalla dividida', pg_images: 'Tus imágenes',
  splitLayout: 'Disposición', sl_h2: '2 lado a lado', sl_v2: '2 uno sobre otro', sl_q4: '4 recuadros', splitTitle: 'Título (vacío = nombre del Pokémon)', splitW: 'Recuadro {n}',
  sw_sprite: 'Sprite', sw_days: 'Días juntos', sw_countdown: 'Cuenta atrás', sw_shiny: 'Contador shiny', sw_team: 'Equipo', sw_dexprog: 'Progreso de la Pokédex', sw_stats: 'Características', sw_none: 'Vacío',
  im_info: 'Las imágenes se guardan en la pantalla (400×300, ~30 KB cada una) y la página "Tus imágenes" muestra una nueva cada vez que vuelve a la rotación.',
  im_up: 'Añadir imágenes…', im_caption: 'Pie de foto (opcional)', im_cover: 'Rellenar (recortar)', im_contain: 'Entera (bordes blancos)',
  im_none: 'Sin imágenes: añádelas en la sección Imágenes', im_nodev: 'Conecta la pantalla: las imágenes se guardan allí',
});
Object.assign(UI.fr, {
  g_split: 'Écran partagé', g_gallery: 'Images', pg_split: 'Écran partagé', pg_images: 'Vos images',
  splitLayout: 'Disposition', sl_h2: '2 côte à côte', sl_v2: '2 l\'un sur l\'autre', sl_q4: '4 cases', splitTitle: 'Titre (vide = nom du Pokémon)', splitW: 'Case {n}',
  sw_sprite: 'Sprite', sw_days: 'Jours ensemble', sw_countdown: 'Compte à rebours', sw_shiny: 'Compteur shiny', sw_team: 'Équipe', sw_dexprog: 'Progression du Pokédex', sw_stats: 'Statistiques', sw_none: 'Vide',
  im_info: 'Les images sont gardées sur l\'écran (400×300, ~30 Ko chacune) et la page « Vos images » en montre une nouvelle à chaque retour dans la rotation.',
  im_up: 'Ajouter des images…', im_caption: 'Légende (facultative)', im_cover: 'Remplir (recadrer)', im_contain: 'Entière (bords blancs)',
  im_none: 'Pas d\'images : ajoutez-les dans la section Images', im_nodev: 'Connectez l\'écran : les images y sont gardées',
});
Object.assign(UI.de, {
  g_split: 'Geteilter Bildschirm', g_gallery: 'Bilder', pg_split: 'Geteilter Bildschirm', pg_images: 'Deine Bilder',
  splitLayout: 'Aufteilung', sl_h2: '2 nebeneinander', sl_v2: '2 übereinander', sl_q4: '4 Felder', splitTitle: 'Titel (leer = Name des Pokémon)', splitW: 'Feld {n}',
  sw_sprite: 'Sprite', sw_days: 'Tage zusammen', sw_countdown: 'Countdown', sw_shiny: 'Shiny-Zähler', sw_team: 'Team', sw_dexprog: 'Pokédex-Fortschritt', sw_stats: 'Statuswerte', sw_none: 'Leer',
  im_info: 'Bilder werden auf dem Display gespeichert (400×300, ~30 KB pro Bild) und die Seite „Deine Bilder“ zeigt jedes Mal ein neues, wenn sie in der Rotation wiederkommt.',
  im_up: 'Bilder hinzufügen…', im_caption: 'Bildunterschrift (optional)', im_cover: 'Füllen (zuschneiden)', im_contain: 'Ganz (weiße Ränder)',
  im_none: 'Keine Bilder: füge sie im Bereich Bilder hinzu', im_nodev: 'Verbinde das Display: dort werden die Bilder gespeichert',
});
Object.assign(DISP.it, {split: '', images: ''});
Object.assign(DISP.en, {split: '', images: ''});
Object.assign(DISP.es, {split: '', images: ''});
Object.assign(DISP.fr, {split: '', images: ''});
Object.assign(DISP.de, {split: '', images: ''});

Object.assign(UI.it, {pn_spectra73: '7,3" 6 colori (800×480)'});
Object.assign(UI.en, {pn_spectra73: '7.3" 6 colours (800×480)'});
Object.assign(UI.es, {pn_spectra73: '7,3" 6 colores (800×480)'});
Object.assign(UI.fr, {pn_spectra73: '7,3" 6 couleurs (800×480)'});
Object.assign(UI.de, {pn_spectra73: '7,3" 6 Farben (800×480)'});
