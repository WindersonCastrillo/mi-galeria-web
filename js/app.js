const API_URL = 'https://anisync-backend-bpfv.onrender.com';
const ANILIST_URL = 'https://graphql.anilist.co';

let temporizadorBusqueda;
let vistaAnterior = 'vista-inicio';
let catalogoCargado = false;
let horariosCargados = false;
let animeActualParaBoveda = {};

let heroAnimes = [];
let indiceHeroActual = 0;
let intervaloHero;

const traduccionesTemporada = { "spring": "Primavera", "summer": "Verano", "fall": "Otoño", "winter": "Invierno" };
const traduccionesEstado = { "RELEASING": "En emisión", "FINISHED": "Finalizado", "NOT_YET_RELEASED": "Próximamente", "CANCELLED": "Cancelado", "HIATUS": "En pausa" };
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
        if (vistos.has(anime.id)) return false;
        vistos.add(anime.id);
        return true;
    });
}

// ==========================================
// 0. CLIENTE ANILIST (reemplaza a Jikan/MAL)
// ==========================================
async function consultarAniList(query, variables = {}) {
    const respuesta = await fetch(ANILIST_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ query, variables })
    });

    if (!respuesta.ok) throw new Error(`Error en AniList API: ${respuesta.status}`);

    const json = await respuesta.json();
    if (json.errors) throw new Error(json.errors[0]?.message || 'Error de AniList');
    return json.data;
}

function tituloAnime(m) {
    return m.title?.english || m.title?.romaji || 'Sin título';
}

function formatearScore(averageScore, decimales = 2) {
    return averageScore ? (averageScore / 10).toFixed(decimales) : 'N/A';
}

function obtenerTemporadaActual() {
    const mes = new Date().getMonth();
    const anio = new Date().getFullYear();
    let temporada;
    if (mes <= 2) temporada = 'WINTER';
    else if (mes <= 5) temporada = 'SPRING';
    else if (mes <= 8) temporada = 'SUMMER';
    else temporada = 'FALL';
    return { temporada, anio };
}

// AniList no filtra "horarios por día" directamente: se deduce el día de emisión
// (huso horario de Japón, como usan las guías de emisión) a partir de nextAiringEpisode.
function obtenerDiaJST(timestampUnix) {
    const fecha = new Date(timestampUnix * 1000);
    return new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tokyo', weekday: 'long' }).format(fecha).toLowerCase();
}

