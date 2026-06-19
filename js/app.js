const API_URL = 'https://anisync-backend-bpfv.onrender.com';

let temporizadorBusqueda;
let vistaAnterior = 'vista-inicio'; 
let catalogoCargado = false; 
let horariosCargados = false;
let animeActualParaBoveda = {}; 

let heroAnimes = [];
let indiceHeroActual = 0;
let intervaloHero;

const traduccionesTemporada = { "spring": "Primavera", "summer": "Verano", "fall": "Otoño", "winter": "Invierno" };
const traduccionesEstado = { "Currently Airing": "En emisión", "Finished Airing": "Finalizado", "Not yet aired": "Próximamente" };
const translateCache = {}; 

function barajarArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function eliminarDuplicados(animesArray) {
    const vistos = new Set();
    return animesArray.filter(anime => {
        if (vistos.has(anime.mal_id)) return false;
        vistos.add(anime.mal_id);
        return true;
    });
}

async function traducirTexto(texto, langpair = 'en|es') {
    if (!texto) return "Sinopsis no disponible.";
    if (translateCache[texto]) return translateCache[texto]; 

    try {
        const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(texto)}&langpair=${langpair}`);
        const data = await response.json();
        if (data.responseStatus === 200 && data.responseData.translatedText) {
            const translated = data.responseData.translatedText;
            translateCache[texto] = translated; 
            return translated;
        } else {
            return `${texto} (Traducción no disponible)`;
        }
    } catch (error) {
        return `${texto} (Error de traducción)`;
    }
}

// 1. Navegación SPA (CON CANDADO DE SCROLL)
function cambiarVista(idVista) {
    if(idVista !== 'vista-detalles') {
        vistaAnterior = idVista; 
        document.getElementById('detalle-fondo-cine').classList.remove('activo');
    }

    document.querySelectorAll('.vista').forEach(v => v.classList.remove('activa'));
    document.getElementById(idVista).classList.add('activa');
    
    document.querySelectorAll('.bottom-nav-btn').forEach(btn => {
        btn.classList.toggle('activo', btn.dataset.vista === idVista);
    });

    document.getElementById('buscar').value = ''; 
    document.getElementById('lista-resultados').style.display = 'none';

    // BLOQUEO MAESTRO DE SCROLL PARA EL INICIO
    if (idVista === 'vista-inicio') {
        document.body.style.overflow = 'hidden';
        window.scrollTo(0,0);
    } else {
        document.body.style.overflow = 'auto';
    }

    if (idVista === 'vista-directorio' && !catalogoCargado) cargarDirectorio();
    else if (idVista === 'vista-calendario' && !horariosCargados) {
        cargarHorario('monday', document.querySelector('.menu-dias button'));
        horariosCargados = true;
    } else if (idVista === 'vista-boveda') cargarBoveda();
}

function volverDeDetalles() {
    cambiarVista(vistaAnterior);
}

// ==========================================
// 2. HERO DINÁMICO (PRE-CARGA INTELIGENTE)
// ==========================================
async function iniciarHeroRotativo() {
    try {
        const respuesta = await fetch('https://api.jikan.moe/v4/top/anime?filter=airing&limit=25');
        const data = await respuesta.json();
        
        const animesFiltrados = eliminarDuplicados(data.data).filter(a => a.synopsis && a.images.jpg.large_image_url);
        heroAnimes = barajarArray(animesFiltrados);
        
        if (heroAnimes.length > 0) {
            // Pre-traducimos el primero antes de mostrarlo
            const primerAnime = heroAnimes[0];
            const sinopsisOriginal = primerAnime.synopsis ? primerAnime.synopsis.split('[Written by')[0].trim() : "Sinopsis no disponible.";
            primerAnime.sinopsisTraducida = await traducirTexto(sinopsisOriginal);

            actualizarUIHero();
            if(intervaloHero) clearInterval(intervaloHero); 
            intervaloHero = setInterval(cambiarHeroSiguiente, 8000); 
        }
    } catch (error) {
        console.error("Error cargando Hero:", error);
    }
}

async function cambiarHeroSiguiente() {
    const siguienteIndice = (indiceHeroActual + 1) % heroAnimes.length;
    const siguienteAnime = heroAnimes[siguienteIndice];
    
    // LA MAGIA: Pre-carga secreta mientras el usuario sigue viendo el anime actual
    if (siguienteAnime) {
        const img = new Image();
        img.src = siguienteAnime.images.jpg.large_image_url;
        
        const sinopsisOriginal = siguienteAnime.synopsis ? siguienteAnime.synopsis.split('[Written by')[0].trim() : "Sinopsis no disponible.";
        if (!siguienteAnime.sinopsisTraducida) {
            siguienteAnime.sinopsisTraducida = await traducirTexto(sinopsisOriginal);
        }
    }
    
    // Una vez descargado todo, actualizamos
    indiceHeroActual = siguienteIndice;
    actualizarUIHero();
}

function actualizarUIHero() {
    const anime = heroAnimes[indiceHeroActual];
    const contenedor = document.getElementById('hero-contenedor');

    contenedor.style.animation = 'slide-out-left 0.4s ease-out forwards';

    setTimeout(() => {
        contenedor.style.opacity = 0;

        const temporada = anime.season ? `Temporada ${traduccionesTemporada[anime.season] || anime.season}` : "Actualidad";
        const estado = traduccionesEstado[anime.status] || anime.status;

        document.getElementById('hero-imagen').src = anime.images.jpg.large_image_url;
        document.getElementById('hero-titulo').innerText = anime.title;
        document.getElementById('hero-meta').innerText = `${anime.type || 'TV'} • ${anime.year || new Date().getFullYear()} • ${temporada} • ${estado}`;
        document.getElementById('hero-rating').innerText = anime.score ? anime.score.toFixed(2) : "N/A";
        document.getElementById('hero-sinopsis').innerText = anime.sinopsisTraducida || "Sinopsis no disponible.";
        document.getElementById('btn-hero-detalles').onclick = () => abrirDetalles(anime.mal_id);

        contenedor.style.animation = 'slide-in-right 0.4s ease-out forwards';
        contenedor.style.opacity = 1; 
    }, 400); 
}

// ==========================================
// 3. CATÁLOGO INFALIBLE
// ==========================================
async function cargarDirectorio() {
    const grid = document.getElementById('grid-directorio');
    let skeletonHTML = '';
    for (let i = 0; i < 12; i++) {
        skeletonHTML += `
            <div class="tarjeta-anime">
                <div class="contenedor-portada skeleton" style="aspect-ratio: 2/3;"></div>
                <div class="info-externa" style="padding: 12px 15px;"><div class="skeleton" style="height: 1.1rem; width: 80%;"></div></div>
            </div>`;
    }
    grid.innerHTML = skeletonHTML;

    try {
        const respuesta = await fetch('https://api.jikan.moe/v4/seasons/now?limit=24');
        const data = await respuesta.json();
        const animesUnicos = eliminarDuplicados(data.data);
        
        grid.innerHTML = animesUnicos.map(a => `
            <div class="tarjeta-anime" onclick="abrirDetalles(${a.mal_id})">
                <div class="contenedor-portada">
                    <img src="${a.images.jpg.image_url}" alt="${a.title}" loading="lazy">
                    <span class="etiqueta-flotante">⭐ ${a.score ? a.score.toFixed(1) : 'N/A'}</span>
                </div>
                <div class="info-externa"><p title="${a.title}">${a.title}</p></div>
            </div>
        `).join('');
        catalogoCargado = true;
    } catch (error) { grid.innerHTML = '<p style="text-align: center;">Error al cargar el catálogo.</p>'; }
}

// ==========================================
// 4. HORARIOS
// ==========================================
async function cargarHorario(dia, btnElement) {
    document.querySelectorAll('.menu-dias .filtro-btn').forEach(btn => btn.classList.remove('activo'));
    btnElement.classList.add('activo');

    const grid = document.getElementById('grid-horarios');
    grid.innerHTML = `<div class="tarjeta-anime"><div class="contenedor-portada skeleton" style="aspect-ratio: 2/3;"></div></div>`;
    
    try {
        const respuesta = await fetch(`https://api.jikan.moe/v4/schedules?filter=${dia}&limit=24`);
        const data = await respuesta.json();
        const animesUnicos = eliminarDuplicados(data.data);
        
        if (animesUnicos.length === 0) { grid.innerHTML = '<p style="text-align: center;">No hay emisiones programadas para este día.</p>'; return; }

        grid.innerHTML = animesUnicos.map(a => `
            <div class="tarjeta-anime" onclick="abrirDetalles(${a.mal_id})">
                <div class="contenedor-portada">
                    <img src="${a.images.jpg.image_url}" alt="${a.title}" loading="lazy">
                    <span class="etiqueta-flotante">🕘 ${a.broadcast.time || 'N/A'}</span>
                </div>
                <div class="info-externa"><p title="${a.title}">${a.title}</p></div>
            </div>
        `).join('');
    } catch (error) { grid.innerHTML = '<p style="text-align: center;">Error de red en horarios.</p>'; }
}

