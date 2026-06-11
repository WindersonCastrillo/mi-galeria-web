let temporizadorBusqueda;
let vistaAnterior = 'vista-inicio'; 
let catalogoCargado = false; 
let horariosCargados = false;
let animeActualParaBoveda = {}; // Almacena el anime actual para enviarlo a Python

let heroAnimes = [];
let indiceHeroActual = 0;
let intervaloHero;

const traduccionesTemporada = { "spring": "Primavera", "summer": "Verano", "fall": "Otoño", "winter": "Invierno" };
const traduccionesEstado = { "Currently Airing": "En emisión", "Finished Airing": "Finalizado", "Not yet aired": "Próximamente" };

function eliminarDuplicados(animesArray) {
    const vistos = new Set();
    return animesArray.filter(anime => {
        if (vistos.has(anime.mal_id)) return false;
        vistos.add(anime.mal_id);
        return true;
    });
}

function cambiarVista(idVista) {
    if(idVista !== 'vista-detalles') vistaAnterior = idVista; 

    document.querySelectorAll('.vista').forEach(v => v.classList.remove('activa'));
    document.getElementById(idVista).classList.add('activa');
    
    document.getElementById('buscar').value = ''; 
    document.getElementById('lista-resultados').style.display = 'none';

    if (idVista === 'vista-directorio' && !catalogoCargado) {
        cargarDirectorio();
    } else if (idVista === 'vista-calendario' && !horariosCargados) {
        cargarHorario('monday', document.querySelector('.menu-dias button'));
        horariosCargados = true;
    }
}

function volverDeDetalles() {
    cambiarVista(vistaAnterior);
}

// Hero Rotativo
async function iniciarHeroRotativo() {
    try {
        const respuesta = await fetch('https://api.jikan.moe/v4/top/anime?filter=airing&limit=8');
        const data = await respuesta.json();
        heroAnimes = eliminarDuplicados(data.data).filter(a => a.synopsis && a.images.jpg.large_image_url);
        
        if (heroAnimes.length > 0) {
            actualizarUIHero();
            intervaloHero = setInterval(cambiarHeroSiguiente, 7000);
        }
    } catch (error) {
        console.error("Error cargando Hero:", error);
    }
}

function cambiarHeroSiguiente() {
    indiceHeroActual = (indiceHeroActual + 1) % heroAnimes.length;
    actualizarUIHero();
}

function actualizarUIHero() {
    const anime = heroAnimes[indiceHeroActual];
    const contenedor = document.getElementById('hero-contenedor');
    
    contenedor.classList.add('fade-out');

    setTimeout(() => {
        const sinopsisLimpia = anime.synopsis.split('[Written by')[0].trim();
        const temporada = anime.season ? `Temporada ${traduccionesTemporada[anime.season] || anime.season}` : "Actualidad";
        const estado = traduccionesEstado[anime.status] || anime.status;

        document.getElementById('hero-imagen').src = anime.images.jpg.large_image_url;
        document.getElementById('hero-titulo').innerText = anime.title;
        document.getElementById('hero-meta').innerText = `${anime.type || 'TV'} • ${anime.year || new Date().getFullYear()} • ${temporada} • ${estado}`;
        document.getElementById('hero-sinopsis').innerText = sinopsisLimpia;
        document.getElementById('hero-rating').innerText = anime.score ? anime.score.toFixed(2) : "N/A";
        
        if (anime.genres && anime.genres.length > 0) {
            document.getElementById('hero-tags').innerHTML = anime.genres.slice(0,4).map(g => `<span class="tag">${g.name}</span>`).join('');
        }

        document.getElementById('btn-hero-detalles').onclick = () => abrirDetalles(anime.mal_id);
        contenedor.classList.remove('fade-out');
    }, 500); 
}

// Catálogo
async function cargarDirectorio() {
    const grid = document.getElementById('grid-directorio');
    grid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: var(--acento);">Sincronizando catálogo general...</p>';

    try {
        const respuesta = await fetch('https://api.jikan.moe/v4/seasons/now?limit=24');
        const data = await respuesta.json();
        const animesUnicos = eliminarDuplicados(data.data);
        
        grid.innerHTML = animesUnicos.map(a => `
            <div class="tarjeta-anime" onclick="abrirDetalles(${a.mal_id})">
                <div class="contenedor-portada">
                    <img src="${a.images.jpg.image_url}" alt="${a.title}">
                    <span class="etiqueta-flotante">${a.type || 'Anime'}</span>
                </div>
                <div class="info-externa">
                    <p title="${a.title}">${a.title}</p>
                </div>
            </div>
        `).join('');
        catalogoCargado = true;
    } catch (error) {
        grid.innerHTML = '<p style="grid-column: 1 / -1; color: #ef4444; text-align: center;">Error al cargar el catálogo.</p>';
        catalogoCargado = false;
    }
}

// Horarios
async function cargarHorario(dia, btnElement) {
    document.querySelectorAll('.menu-dias .filtro-btn').forEach(btn => btn.classList.remove('activo'));
    btnElement.classList.add('activo');

    const grid = document.getElementById('grid-horarios');
    grid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: var(--acento);">Actualizando cartelera del día...</p>';

    try {
        const respuesta = await fetch(`https://api.jikan.moe/v4/schedules?filter=${dia}&limit=24`);
        const data = await respuesta.json();
        const animesUnicos = eliminarDuplicados(data.data);
        
        if (animesUnicos.length === 0) {
            grid.innerHTML = '<p style="grid-column: 1 / -1; text-align: center;">No hay emisiones este día.</p>';
            return;
        }

        grid.innerHTML = animesUnicos.map(a => `
            <div class="tarjeta-anime" onclick="abrirDetalles(${a.mal_id})">
                <div class="contenedor-portada">
                    <img src="${a.images.jpg.image_url}" alt="${a.title}">
                    <span class="etiqueta-flotante">${a.broadcast.time || 'Emisión TV'}</span>
                </div>
                <div class="info-externa">
                    <p title="${a.title}">${a.title}</p>
                </div>
            </div>
        `).join('');
    } catch (error) {
        grid.innerHTML = '<p style="grid-column: 1 / -1; color: #ef4444; text-align: center;">Error de red en horarios.</p>';
    }
}