function obtenerHoraJST(timestampUnix) {
    const fecha = new Date(timestampUnix * 1000);
    return new Intl.DateTimeFormat('es-ES', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' }).format(fecha);
}

function limpiarSinopsis(descripcionCruda) {
    if (!descripcionCruda) return null;
    const texto = descripcionCruda
        .split(/\(Source:/i)[0]
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    return texto || null;
}

async function traducirTexto(texto, langpair = 'en|es') {
    if (!texto) return "Sinopsis no disponible.";
    if (translateCache[texto]) return translateCache[texto];

    // MyMemory (plan gratuito) limita ~500 caracteres por consulta
    const textoAcortado = texto.length > 480 ? texto.slice(0, 480).replace(/\s+\S*$/, '') + '…' : texto;

    try {
        const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(textoAcortado)}&langpair=${langpair}`);

        // 🔧 MEJORA (Feedback Profesor): Validar que el servidor de traducción responda correctamente
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        if (data.responseStatus === 200 && data.responseData.translatedText) {
            const translated = data.responseData.translatedText;
            translateCache[texto] = translated;
            return translated;
        } else {
            return `${texto} (Traducción no disponible)`;
        }
    } catch (error) {
        console.error("Fallo en la traducción:", error);
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
    const query = `
        query ($perPage: Int) {
            Page(perPage: $perPage) {
                media(type: ANIME, status: RELEASING, sort: TRENDING_DESC) {
                    id
                    idMal
                    title { romaji english }
                    coverImage { extraLarge large }
                    averageScore
                    genres
                    status
                    season
                    seasonYear
                    format
                    description(asHtml: false)
                }
            }
        }`;

    try {
        const data = await consultarAniList(query, { perPage: 25 });
        const animesFiltrados = eliminarDuplicados(data.Page.media).filter(m => m.description && (m.coverImage.extraLarge || m.coverImage.large));
        heroAnimes = barajarArray(animesFiltrados);

        if (heroAnimes.length > 0) {
            const primerAnime = heroAnimes[0];
            primerAnime.sinopsisTraducida = await traducirTexto(limpiarSinopsis(primerAnime.description));

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

    if (siguienteAnime) {
        const img = new Image();
        img.src = siguienteAnime.coverImage.extraLarge || siguienteAnime.coverImage.large;

        if (!siguienteAnime.sinopsisTraducida) {
            siguienteAnime.sinopsisTraducida = await traducirTexto(limpiarSinopsis(siguienteAnime.description));
        }
    }

    indiceHeroActual = siguienteIndice;
    actualizarUIHero();
}

function actualizarUIHero() {
    const anime = heroAnimes[indiceHeroActual];
    const contenedor = document.getElementById('hero-contenedor');

    contenedor.style.animation = 'slide-out-left 0.4s ease-out forwards';

    setTimeout(() => {
        contenedor.style.opacity = 0;

        const temporada = anime.season ? `Temporada ${traduccionesTemporada[anime.season.toLowerCase()] || anime.season}` : "Actualidad";
        const estado = traduccionesEstado[anime.status] || anime.status;

        document.getElementById('hero-imagen').src = anime.coverImage.extraLarge || anime.coverImage.large;
        document.getElementById('hero-titulo').innerText = tituloAnime(anime);
        document.getElementById('hero-meta').innerText = `${anime.format || 'TV'} • ${anime.seasonYear || new Date().getFullYear()} • ${temporada} • ${estado}`;
        document.getElementById('hero-rating').innerText = formatearScore(anime.averageScore);
        document.getElementById('hero-sinopsis').innerText = anime.sinopsisTraducida || "Sinopsis no disponible.";
        document.getElementById('btn-hero-detalles').onclick = () => abrirDetalles(anime.id);

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
        skeletonHTML += `<div class="tarjeta-anime"><div class="contenedor-portada skeleton" style="aspect-ratio: 2/3;"></div><div class="info-externa" style="padding: 12px 15px;"><div class="skeleton" style="height: 1.1rem; width: 80%;"></div></div></div>`;
    }
    grid.innerHTML = skeletonHTML;

    const { temporada, anio } = obtenerTemporadaActual();
    const query = `
        query ($temporada: MediaSeason, $anio: Int, $perPage: Int) {
            Page(perPage: $perPage) {
                media(type: ANIME, season: $temporada, seasonYear: $anio, sort: POPULARITY_DESC) {
                    id
                    idMal
                    title { romaji english }
                    coverImage { large }
                    averageScore
                }
            }
        }`;

    try {
        const data = await consultarAniList(query, { temporada, anio, perPage: 24 });
        const animesUnicos = eliminarDuplicados(data.Page.media);

        grid.innerHTML = animesUnicos.map(a => `
            <div class="tarjeta-anime" onclick="abrirDetalles(${a.id})">
                <div class="contenedor-portada">
                    <img src="${a.coverImage.large}" alt="${tituloAnime(a)}" loading="lazy">
                    <span class="etiqueta-flotante">⭐ ${formatearScore(a.averageScore, 1)}</span>
                </div>
                <div class="info-externa"><p title="${tituloAnime(a)}">${tituloAnime(a)}</p></div>
            </div>
        `).join('');
        catalogoCargado = true;
    } catch (error) {
        console.error("Error en Catálogo:", error);
        grid.innerHTML = '<p style="text-align: center; color: #ef4444;">Error de red al cargar el catálogo.</p>';
    }
}

// ==========================================
// 4. HORARIOS
// ==========================================
async function cargarHorario(dia, btnElement) {
    document.querySelectorAll('.menu-dias .filtro-btn').forEach(btn => btn.classList.remove('activo'));
    btnElement.classList.add('activo');

    const grid = document.getElementById('grid-horarios');
    grid.innerHTML = `<div class="tarjeta-anime"><div class="contenedor-portada skeleton" style="aspect-ratio: 2/3;"></div></div>`;

    const query = `
        query ($perPage: Int) {
            Page(perPage: $perPage) {
                media(type: ANIME, status: RELEASING, sort: POPULARITY_DESC) {
                    id
                    idMal
                    title { romaji english }
                    coverImage { large }
                    nextAiringEpisode { airingAt episode }
                }
            }
        }`;

    try {
        const data = await consultarAniList(query, { perPage: 50 });
        const animesUnicos = eliminarDuplicados(data.Page.media)
            .filter(m => m.nextAiringEpisode && obtenerDiaJST(m.nextAiringEpisode.airingAt) === dia);

        if (animesUnicos.length === 0) { grid.innerHTML = '<p style="text-align: center;">No hay emisiones programadas para este día.</p>'; return; }

        grid.innerHTML = animesUnicos.map(a => `
            <div class="tarjeta-anime" onclick="abrirDetalles(${a.id})">
                <div class="contenedor-portada">
                    <img src="${a.coverImage.large}" alt="${tituloAnime(a)}" loading="lazy">
                    <span class="etiqueta-flotante">🕘 ${obtenerHoraJST(a.nextAiringEpisode.airingAt)}</span>
                </div>
                <div class="info-externa"><p title="${tituloAnime(a)}">${tituloAnime(a)}</p></div>
            </div>
        `).join('');
    } catch (error) {
        console.error("Error en Horarios:", error);
        grid.innerHTML = '<p style="text-align: center; color: #ef4444;">Error de red en horarios.</p>';
    }
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
            const busquedaQuery = `
                query ($q: String, $perPage: Int) {
                    Page(perPage: $perPage) {
                        media(type: ANIME, search: $q) {
                            id
                            idMal
                            title { romaji english }
                            coverImage { large }
                            seasonYear
                        }
                    }
                }`;

            try {
                const data = await consultarAniList(busquedaQuery, { q: query, perPage: 5 });
                const resultados = data.Page.media;
                if (resultados.length === 0) { lista.innerHTML = `<p style="padding: 10px;">No hay resultados.</p>`; return; }

                lista.innerHTML = resultados.map(anime => `
                    <div class="tarjeta-busqueda" onclick="abrirDetalles(${anime.id})">
                        <img src="${anime.coverImage.large}" alt="${tituloAnime(anime)}" loading="lazy">
                        <div class="tarjeta-busqueda-info"><h4>${tituloAnime(anime)}</h4><span>${anime.seasonYear || 'TV Anime'}</span></div>
                    </div>
                `).join('');
            } catch (error) {
                lista.innerHTML = `<p style="padding: 10px; color: #ef4444;">Error en la red.</p>`;
            }
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

    const query = `
        query ($id: Int) {
            Media(id: $id, type: ANIME) {
                id
                idMal
                title { romaji english }
                coverImage { extraLarge large }
                bannerImage
                averageScore
                genres
                status
                season
                seasonYear
                format
                description(asHtml: false)
            }
        }`;

    try {
        const data = await consultarAniList(query, { id: idAnime });
        const anime = data.Media;

        const fondoCine = document.getElementById('detalle-fondo-cine');
        fondoCine.style.backgroundImage = `url(${anime.bannerImage || anime.coverImage.extraLarge || anime.coverImage.large})`;
        fondoCine.classList.add('activo');

        const sinopsisTraducida = await traducirTexto(limpiarSinopsis(anime.description));

        const temporada = anime.season ? `Temporada ${traduccionesTemporada[anime.season.toLowerCase()] || anime.season}` : "Actual";
        const estado = traduccionesEstado[anime.status] || anime.status;

        document.getElementById('detalle-imagen').src = anime.coverImage.extraLarge || anime.coverImage.large;
        document.getElementById('detalle-titulo').innerText = tituloAnime(anime);
        document.getElementById('detalle-meta').innerText = `${anime.format || 'TV'} • ${anime.seasonYear || 'N/A'} • ${temporada} • ${estado}`;
        document.getElementById('detalle-sinopsis').innerText = sinopsisTraducida;
        document.getElementById('detalle-rating-valor').innerText = formatearScore(anime.averageScore);

        if (anime.genres && anime.genres.length > 0) {
            document.getElementById('detalle-tags').innerHTML = anime.genres.map(g => `<span class="tag">${g}</span>`).join('');
        } else { document.getElementById('detalle-tags').innerHTML = '<span class="tag">Sin Clasificar</span>'; }

        animeActualParaBoveda = {
            mal_id: anime.id, title: tituloAnime(anime), image_url: anime.coverImage.extraLarge || anime.coverImage.large,
            type: anime.format, year: anime.seasonYear, status: estado,
            score: anime.averageScore ? anime.averageScore / 10 : null,
            genres: (anime.genres || []).map(g => ({ name: g }))
        };

        const btnGuardar = document.querySelector('#vista-detalles .btn-secundario');
        btnGuardar.style.display = 'flex';
        btnGuardar.onclick = guardarEnBoveda;
    } catch (error) {
        console.error("Fallo al abrir detalles", error);
        document.getElementById('detalle-titulo').innerText = "Error de Sistema. Intenta más tarde.";
    }
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

        // 🔧 MEJORA: Protegemos contra caídas 500 del servidor de Render
        if (!respuesta.ok && respuesta.status !== 400) throw new Error("Fallo en Render Backend");

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

// 🔧 AÑADIDO: Motor de borrado para eliminar animes de MongoDB (CRUD Completo)
async function eliminarDeBoveda(event, mal_id) {
    event.stopPropagation(); // Evita que se abran los detalles al presionar el tacho

    const tarjeta = event.target.closest('.tarjeta-anime');
    tarjeta.style.opacity = '0.5'; // Feedback visual rápido

    try {
        const respuesta = await fetch(`${API_URL}/api/eliminar/${mal_id}`, { method: 'DELETE' });

        // 🔧 MEJORA: Validar el DELETE
        if (!respuesta.ok) throw new Error("Fallo borrando en backend");

        const resultado = await respuesta.json();

        if (respuesta.ok && resultado.status === 'ok') {
            mostrarToast("🗑️ Anime eliminado de la bóveda", "success");
            cargarBoveda(); // Recargamos para actualizar las estadísticas (Puntuación, Géneros)
        } else {
            mostrarToast("Error al eliminar", "error");
            tarjeta.style.opacity = '1';
        }
    } catch (error) {
        console.error(error);
        mostrarToast("❌ No se pudo conectar al servidor", "error");
        tarjeta.style.opacity = '1';
    }
}

async function cargarBoveda() {
    const panelStats = document.getElementById('panel-estadisticas');
    const gridBoveda = document.getElementById('grid-boveda');

    gridBoveda.innerHTML = `<div class="boveda-vacia glass-panel-dark" style="color: var(--acento);">📡 Sincronizando bóveda...</div>`;

    try {
        const respuesta = await fetch(`${API_URL}/api/boveda`);

        // 🔧 MEJORA: Validar que Render esté en línea antes de parsear
        if (!respuesta.ok) throw new Error("Render Backend inalcanzable");

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

        // 🔧 AÑADIDO: Inyectamos el botón de Eliminar (Tacho de basura) en las tarjetas
        gridBoveda.innerHTML = animesGuardados.map(a => `
            <div class="tarjeta-anime" onclick="abrirDetalles(${a.mal_id})">
                <div class="contenedor-portada">
                    <img src="${a.image_url}" alt="${a.title}" loading="lazy">
                    <span class="etiqueta-flotante" style="background: var(--acento); color: #000;">Guardado</span>
                    <button class="btn-eliminar" onclick="eliminarDeBoveda(event, ${a.mal_id})" title="Eliminar anime">🗑️</button>
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

    // Accesibilidad: si el usuario prefiere menos movimiento, no arrancamos la animación
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;

    const katakana = 'アァカサタナハマヤャラワガザダバパイィキシチニヒミリヰギジヂビピウゥクスツヌフムユュルグズブヅプエェケセテネヘメレヱゲゼデベペオォコソトノホモヨョロヲゴゾドボポヴッン';
    const fontSize = 16;
    const columns = canvas.width / fontSize;
    const rainDrops = [];
    for (let x = 0; x < columns; x++) { rainDrops[x] = 1; }

    const draw = () => {
        const fondoRGB = getComputedStyle(document.documentElement).getPropertyValue('--fondo-profundo-rgb').trim() || '11, 15, 25';
        ctx.fillStyle = `rgba(${fondoRGB}, 0.05)`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--acento').trim() || '#8b5cf6';
        ctx.font = `${fontSize}px monospace`;

        for (let i = 0; i < rainDrops.length; i++) {
            const text = katakana.charAt(Math.floor(Math.random() * katakana.length));
            ctx.fillText(text, i * fontSize, rainDrops[i] * fontSize);
            if (rainDrops[i] * fontSize > canvas.height && Math.random() > 0.975) rainDrops[i] = 0;
            rainDrops[i]++;
        }
        requestAnimationFrame(draw);
    };
    draw();

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

function aplicarTema(tema) {
    document.documentElement.setAttribute('data-theme', tema);
    localStorage.setItem('anisync-tema', tema);
    const btnTema = document.getElementById('btn-tema');
    if (btnTema) btnTema.textContent = tema === 'dark' ? '🌙' : '☀️';
}

function iniciarTema() {
    const temaGuardado = localStorage.getItem('anisync-tema');
    const prefiereClaro = window.matchMedia('(prefers-color-scheme: light)').matches;
    aplicarTema(temaGuardado || (prefiereClaro ? 'light' : 'dark'));

    document.getElementById('btn-tema').addEventListener('click', () => {
        const temaActual = document.documentElement.getAttribute('data-theme') || 'dark';
        aplicarTema(temaActual === 'dark' ? 'light' : 'dark');
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
    iniciarTema();
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