// ==========================================
// 5. BUSCADOR
// ==========================================
document.getElementById('buscar').addEventListener('input', (e) => {
    const query = e.target.value.trim();
    const lista = document.getElementById('lista-resultados');
    clearTimeout(temporizadorBusqueda);

    if (query.length > 2) {
        lista.style.display = 'block';
        lista.innerHTML = `<p style="padding: 10px; color: var(--acento);">Buscando...</p>`;

        temporizadorBusqueda = setTimeout(async () => {
            try {
                const respuesta = await fetch(`https://api.jikan.moe/v4/anime?q=${query}&limit=5`);
                const data = await respuesta.json();
                if (data.data.length === 0) { lista.innerHTML = `<p style="padding: 10px;">No hay resultados.</p>`; return; }
                
                lista.innerHTML = data.data.map(anime => `
                    <div class="tarjeta-busqueda" onclick="abrirDetalles(${anime.mal_id})">
                        <img src="${anime.images.jpg.image_url}" alt="${anime.title}" loading="lazy">
                        <div class="tarjeta-busqueda-info"><h4>${anime.title}</h4><span>${anime.year || 'TV Anime'}</span></div>
                    </div>
                `).join('');
            } catch (error) { lista.innerHTML = `<p style="padding: 10px;">Error de red.</p>`; }
        }, 400); 
    } else { lista.style.display = 'none'; }
});