// Buscador
document.getElementById('buscar').addEventListener('input', (e) => {
    const query = e.target.value.trim();
    const lista = document.getElementById('lista-resultados');
    clearTimeout(temporizadorBusqueda);

    if (query.length > 2) {
        lista.style.display = 'block';
        lista.innerHTML = `<p style="padding: 10px; margin: 0; color: var(--acento);">Buscando...</p>`;

        temporizadorBusqueda = setTimeout(async () => {
            try {
                const respuesta = await fetch(`https://api.jikan.moe/v4/anime?q=${query}&limit=5`);
                const data = await respuesta.json();
                if (data.data.length === 0) {
                    lista.innerHTML = `<p style="padding: 10px; margin: 0;">No hay resultados.</p>`;
                    return;
                }
                lista.innerHTML = data.data.map(anime => `
                    <div class="tarjeta-busqueda" onclick="abrirDetalles(${anime.mal_id})">
                        <img src="${anime.images.jpg.image_url}" alt="${anime.title}">
                        <div class="tarjeta-busqueda-info">
                            <h4>${anime.title}</h4>
                            <span>${anime.year || 'TV Anime'}</span>
                        </div>
                    </div>
                `).join('');
            } catch (error) {
                lista.innerHTML = `<p style="padding: 10px; margin: 0; color: #ef4444;">Error de red.</p>`;
            }
        }, 400); 
    } else {
        lista.style.display = 'none';
    }
});

// Detalles y Conexión con MongoDB
async function abrirDetalles(idAnime) {
    document.getElementById('lista-resultados').style.display = 'none'; 
    document.getElementById('buscar').value = ''; 
    cambiarVista('vista-detalles');
    
    document.getElementById('detalle-imagen').src = "https://via.placeholder.com/280x420/111827/cbd5e1?text=Cargando...";
    document.getElementById('detalle-titulo').innerText = "Cargando...";
    document.getElementById('detalle-meta').innerText = "Conectando...";
    document.getElementById('detalle-tags').innerHTML = '<span class="tag">Procesando</span>';
    document.getElementById('detalle-sinopsis').innerText = "Conectando a los servidores...";
    document.getElementById('detalle-rating-valor').innerText = "-";

    try {
        const respuesta = await fetch(`https://api.jikan.moe/v4/anime/${idAnime}/full`);
        const data = (await respuesta.json()).data;

        const sinopsisLimpia = data.synopsis ? data.synopsis.split('[Written by')[0].trim() : "Sinopsis no disponible.";
        const temporada = data.season ? `Temporada ${traduccionesTemporada[data.season] || data.season}` : "Actual";
        const estado = traduccionesEstado[data.status] || data.status;

        document.getElementById('detalle-imagen').src = data.images.jpg.large_image_url;
        document.getElementById('detalle-titulo').innerText = data.title;
        document.getElementById('detalle-meta').innerText = `${data.type || 'TV'} • ${data.year || 'N/A'} • ${temporada} • ${estado}`;
        document.getElementById('detalle-sinopsis').innerText = sinopsisLimpia;
        document.getElementById('detalle-rating-valor').innerText = data.score ? data.score.toFixed(2) : "N/A";

        if (data.genres && data.genres.length > 0) {
            document.getElementById('detalle-tags').innerHTML = data.genres.map(g => `<span class="tag">${g.name}</span>`).join('');
        } else {
            document.getElementById('detalle-tags').innerHTML = '<span class="tag">Sin Clasificar</span>';
        }

        // Empaquetamos los datos para enviarlos a Python / MongoDB
        animeActualParaBoveda = {
            mal_id: data.mal_id,
            title: data.title,
            image_url: data.images.jpg.large_image_url,
            type: data.type,
            year: data.year,
            status: estado,
            score: data.score
        };

        // Activamos el botón de guardar
        document.querySelector('.btn-secundario').onclick = guardarEnBoveda;

    } catch (error) {
        document.getElementById('detalle-titulo').innerText = "Error de Sistema";
    }
}

// Función asíncrona para hablar con el Backend Python
async function guardarEnBoveda() {
    const btn = document.querySelector('.btn-secundario');
    btn.innerText = "⏳ Guardando...";
    btn.disabled = true;

    try {
        const respuesta = await fetch('http://localhost:5000/api/guardar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(animeActualParaBoveda)
        });

        const resultado = await respuesta.json();

        if (resultado.status === 'ok') {
            btn.innerText = "✔️ Guardado en Bóveda";
            btn.style.backgroundColor = "#10b981"; 
            btn.style.color = "#000";
        } else if (resultado.status === 'duplicado') {
            btn.innerText = "⚠️ Ya está en tu Bóveda";
            btn.style.backgroundColor = "#fbbf24"; 
            btn.style.color = "#000";
        }
    } catch (error) {
        console.error("Error al conectar con Python:", error);
        btn.innerText = "❌ Servidor Apagado";
    }

    setTimeout(() => {
        btn.innerText = "➕ Agregar a Bóveda";
        btn.style.backgroundColor = "rgba(255,255,255,0.1)";
        btn.style.color = "white";
        btn.disabled = false;
    }, 3000);
}

// INICIO DEL SISTEMA
window.onload = () => {
    cambiarVista('vista-inicio');
    iniciarHeroRotativo();
};