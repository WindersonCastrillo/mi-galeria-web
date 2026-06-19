const API_URL = 'https://anisync-backend-bpfv.onrender.com'; // Cuando Render nos dé el link, cambiaremos esto aquí

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

// Función para barajar un array (algoritmo Fisher-Yates)
function barajarArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Filtro anti-clones
function eliminarDuplicados(animesArray) {
    const vistos = new Set();
    return animesArray.filter(anime => {
        if (vistos.has(anime.mal_id)) return false;
        vistos.add(anime.mal_id);
        return true;
    });
}

// 1. Navegación SPA
function cambiarVista(idVista) {
    // Si navegamos a cualquier vista que no sea 'detalles', la guardamos como anterior
    // y nos aseguramos de ocultar el fondo de cine.
    if(idVista !== 'vista-detalles') {
        vistaAnterior = idVista; 
        document.getElementById('detalle-fondo-cine').classList.remove('activo');
    }

    document.querySelectorAll('.vista').forEach(v => v.classList.remove('activa'));
    document.getElementById(idVista).classList.add('activa');
    
    document.getElementById('buscar').value = ''; 
    document.getElementById('lista-resultados').style.display = 'none';

    // Cargas Automáticas
    if (idVista === 'vista-directorio' && !catalogoCargado) {
        cargarDirectorio();
    } else if (idVista === 'vista-calendario' && !horariosCargados) {
        cargarHorario('monday', document.querySelector('.menu-dias button'));
        horariosCargados = true;
    } else if (idVista === 'vista-boveda') {
        // Carga la bóveda cada vez que entras para asegurar que esté actualizada
        cargarBoveda();
    }
}

function volverDeDetalles() {
    cambiarVista(vistaAnterior);
}