// ==========================================
// 6. DETALLES Y CONEXIÓN BÓVEDA
// ==========================================
async function abrirDetalles(idAnime) {
    document.getElementById('lista-resultados').style.display = 'none'; 
    document.getElementById('buscar').value = ''; 
    cambiarVista('vista-detalles');
    
    document.getElementById('detalle-imagen').src = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";
    document.getElementById('detalle-titulo').innerHTML = '<div class="skeleton" style="height: 2.2rem; width: 70%; margin-bottom: 8px;"></div>';
    document.getElementById('detalle-meta').innerHTML = '<div class="skeleton" style="height: 0.9rem; width: 90%; margin-bottom: 15px;"></div>';
    document.getElementById('detalle-tags').innerHTML = '<div class="skeleton" style="height: 30px; width: 80%; margin-bottom: 15px;"></div>';
    document.getElementById('detalle-sinopsis').innerHTML = '<div class="skeleton" style="height: 4em; width: 100%;"></div>';
    document.getElementById('detalle-rating-valor').innerText = "-";
    document.querySelector('#vista-detalles .btn-secundario').style.display = 'none';

    try {
        const respuesta = await fetch(`https://api.jikan.moe/v4/anime/${idAnime}/full`);
        const data = (await respuesta.json()).data;

        const fondoCine = document.getElementById('detalle-fondo-cine');
        fondoCine.style.backgroundImage = `url(${data.images.jpg.large_image_url})`;
        fondoCine.classList.add('activo');

        const sinopsisOriginal = data.synopsis ? data.synopsis.split('[Written by')[0].trim() : "Sinopsis no disponible.";
        const sinopsisTraducida = await traducirTexto(sinopsisOriginal);

        const temporada = data.season ? `Temporada ${traduccionesTemporada[data.season] || data.season}` : "Actual";
        const estado = traduccionesEstado[data.status] || data.status;

        document.getElementById('detalle-imagen').src = data.images.jpg.large_image_url;
        document.getElementById('detalle-titulo').innerText = data.title;
        document.getElementById('detalle-meta').innerText = `${data.type || 'TV'} • ${data.year || 'N/A'} • ${temporada} • ${estado}`;
        document.getElementById('detalle-sinopsis').innerText = sinopsisTraducida;
        document.getElementById('detalle-rating-valor').innerText = data.score ? data.score.toFixed(2) : "N/A";

        if (data.genres && data.genres.length > 0) {
            document.getElementById('detalle-tags').innerHTML = data.genres.map(g => `<span class="tag">${g.name}</span>`).join('');
        } else { document.getElementById('detalle-tags').innerHTML = '<span class="tag">Sin Clasificar</span>'; }

        animeActualParaBoveda = {
            mal_id: data.mal_id, title: data.title, image_url: data.images.jpg.large_image_url,
            type: data.type, year: data.year, status: estado, score: data.score, genres: data.genres
        };

        const btnGuardar = document.querySelector('#vista-detalles .btn-secundario');
        btnGuardar.style.display = 'flex';
        btnGuardar.onclick = guardarEnBoveda;
    } catch (error) { document.getElementById('detalle-titulo').innerText = "Error de Sistema"; }
}

