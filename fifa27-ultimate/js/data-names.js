/* =====================================================================
   data-names.js — Datos del mundo ficticio
   Culturas de nombres, 32 naciones ficticias (selecciones del Mundial),
   y definición de ligas y clubes ficticios.
   Todo es original: ningún club, selección ni jugador real.
   ===================================================================== */
(function (root) {
  'use strict';
  const G = root.G = root.G || {};
  const w = s => s.trim().split(/\s+/);

  /* ---------- Culturas de nombres: [nombres, apellidos] ---------- */
  const CULTURES = {
    iberic: {
      first: w(`Alejandro Álvaro Andrés Aitor Bruno Carlos César Cristian Damián Daniel Diego Dídac Eduardo Emilio Enrique Ernesto
        Fabián Felipe Fernando Gabriel Gonzalo Gustavo Héctor Hugo Iker Ismael Ivan Joaquín Jorge Julián Lautaro León Lucas Manuel
        Marcos Mateo Matías Mauro Nicolás Oriol Pablo Rafael Raúl Rodrigo Rubén Samuel Santiago Sergio Tomás Unai Valentín Xavi Yago`),
      last: w(`Aguilar Alcántara Arroyo Barrios Bautista Cabrera Calvo Camacho Cardona Carrasco Castaño Cuesta Delgado Domínguez Escobar
        Espinosa Ferrer Fuentes Galindo Gallego Garrido Ibáñez Iglesias Lara Lozano Maldonado Marín Matos Medrano Montero Nieto
        Olmedo Ordóñez Palacios Pardo Paredes Quintero Rivas Robledo Salgado Segura Solís Tapia Trujillo Uribe Vallejo Vega Zamora`)
    },
    lusophone: {
      first: w(`Adriano Alan Anderson Bernardo Caio Cauã Davi Diogo Eder Emerson Fábio Gil Heitor Henrique Igor Jair Jonas Kauan
        Leandro Lucca Márcio Murilo Nuno Otávio Paulo Péricles Rafael Renan Ricardo Rui Sandro Thiago Tiago Vasco Vítor Wallace Wesley`),
      last: w(`Albuquerque Amaral Antunes Barbosa Batista Bragança Campos Carvalho Cavalcanti Coutinho Duarte Esteves Faria Figueira
        Guedes Henriques Lacerda Macedo Magalhães Medeiros Moura Nogueira Pacheco Peixoto Pimenta Queirós Rangel Sampaio Siqueira
        Tavares Teles Valadares Vasconcelos Viana Xavier`)
    },
    anglo: {
      first: w(`Alfie Archie Barnaby Callum Connor Dexter Elliot Felix Finley Freddie George Harvey Hector Jasper Jensen Jude Kieran
        Lachlan Lewis Mason Miles Nathan Oakley Oscar Owen Reuben Rhys Rory Seth Spencer Toby Tristan Warren Wilfred Zachary`),
      last: w(`Ashworth Barlow Blackwood Bramley Calloway Cartwright Dunmore Elwood Fairfax Gatling Harlow Hartley Kingsley Langdon
        Lockwood Marlowe Merrick Northcott Pemberton Radcliffe Rowntree Sheridan Stanhope Thornley Tunstall Underhill Wexley
        Whitlock Winslow Yarrow`)
    },
    gallic: {
      first: w(`Adrien Alain Antoine Baptiste Clément Corentin Damien Étienne Fabrice Gaël Guillaume Hugues Jérôme Julien Kylian
        Léandre Loïc Maël Maxime Morgan Noé Olivier Quentin Rémi Romain Sacha Théo Valentin Xavier Yann`),
      last: w(`Armand Beaulieu Bouchard Chevalier Delacroix Descamps Dufresne Fontaine Gauthier Girard Lacombe Laurent Lefèvre
        Marchand Mercier Montaigne Moreau Navarre Pelletier Perrin Quesnel Rochefort Sauvage Tessier Vasseur Villeneuve`)
    },
    germanic: {
      first: w(`Anton Armin Björn Dieter Elias Emil Felix Florian Gerrit Hannes Henrik Jannik Jonas Jörg Kai Karsten Lennart Lukas
        Matthias Moritz Niklas Pascal Rainer Sebastian Stefan Tobias Torben Ulrich Viktor Wendel`),
      last: w(`Ackermann Bauer Brandt Eichel Falkner Frankenberg Gärtner Grabner Hartmann Hoffmeister Kessler Kleinert Lindner
        Mahler Neubauer Ostermann Rademacher Reinhardt Schaller Steinmetz Teichmann Voigt Wagner Weidner Ziegler`)
    },
    italic: {
      first: w(`Alessio Andrea Beppe Carmine Cesare Dario Domenico Elio Emanuele Enzo Fabrizio Flavio Gianluca Giulio Ivano Lorenzo
        Luca Marco Mattia Nicola Orazio Paolo Raffaele Riccardo Salvatore Stefano Tommaso Umberto Vito`),
      last: w(`Albertini Bellandi Bruni Cantelli Caruso Colombo Corsetti Dalmasso De Rossi Fabbri Ferraro Fiorentino Galli Giordano
        Iacopetti Landolfi Mancini Morandi Nardone Orsini Pellegrini Ricci Salvatori Tedesco Vitale Zanetti`)
    },
    slavic: {
      first: w(`Aleksandar Bogdan Boris Damir Dragan Dušan Goran Igor Ivo Jakub Jan Kazimir Luka Marek Milan Miloš Mirko Nikola
        Pavel Petar Radek Roman Stanislav Tomáš Vedran Vlad Zoran Zdenko`),
      last: w(`Babić Barta Bogdanović Dvořák Horvat Ilić Jovanović Kolar Kovač Krajina Lazić Marković Novák Pavlović Petrov Popović
        Rakić Sedlák Stojanović Tomić Urban Vasić Vesely Zelenka Žilić`)
    },
    nordic: {
      first: w(`Aksel Anders Bjarne Emil Erik Fredrik Gustav Halvor Henrik Ingvar Jens Joakim Kasper Leif Magnus Mikkel Nils Olav
        Oskar Rasmus Sigurd Sven Thor Tobias Ulf Viggo`),
      last: w(`Aaberg Ahlgren Bergstrøm Dahlgaard Eklund Engström Fjellheim Granlund Haugland Holmgren Iversen Jørgensen Karlsson
        Lindqvist Nordahl Ødegaard Rasmussen Sandvik Skogen Strand Thorsen Vikström Winther`)
    },
    westafrican: {
      first: w(`Abdoulaye Adama Amadou Bakary Boubacar Cheikh Demba Ebrima Femi Ibrahima Idrissa Kofi Kwame Lamine Mamadou Moussa
        Nnamdi Obinna Oumar Samba Seydou Sekou Tunde Yaw Yacouba`),
      last: w(`Adjei Balde Bangoura Camara Cissé Coulibaly Diakité Diallo Diop Fofana Gueye Kamara Keita Konaté Mensah Ndiaye
        Okafor Okonkwo Osei Sarr Sissoko Sylla Toure Traoré Yeboah`)
    },
    arabic: {
      first: w(`Adil Amir Anwar Bilal Dawud Farid Faris Hamza Hassan Idris Ismail Jamal Karim Khalid Mahdi Malik Mansour Nabil
        Omar Rashid Salim Samir Tariq Walid Yusuf Zakaria`),
      last: w(`Al-Amin Al-Farsi Al-Harbi Al-Nasser Amrani Bakr Benali Darwish Fassi Ghannam Haddad Hakim Jabari Kassem Mansouri
        Mahrez Nouri Qadir Rahmani Saadi Tahan Yamani Zaher Zidane`)
    },
    eastasian: {
      first: w(`Akira Daichi Haruto Hiroshi Itsuki Jin Kaito Kazuki Kenji Minjun Naoki Ren Riku Ryota Sota Shin Soo Takumi Tatsuya
        Yuto Yuki Jae Hyun Taeyang Wei`),
      last: w(`Aoki Fujimoto Hayashi Inoue Kaneko Kimura Kurata Maeda Matsuda Miyake Mori Nakamura Ogawa Okada Saito Sakamoto
        Shimizu Takeda Tanabe Ueda Watanabe Yamada Yoshida Kang Seo`)
    }
  };

  /* ---------- Naciones ficticias (32) ----------
     tier: 1 (élite) .. 5 (modesta). Determina el nivel del talento nacional.
     flag: [patrón, color1, color2, color3] — se dibuja como SVG/canvas.     */
  const NATIONS = [
    // Iberia / América
    { id: 'AUR', name: 'Aurelia',        culture: 'iberic',    region: 'Atlántica', tier: 1, flag: ['h3', '#c8102e', '#ffc400', '#c8102e'] },
    { id: 'VAL', name: 'Valdoria',       culture: 'iberic',    region: 'Atlántica', tier: 2, flag: ['v3', '#0b3d91', '#ffffff', '#0b3d91'] },
    { id: 'MTA', name: 'Montealto',      culture: 'iberic',    region: 'Atlántica', tier: 3, flag: ['cross', '#ffffff', '#1b7f3a', '#1b7f3a'] },
    { id: 'SVE', name: 'Sierra Verde',   culture: 'iberic',    region: 'Atlántica', tier: 4, flag: ['h2', '#1b7f3a', '#ffffff', '#1b7f3a'] },
    { id: 'CRU', name: 'Costa Rubia',    culture: 'iberic',    region: 'Atlántica', tier: 4, flag: ['diag', '#e6b800', '#d1342c', '#e6b800'] },
    { id: 'PSO', name: 'Puerto Sol',     culture: 'iberic',    region: 'Atlántica', tier: 5, flag: ['circle', '#1f6fd1', '#ffd23f', '#1f6fd1'] },
    { id: 'RIO', name: 'Riolanda',       culture: 'lusophone', region: 'Atlántica', tier: 1, flag: ['diamond', '#0a8f3c', '#ffd400', '#1a3d8f'] },
    { id: 'BRS', name: 'Brasara',        culture: 'lusophone', region: 'Atlántica', tier: 2, flag: ['h3', '#0a8f3c', '#ffffff', '#d4202a'] },
    { id: 'MRV', name: 'Marvela',        culture: 'lusophone', region: 'Atlántica', tier: 3, flag: ['v2', '#d4202a', '#0a6b3a', '#d4202a'] },
    // Islas y norte
    { id: 'NMR', name: 'Northmere',      culture: 'anglo',     region: 'Boreal',    tier: 1, flag: ['cross', '#ffffff', '#c8102e', '#c8102e'] },
    { id: 'WMA', name: 'Westmarch',      culture: 'anglo',     region: 'Boreal',    tier: 3, flag: ['cross', '#0a2a66', '#ffffff', '#ffffff'] },
    { id: 'KES', name: 'Kestrel Isles',  culture: 'anglo',     region: 'Boreal',    tier: 4, flag: ['diag', '#0a2a66', '#ffffff', '#c8102e'] },
    { id: 'STH', name: 'Stormhaven',     culture: 'anglo',     region: 'Boreal',    tier: 5, flag: ['h2', '#2b2b2b', '#e8e8e8', '#2b2b2b'] },
    { id: 'NOR', name: 'Nordheim',       culture: 'nordic',    region: 'Boreal',    tier: 2, flag: ['cross', '#1e63b4', '#ffd23f', '#ffd23f'] },
    { id: 'SKV', name: 'Skarvik',        culture: 'nordic',    region: 'Boreal',    tier: 4, flag: ['cross', '#c8102e', '#ffffff', '#ffffff'] },
    // Europa central
    { id: 'LOR', name: 'Lorvaine',       culture: 'gallic',    region: 'Continental', tier: 1, flag: ['v3', '#1d3f9e', '#ffffff', '#d4202a'] },
    { id: 'BLM', name: 'Belmarais',      culture: 'gallic',    region: 'Continental', tier: 3, flag: ['h3', '#111111', '#ffcf00', '#d4202a'] },
    { id: 'SUV', name: 'Sauvelle',       culture: 'gallic',    region: 'Continental', tier: 4, flag: ['v2', '#6a2c91', '#ffffff', '#6a2c91'] },
    { id: 'HOH', name: 'Hohenmark',      culture: 'germanic',  region: 'Continental', tier: 1, flag: ['h3', '#111111', '#d4202a', '#ffcf00'] },
    { id: 'DRA', name: 'Drachenberg',    culture: 'germanic',  region: 'Continental', tier: 3, flag: ['diamond', '#d4202a', '#ffffff', '#111111'] },
    { id: 'EIS', name: 'Eisenland',      culture: 'germanic',  region: 'Continental', tier: 5, flag: ['h2', '#7b8794', '#1a2b3c', '#7b8794'] },
    { id: 'VER', name: 'Veronia',        culture: 'italic',    region: 'Continental', tier: 2, flag: ['v3', '#0a8f3c', '#ffffff', '#d4202a'] },
    { id: 'CAS', name: 'Castellana',     culture: 'italic',    region: 'Continental', tier: 3, flag: ['circle', '#ffffff', '#c8102e', '#ffffff'] },
    { id: 'ZLA', name: 'Zlatavia',       culture: 'slavic',    region: 'Continental', tier: 2, flag: ['h3', '#ffffff', '#1d4ed8', '#d4202a'] },
    { id: 'KRP', name: 'Karpathia',      culture: 'slavic',    region: 'Continental', tier: 4, flag: ['h2', '#d4202a', '#f5c518', '#d4202a'] },
    // África / Medio Oriente / Asia
    { id: 'ZAN', name: 'Zandara',        culture: 'westafrican', region: 'Sahel',   tier: 2, flag: ['v3', '#0a8f3c', '#f5c518', '#d4202a'] },
    { id: 'SOL', name: 'Soleya',         culture: 'westafrican', region: 'Sahel',   tier: 3, flag: ['circle', '#f5c518', '#0a8f3c', '#f5c518'] },
    { id: 'TMB', name: 'Tamboro',        culture: 'westafrican', region: 'Sahel',   tier: 4, flag: ['diag', '#d4202a', '#111111', '#f5c518'] },
    { id: 'ZAH', name: 'Al-Zahira',      culture: 'arabic',    region: 'Sahel',     tier: 3, flag: ['h3', '#0a6b3a', '#ffffff', '#111111'] },
    { id: 'DUN', name: 'Dunara',         culture: 'arabic',    region: 'Sahel',     tier: 5, flag: ['cross', '#d4202a', '#ffffff', '#ffffff'] },
    { id: 'HAN', name: 'Hanoku',         culture: 'eastasian', region: 'Pacífico',  tier: 2, flag: ['circle', '#ffffff', '#c8102e', '#ffffff'] },
    { id: 'SAK', name: 'Sakurei',        culture: 'eastasian', region: 'Pacífico',  tier: 4, flag: ['diamond', '#1d3f9e', '#ffffff', '#c8102e'] }
  ];

  /* ---------- Ligas y clubes ficticios ----------
     tier del club: 1 (cima) .. 4 (modesto). nat = nación base de la plantilla.
     c = [primario, secundario, acento]   crest = {shape, pattern, icon}        */
  const LEAGUES = [
    { id: 'LAU', name: 'Liga Aurora',       country: 'Aurelia',  nat: 'AUR', level: 1, teams: 8, promo: 2, relegate: 2, prize: 24e6 },
    { id: 'LAP', name: 'Liga Aurora Plata', country: 'Aurelia',  nat: 'AUR', level: 2, teams: 8, promo: 2, relegate: 0, prize: 6e6 },
    { id: 'LBO', name: 'Liga Boreal',       country: 'Nordheim', nat: 'NOR', level: 1, teams: 8, promo: 0, relegate: 0, prize: 20e6 }
  ];

  const CLUBS = [
    // --- Liga Aurora (1ª) ---
    { id: 'ATV', name: 'Atlético Valmar',      short: 'ATV', city: 'Valmar',      league: 'LAU', nat: 'AUR', tier: 1, rep: 88, fans: 92, c: ['#d71920', '#ffffff', '#111111'], crest: { shape: 'shield', pattern: 'stripes', icon: 'bear' }, stadium: { name: 'Estadio Valmar Arena',     cap: 68000, cat: 'intl' } },
    { id: 'EAZ', name: 'CD Estrella Azul',     short: 'EAZ', city: 'Costanera',   league: 'LAU', nat: 'AUR', tier: 1, rep: 85, fans: 88, c: ['#1456c7', '#ffffff', '#ffd23f'], crest: { shape: 'round', pattern: 'halves', icon: 'star' },  stadium: { name: 'Estadio El Cielo',          cap: 52000, cat: 'big' } },
    { id: 'UMA', name: 'Unión Montealba',      short: 'UMA', city: 'Montealba',   league: 'LAU', nat: 'AUR', tier: 2, rep: 76, fans: 74, c: ['#0f8b4c', '#ffffff', '#111111'], crest: { shape: 'diamond', pattern: 'chevron', icon: 'tower' }, stadium: { name: 'Campo de la Unión',        cap: 41000, cat: 'big' } },
    { id: 'RCO', name: 'Real Costanera',       short: 'RCO', city: 'Costanera',   league: 'LAU', nat: 'AUR', tier: 2, rep: 74, fans: 72, c: ['#ffffff', '#6a2c91', '#d4af37'], crest: { shape: 'shield', pattern: 'solid', icon: 'crown' },   stadium: { name: 'Estadio del Puerto',        cap: 34000, cat: 'mid' } },
    { id: 'DSI', name: 'Deportivo Sierra',     short: 'DSI', city: 'Sierra Alta', league: 'LAU', nat: 'AUR', tier: 3, rep: 64, fans: 60, c: ['#f2a900', '#111111', '#ffffff'], crest: { shape: 'banner', pattern: 'diagonal', icon: 'wolf' },  stadium: { name: 'La Cantera Alta',           cap: 27000, cat: 'mid' } },
    { id: 'FCA', name: 'FC Aurora',            short: 'FCA', city: 'Aurora',      league: 'LAU', nat: 'AUR', tier: 3, rep: 62, fans: 58, c: ['#ff6b35', '#1d1d3b', '#ffffff'], crest: { shape: 'round', pattern: 'cross', icon: 'sun' },     stadium: { name: 'Estadio Amanecer',          cap: 24000, cat: 'mid' } },
    { id: 'RPN', name: 'Racing Portonuevo',    short: 'RPN', city: 'Portonuevo',  league: 'LAU', nat: 'AUR', tier: 4, rep: 52, fans: 48, c: ['#00a6b4', '#0b2a4a', '#ffffff'], crest: { shape: 'hex', pattern: 'stripes', icon: 'anchor' },   stadium: { name: 'Muelle Deportivo',          cap: 14500, cat: 'small' } },
    { id: 'SRG', name: 'Sporting Riogrande',   short: 'SRG', city: 'Riogrande',   league: 'LAU', nat: 'AUR', tier: 4, rep: 50, fans: 46, c: ['#8e1b3a', '#f4e3b2', '#111111'], crest: { shape: 'shield', pattern: 'halves', icon: 'wave' },   stadium: { name: 'Campo del Río',             cap: 12800, cat: 'small' } },
    // --- Liga Aurora Plata (2ª) ---
    { id: 'OLI', name: 'Club Olivar',          short: 'OLI', city: 'Olivar',      league: 'LAP', nat: 'AUR', tier: 3, rep: 48, fans: 42, c: ['#6b8e23', '#ffffff', '#2b2b2b'], crest: { shape: 'round', pattern: 'solid', icon: 'tree' },    stadium: { name: 'Estadio Los Olivos',         cap: 11800, cat: 'small' } },
    { id: 'AMI', name: 'Atlético Mirador',     short: 'AMI', city: 'Mirador',     league: 'LAP', nat: 'AUR', tier: 3, rep: 46, fans: 40, c: ['#c0392b', '#2c3e50', '#ecf0f1'], crest: { shape: 'diamond', pattern: 'stripes', icon: 'eagle' }, stadium: { name: 'El Mirador',                 cap: 10500, cat: 'small' } },
    { id: 'CSE', name: 'CD Santa Elena',       short: 'CSE', city: 'Santa Elena', league: 'LAP', nat: 'AUR', tier: 3, rep: 45, fans: 38, c: ['#2e86c1', '#ffffff', '#f4d03f'], crest: { shape: 'shield', pattern: 'chevron', icon: 'star' }, stadium: { name: 'Campo Santa Elena',          cap: 9800, cat: 'small' } },
    { id: 'ULA', name: 'UD Laguna',            short: 'ULA', city: 'Laguna',      league: 'LAP', nat: 'AUR', tier: 4, rep: 42, fans: 34, c: ['#117a8b', '#f0e68c', '#0b3c49'], crest: { shape: 'round', pattern: 'halves', icon: 'wave' },    stadium: { name: 'Estadio La Laguna',          cap: 8600, cat: 'small' } },
    { id: 'JAL', name: 'Juventud Alba',        short: 'JAL', city: 'Alba',        league: 'LAP', nat: 'AUR', tier: 4, rep: 40, fans: 32, c: ['#f5f5f5', '#c0392b', '#111111'], crest: { shape: 'banner', pattern: 'cross', icon: 'bolt' },    stadium: { name: 'Campo de la Juventud',       cap: 7800, cat: 'small' } },
    { id: 'DCA', name: 'Deportivo Caribe',     short: 'DCA', city: 'Caribe',      league: 'LAP', nat: 'AUR', tier: 4, rep: 38, fans: 31, c: ['#16a085', '#f39c12', '#ffffff'], crest: { shape: 'hex', pattern: 'diagonal', icon: 'sun' },     stadium: { name: 'Estadio Brisa Marina',       cap: 7200, cat: 'small' } },
    { id: 'ABR', name: 'Academia Brisa',       short: 'ABR', city: 'Brisa',       league: 'LAP', nat: 'AUR', tier: 4, rep: 36, fans: 28, c: ['#8e44ad', '#f1c40f', '#ffffff'], crest: { shape: 'round', pattern: 'stripes', icon: 'ball' },   stadium: { name: 'Complejo Brisa',             cap: 6400, cat: 'small' } },
    { id: 'SMO', name: 'Sporting Morada',      short: 'SMO', city: 'Morada',      league: 'LAP', nat: 'AUR', tier: 4, rep: 34, fans: 26, c: ['#7d3c98', '#d5d8dc', '#111111'], crest: { shape: 'shield', pattern: 'solid', icon: 'lion' },   stadium: { name: 'Campo Morado',               cap: 5800, cat: 'small' } },
    // --- Liga Boreal ---
    { id: 'NUN', name: 'Nordheim United',     short: 'NUN', city: 'Nordhaven',   league: 'LBO', nat: 'NOR', tier: 1, rep: 83, fans: 84, c: ['#c8102e', '#ffffff', '#1d1d1b'], crest: { shape: 'shield', pattern: 'cross', icon: 'wolf' },    stadium: { name: 'Nordic Park',                cap: 58000, cat: 'big' } },
    { id: 'BOR', name: 'Borealis FC',         short: 'BOR', city: 'Borea',       league: 'LBO', nat: 'NOR', tier: 2, rep: 75, fans: 70, c: ['#0b3d91', '#7fd1ff', '#ffffff'], crest: { shape: 'round', pattern: 'chevron', icon: 'star' },   stadium: { name: 'Aurora Boreal Stadion',      cap: 36000, cat: 'big' } },
    { id: 'SKA', name: 'FK Skarvik',          short: 'SKA', city: 'Skarvik',     league: 'LBO', nat: 'SKV', tier: 3, rep: 63, fans: 55, c: ['#1b1b1b', '#ffcf00', '#ffffff'], crest: { shape: 'hex', pattern: 'halves', icon: 'eagle' },    stadium: { name: 'Skarvik Arena',              cap: 22500, cat: 'mid' } },
    { id: 'HSV', name: 'Hohenmark SV',        short: 'HSV', city: 'Hohenburg',   league: 'LBO', nat: 'HOH', tier: 2, rep: 72, fans: 68, c: ['#222222', '#ffffff', '#dd0000'], crest: { shape: 'diamond', pattern: 'solid', icon: 'tower' }, stadium: { name: 'Hohenmark-Stadion',          cap: 38000, cat: 'big' } },
    { id: 'KAT', name: 'Kestrel Athletic',    short: 'KAT', city: 'Kestrel',     league: 'LBO', nat: 'KES', tier: 3, rep: 60, fans: 52, c: ['#9b2335', '#f5e6c8', '#1c1c1c'], crest: { shape: 'banner', pattern: 'stripes', icon: 'eagle' }, stadium: { name: 'Kestrel Ground',             cap: 19800, cat: 'mid' } },
    { id: 'WMR', name: 'Westmarch Rovers',    short: 'WMR', city: 'Westmarch',   league: 'LBO', nat: 'WMA', tier: 3, rep: 58, fans: 50, c: ['#003f87', '#ffffff', '#f2c200'], crest: { shape: 'shield', pattern: 'diagonal', icon: 'lion' }, stadium: { name: 'The Marchfield',             cap: 17200, cat: 'mid' } },
    { id: 'SCT', name: 'Stormhaven City',     short: 'SCT', city: 'Stormhaven',  league: 'LBO', nat: 'STH', tier: 4, rep: 49, fans: 44, c: ['#4a6572', '#ffffff', '#f9aa33'], crest: { shape: 'round', pattern: 'cross', icon: 'wave' },    stadium: { name: 'Harbour Road',               cap: 13200, cat: 'small' } },
    { id: 'IFJ', name: 'IFK Fjordby',         short: 'IFJ', city: 'Fjordby',     league: 'LBO', nat: 'SKV', tier: 4, rep: 46, fans: 40, c: ['#1e8449', '#ffffff', '#1c1c1c'], crest: { shape: 'hex', pattern: 'chevron', icon: 'tree' },    stadium: { name: 'Fjordby Bane',               cap: 9900, cat: 'small' } }
  ];

  /* Apodos y descripciones cortas para ambientar la UI */
  const FLAVOUR = {
    leagueBlurb: {
      LAU: 'La élite de Aurelia: ocho clubes, doble vuelta y dos descensos.',
      LAP: 'La segunda división: los dos primeros ascienden a la Liga Aurora.',
      LBO: 'Liga del norte, intensa y física. Ocho clubes de varias naciones.'
    }
  };

  /* Nombres completos de personajes reales que NO deben generarse por casualidad. */
  const BLACKLIST = new Set([
    'lionel messi', 'cristiano ronaldo', 'neymar junior', 'kylian mbappé', 'luis suárez', 'sergio ramos', 'marcus rashford',
    'harry kane', 'erling haaland', 'luka modrić', 'andrés iniesta', 'xavi hernández', 'carlos tévez', 'diego maradona',
    'diego costa', 'rodrigo moreno', 'mateo kovacic', 'son heung', 'sadio mané', 'mohamed salah'
  ]);

  G.Data = { CULTURES, NATIONS, LEAGUES, CLUBS, FLAVOUR, BLACKLIST };
})(typeof window !== 'undefined' ? window : globalThis);