// ==========================================
// 2. HERO DINÁMICO (Animación y Rotación)
// ==========================================
async function iniciarHeroRotativo() {
    try {
        // Pedimos más animes para tener variedad
        const respuesta = await fetch('https://api.jikan.moe/v4/top/anime?filter=airing&limit=25');
        const data = await respuesta.json();
        
        // Filtramos y luego barajamos los resultados para que el inicio sea siempre diferente
        const animesFiltrados = eliminarDuplicados(data.data).filter(a => a.synopsis && a.images.jpg.large_image_url);
        heroAnimes = barajarArray(animesFiltrados);
        
        if (heroAnimes.length > 0) {
            actualizarUIHero();
            if(intervaloHero) clearInterval(intervaloHero); // Limpiamos el intervalo anterior si existe
            intervaloHero = setInterval(cambiarHeroSiguiente, 8000); // Aumentamos un poco el tiempo
        }
    } catch (error) {
        console.error("Error cargando Hero:", error);
        const contenedor = document.getElementById('hero-contenedor');
        document.getElementById('hero-titulo').innerText = "Error de Sincronización";
        document.getElementById('hero-meta').innerText = "Fallo en la conexión con la API";
        document.getElementById('hero-sinopsis').innerText = "No se pudo cargar el anime destacado. Esto puede deberse a un problema con la red o con el servidor de Jikan. Por favor, intenta recargar la página más tarde.";
        document.getElementById('hero-imagen').src = "https://via.placeholder.com/280x420/111827/ef4444?text=Error";
        document.getElementById('hero-rating').innerText = "---";
        document.getElementById('hero-tags').innerHTML = '<span class="tag">Offline</span>';
        contenedor.classList.remove('fade-out');
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

    const elementosAnimados = [
        document.getElementById('hero-titulo'),
        document.getElementById('hero-meta'),
        document.getElementById('hero-tags'),
        document.getElementById('hero-sinopsis'),
        document.querySelector('#hero-contenedor .acciones-inmersivas')
    ];
    elementosAnimados.forEach(el => el.classList.remove('animate-in'));

    setTimeout(() => {
        const sinopsisLimpia = anime.synopsis.split('[Written by')[0].trim();
        const temporada = anime.season ? `Temporada ${traduccionesTemporada[anime.season] || anime.season}` : "Actualidad";
        const estado = traduccionesEstado[anime.status] || anime.status;

        document.getElementById('hero-imagen').src = anime.images.jpg.large_image_url;
        elementosAnimados[0].innerText = anime.title;
        elementosAnimados[1].innerText = `${anime.type || 'TV'} • ${anime.year || new Date().getFullYear()} • ${temporada} • ${estado}`;
        elementosAnimados[3].innerText = sinopsisLimpia;
        document.getElementById('hero-rating').innerText = anime.score ? anime.score.toFixed(2) : "N/A";
        
        if (anime.genres && anime.genres.length > 0) {
            elementosAnimados[2].innerHTML = anime.genres.slice(0,4).map(g => `<span class="tag">${g.name}</span>`).join('');
        } else {
            elementosAnimados[2].innerHTML = '';
        }

        document.getElementById('btn-hero-detalles').onclick = () => abrirDetalles(anime.mal_id);
        contenedor.classList.remove('fade-out');
    }, 500); 
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
                <div class="contenedor-portada skeleton"></div>
                <div class="info-externa" style="padding-top: 12px;">
                    <p class="skeleton" style="height: 1rem; width: 80%;"></p>
                </div>
            </div>
        `;
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

// ==========================================
// 4. HORARIOS
// ==========================================
async function cargarHorario(dia, btnElement) {
    document.querySelectorAll('.menu-dias .filtro-btn').forEach(btn => btn.classList.remove('activo'));
    btnElement.classList.add('activo');

    const grid = document.getElementById('grid-horarios');
    
    let skeletonHTML = '';
    for (let i = 0; i < 8; i++) {
        skeletonHTML += `
            <div class="tarjeta-anime">
                <div class="contenedor-portada skeleton"></div>
                <div class="info-externa" style="padding-top: 12px;">
                    <p class="skeleton" style="height: 1rem; width: 80%;"></p>
                </div>
            </div>
        `;
    }
    grid.innerHTML = skeletonHTML;

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
                    <img src="${a.images.jpg.image_url}" alt="${a.title}" loading="lazy">
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

// ==========================================
// 5. BUSCADOR
// ==========================================
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
                        <img src="${anime.images.jpg.image_url}" alt="${anime.title}" loading="lazy">
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

// ==========================================
// 6. DETALLES Y CONEXIÓN BÓVEDA
// ==========================================
async function abrirDetalles(idAnime) {
    document.getElementById('lista-resultados').style.display = 'none'; 
    document.getElementById('buscar').value = ''; 
    cambiarVista('vista-detalles');
    
    document.getElementById('detalle-imagen').src = "https://via.placeholder.com/280x420/111827/cbd5e1?text=Cargando...";
    document.getElementById('detalle-titulo').innerHTML = '<div class="skeleton" style="height: 2.2rem; width: 70%; margin-bottom: 8px;"></div>';
    document.getElementById('detalle-meta').innerHTML = '<div class="skeleton" style="height: 0.9rem; width: 90%; margin-bottom: 15px;"></div>';
    document.getElementById('detalle-tags').innerHTML = '<div class="skeleton" style="height: 30px; width: 80%; margin-bottom: 15px;"></div>';
    document.getElementById('detalle-sinopsis').innerHTML = `
        <div class="skeleton" style="height: 1em; width: 100%; margin-bottom: 0.5em;"></div>
        <div class="skeleton" style="height: 1em; width: 100%; margin-bottom: 0.5em;"></div>
        <div class="skeleton" style="height: 1em; width: 90%; margin-bottom: 0.5em;"></div>
        <div class="skeleton" style="height: 1em; width: 60%; margin-bottom: 0.5em;"></div>
    `;
    document.getElementById('detalle-rating-valor').innerText = "-";

    document.querySelector('#vista-detalles .btn-secundario').style.display = 'none';

    try {
        const respuesta = await fetch(`https://api.jikan.moe/v4/anime/${idAnime}/full`);
        const data = (await respuesta.json()).data;

        // MODO CINE: Activar fondo con la imagen del anime
        const fondoCine = document.getElementById('detalle-fondo-cine');
        fondoCine.style.backgroundImage = `url(${data.images.jpg.large_image_url})`;
        fondoCine.classList.add('activo');

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
        const btnGuardar = document.querySelector('#vista-detalles .btn-secundario');
        btnGuardar.style.display = 'flex';
        btnGuardar.onclick = guardarEnBoveda;

    } catch (error) {
        document.getElementById('detalle-titulo').innerText = "Error de Sistema";
    }
}