async function guardarEnBoveda() {
    const btn = document.querySelector('#vista-detalles .btn-secundario');
    btn.innerText = "⏳ Guardando...";
    btn.disabled = true;

    try {
        const respuesta = await fetch(`${API_URL}/api/guardar`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(animeActualParaBoveda)
        });
        const resultado = await respuesta.json();

        if (respuesta.ok && resultado.status === 'ok') mostrarToast("✔️ Guardado en tu Bóveda", "success");
        else if (respuesta.ok && resultado.status === 'duplicado') mostrarToast("⚠️ Ya está en tu Bóveda", "warning");
        else mostrarToast(resultado.mensaje || "Error al guardar", "error");
    } catch (error) {
        mostrarToast("❌ No se pudo conectar al servidor", "error");
    } finally {
        setTimeout(() => { btn.innerText = "➕ Agregar a Bóveda"; btn.disabled = false; }, 1500);
    }
}

async function cargarBoveda() {
    const panelStats = document.getElementById('panel-estadisticas');
    const gridBoveda = document.getElementById('grid-boveda');
    
    gridBoveda.innerHTML = `<div class="boveda-vacia glass-panel-dark" style="color: var(--acento);">📡 Sincronizando bóveda...</div>`;
    
    try {
        const respuesta = await fetch(`${API_URL}/api/boveda`);
        const animesGuardados = await respuesta.json();

        const totalAnimes = animesGuardados.length;
        let puntuacionMedia = 0;
        const conteoGeneros = {};

        if (totalAnimes > 0) {
            const animesConScore = animesGuardados.filter(a => a.score);
            puntuacionMedia = animesConScore.reduce((sum, a) => sum + a.score, 0) / (animesConScore.length || 1);

            animesGuardados.forEach(a => {
                if (a.genres) { a.genres.forEach(g => { conteoGeneros[g.name] = (conteoGeneros[g.name] || 0) + 1; }); }
            });
        }
        const generoFavorito = Object.keys(conteoGeneros).length > 0 ? Object.entries(conteoGeneros).sort((a, b) => b[1] - a[1])[0][0] : 'N/A';

        panelStats.innerHTML = `
            <div class="stat-caja"><div class="valor">${totalAnimes}</div><div class="etiqueta">Animes Guardados</div></div>
            <div class="stat-caja"><div class="valor">${puntuacionMedia.toFixed(2)}</div><div class="etiqueta">Puntuación Media</div></div>
            <div class="stat-caja"><div class="valor">${generoFavorito}</div><div class="etiqueta">Género Favorito</div></div>
        `;

        if (animesGuardados.length === 0) {
            gridBoveda.innerHTML = `<div class="boveda-vacia glass-panel-dark">🛡️ Tu bóveda está vacía. ¡Ve a explorar el catálogo!</div>`;
            return;
        }
                        
        gridBoveda.innerHTML = animesGuardados.map(a => `
            <div class="tarjeta-anime" onclick="abrirDetalles(${a.mal_id})">
                <div class="contenedor-portada">
                    <img src="${a.image_url}" alt="${a.title}" loading="lazy">
                    <span class="etiqueta-flotante" style="background: var(--acento); color: #000;">Guardado</span>
                </div>
                <div class="info-externa"><p title="${a.title}">${a.title}</p></div>
            </div>
        `).join('');

    } catch (error) {
        gridBoveda.innerHTML = `<div class="boveda-vacia glass-panel-dark" style="color: #ef4444;">❌ Servidor apagado. No se pudo conectar con MongoDB.</div>`;
    }
}

// ==========================================
// 7. FONDO TECNOLÓGICO ANIMADO
// ==========================================
function iniciarFondoTecnologico() {
    const canvas = document.getElementById('fondo-tecnologico');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;

    const katakana = 'アァカサタナハマヤャラワガザダバパイィキシチニヒミリヰギジヂビピウゥクスツヌフムユュルグズブヅプエェケセテネヘメレヱゲゼデベペオォコソトノホモヨョロヲゴゾドボポヴッン';
    const fontSize = 16;
    const columns = canvas.width / fontSize;
    const rainDrops = [];
    for (let x = 0; x < columns; x++) { rainDrops[x] = 1; }

    setInterval(() => {
        ctx.fillStyle = 'rgba(11, 15, 25, 0.05)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--acento').trim() || '#8b5cf6'; 
        ctx.font = `${fontSize}px monospace`;

        for (let i = 0; i < rainDrops.length; i++) {
            const text = katakana.charAt(Math.floor(Math.random() * katakana.length));
            ctx.fillText(text, i * fontSize, rainDrops[i] * fontSize);
            if (rainDrops[i] * fontSize > canvas.height && Math.random() > 0.975) rainDrops[i] = 0;
            rainDrops[i]++;
        }
    }, 33);

    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth; canvas.height = window.innerHeight;
        rainDrops.length = 0; 
        for (let x = 0; x < canvas.width / fontSize; x++) { rainDrops[x] = 1; }
    });
}

function iniciarUtilidadesUI() {
    const btnScroll = document.getElementById('btn-scroll-top');
    window.addEventListener('scroll', () => { btnScroll.classList.toggle('visible', window.scrollY > 400); });
    btnScroll.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    document.querySelectorAll('.bottom-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => cambiarVista(btn.dataset.vista));
    });
}

function mostrarToast(mensaje, tipo = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    toast.textContent = mensaje;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 4500); 
}

function iniciarApp() {
    const splashScreen = document.getElementById('splash-screen');
    const logoGrande = document.querySelector('.logo-grande');
    if (splashScreen && logoGrande) {
        splashScreen.addEventListener('click', () => {
            logoGrande.classList.add('minimizado');
            splashScreen.classList.add('oculto');
            document.querySelector('.navbar').classList.remove('contenido-oculto');
            document.getElementById('contenedor-vistas').classList.remove('contenido-oculto');
            
            cambiarVista('vista-inicio');
            iniciarHeroRotativo();
            iniciarFondoTecnologico();
            iniciarUtilidadesUI();
            setTimeout(() => { if (splashScreen) splashScreen.remove(); }, 1500); 
        }, { once: true }); 
    }
};

window.onload = iniciarApp;