// Función para ENVIAR a MongoDB
async function guardarEnBoveda() {
    const btn = document.querySelector('#vista-detalles .btn-secundario');
    btn.innerText = "⏳ Guardando...";
    btn.disabled = true;

    try {
        // Usamos la variable API_URL que configuramos arriba
        const respuesta = await fetch(`${API_URL}/api/guardar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(animeActualParaBoveda)
        });
        const resultado = await respuesta.json();

        if (respuesta.ok && resultado.status === 'ok') {
            mostrarToast("✔️ Guardado en tu Bóveda", "success");
        } else if (respuesta.ok && resultado.status === 'duplicado') {
            mostrarToast("⚠️ Ya está en tu Bóveda", "warning");
        } else {
             mostrarToast(resultado.mensaje || "Error al guardar", "error");
        }
    } catch (error) {
        console.error("Error al conectar con el backend:", error);
        mostrarToast("❌ No se pudo conectar al servidor", "error");
    } finally {
        // Re-habilita el botón después de un corto tiempo, la notificación da el feedback principal
        setTimeout(() => {
            btn.innerText = "➕ Agregar a Bóveda";
            btn.disabled = false;
        }, 1500);
    }
}

// Función para TRAER desde MongoDB
async function cargarBoveda() {
    const contenedor = document.querySelector('#vista-boveda');
    
    // Mostramos estado de carga
    contenedor.innerHTML = `
        <h2 class="titulo-pagina">Mi <span>Bóveda</span></h2>
        <div class="boveda-vacia glass-panel-dark" style="padding: 40px; text-align: center; color: var(--acento);">
            📡 Conectando con los servidores de tu base de datos...
        </div>`;
    
    try {
        // Usamos la variable API_URL
        const respuesta = await fetch(`${API_URL}/api/boveda`);
        const animesGuardados = await respuesta.json();

        if (animesGuardados.length === 0) {
            contenedor.innerHTML = `
                <h2 class="titulo-pagina">Mi <span>Bóveda</span></h2>
                <div class="boveda-vacia glass-panel-dark" style="padding: 40px; text-align: center;">
                    🛡️ Tu bóveda está vacía. ¡Ve a explorar el catálogo!
                </div>`;
            return;
        }

        let htmlGrid = `<h2 class="titulo-pagina">Mi <span>Bóveda</span></h2>
                        <div class="grid-catalogo">`;
                        
        htmlGrid += animesGuardados.map(a => `
            <div class="tarjeta-anime" onclick="abrirDetalles(${a.mal_id})">
                <div class="contenedor-portada">
                    <img src="${a.image_url}" alt="${a.title}" loading="lazy">
                    <span class="etiqueta-flotante" style="background: var(--acento); color: #000;">Guardado</span>
                </div>
                <div class="info-externa">
                    <p title="${a.title}">${a.title}</p>
                </div>
            </div>
        `).join('');
        
        htmlGrid += `</div>`;
        contenedor.innerHTML = htmlGrid;

    } catch (error) {
        console.error("Error al cargar la bóveda:", error);
        contenedor.innerHTML = `
            <h2 class="titulo-pagina">Mi <span>Bóveda</span></h2>
            <div class="boveda-vacia glass-panel-dark" style="padding: 40px; text-align: center; color: #ef4444;">
                ❌ Servidor apagado. No se pudo conectar con MongoDB.
            </div>`;
    }
}

// ==========================================
// 7. FONDO TECNOLÓGICO ANIMADO (CANVAS)
// ==========================================
function iniciarFondoTecnologico() {
    const canvas = document.getElementById('fondo-tecnologico');
    if (!canvas) {
        console.error('No se encontró el elemento canvas con id "fondo-tecnologico".');
        return;
    }
    const ctx = canvas.getContext('2d');

    let particlesArray;

    function setupCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    setupCanvas();

    // Clase para las partículas
    class Particle {
        constructor(x, y, directionX, directionY, size, color) {
            this.x = x;
            this.y = y;
            this.directionX = directionX;
            this.directionY = directionY;
            this.size = size;
            this.color = color;
        }
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2, false);
            ctx.fillStyle = this.color;
            ctx.fill();
        }
        update() {
            if (this.x > canvas.width || this.x < 0) { this.directionX = -this.directionX; }
            if (this.y > canvas.height || this.y < 0) { this.directionY = -this.directionY; }
            this.x += this.directionX;
            this.y += this.directionY;
            this.draw();
        }
    }

    function init() {
        particlesArray = [];
        let numberOfParticles = (canvas.height * canvas.width) / 9000;
        for (let i = 0; i < numberOfParticles; i++) {
            let size = (Math.random() * 2) + 1;
            let x = (Math.random() * ((window.innerWidth - size * 2) - (size * 2)) + size * 2);
            let y = (Math.random() * ((window.innerHeight - size * 2) - (size * 2)) + size * 2);
            let directionX = (Math.random() * .4) - .2;
            let directionY = (Math.random() * .4) - .2;
            let color = '#8b5cf6'; // Usando el color de acento del tema (:root --acento)
            particlesArray.push(new Particle(x, y, directionX, directionY, size, color));
        }
    }

    function connect() {
        for (let a = 0; a < particlesArray.length; a++) {
            for (let b = a; b < particlesArray.length; b++) {
                let distance = ((particlesArray[a].x - particlesArray[b].x) * (particlesArray[a].x - particlesArray[b].x)) + ((particlesArray[a].y - particlesArray[b].y) * (particlesArray[a].y - particlesArray[b].y));
                if (distance < 14400) { // Distancia cuadrada (120px)
                    let opacityValue = 1 - (distance / 15000);
                    ctx.strokeStyle = `rgba(139, 92, 246, ${opacityValue})`;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(particlesArray[a].x, particlesArray[a].y);
                    ctx.lineTo(particlesArray[b].x, particlesArray[b].y);
                    ctx.stroke();
                }
            }
        }
    }

    function animate() {
        requestAnimationFrame(animate);
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        for (let i = 0; i < particlesArray.length; i++) {
            particlesArray[i].update();
        }
        connect();
    }

    window.addEventListener('resize', () => {
        setupCanvas();
        init();
    });

    init();
    animate();
}

// ==========================================
// 8. UTILIDADES DE INTERFAZ
// ==========================================
function iniciarUtilidadesUI() {
    const btnScroll = document.getElementById('btn-scroll-top');

    window.addEventListener('scroll', () => {
        if (window.scrollY > 400) {
            btnScroll.classList.add('visible');
        } else {
            btnScroll.classList.remove('visible');
        }
    });

    btnScroll.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

function mostrarToast(mensaje, tipo = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    toast.textContent = mensaje;
    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 4500); // Coincide con la duración de la animación + tiempo en pantalla
}

// INICIO DEL SISTEMA
function iniciarApp() {
    const splashScreen = document.getElementById('splash-screen');
    const logoGrande = document.querySelector('.logo-grande');
    const navbar = document.querySelector('.navbar');
    const mainContent = document.getElementById('contenedor-vistas');

    if (splashScreen && logoGrande) {
        splashScreen.addEventListener('click', () => {
            // 1. Animar el logo a su posición final
            logoGrande.classList.add('minimizado');
            
            // 2. Ocultar la pantalla de bienvenida
            splashScreen.classList.add('oculto');

            // 3. Mostrar el contenido principal
            navbar.classList.remove('contenido-oculto');
            mainContent.classList.remove('contenido-oculto');
            
            // 4. Cargar el contenido dinámico
            cambiarVista('vista-inicio');
            iniciarHeroRotativo();
            iniciarFondoTecnologico();
            iniciarUtilidadesUI();

            // 5. Limpiar el DOM eliminando el splash screen después de la animación
            setTimeout(() => {
                splashScreen.remove();
            }, 1300); // Debe ser mayor que la transición de opacidad del splash
        }, { once: true }); // El evento solo se dispara una vez
    }
};

window.onload = iniciarApp;