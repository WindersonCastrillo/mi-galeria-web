// ==========================================
// REFERENCIAS DOM Y NAVEGACIÓN SPA
// ==========================================
const galeriaTemporada = document.getElementById("galeria-temporada");
const galeriaCalendario = document.getElementById("galeria-calendario");

const inputBuscar = document.getElementById("buscar");
const listaResultados = document.getElementById("lista-resultados");
const panelPreview = document.getElementById("panel-lateral-preview");
const body = document.body;
let temporizadorBusqueda;

const modalDetalle = document.getElementById("modal-detalle");
const btnCerrarModal = document.getElementById("btn-cerrar-modal");
const btnModalGuardar = document.getElementById("btn-modal-guardar");
const botonesDias = document.querySelectorAll(".dia-btn");

let animeModalActual = null;
const RENDER_API_URL = "https://asuna-cloudcore.onrender.com/favoritos"; 

// ==========================================
// CONTROL DE LIENZOS
// ==========================================
function cambiarVista(idVista) {
    cerrarBuscador();
    if(idVista !== 'vista-inicio') {
        body.classList.add('modo-activo');
    } else {
        body.classList.remove('modo-activo');
    }

    document.querySelectorAll('.vista').forEach(vista => vista.classList.remove('activa'));
    document.getElementById(idVista).classList.add('activa');
    document.getElementById(idVista).scrollTo(0, 0);
}

document.getElementById('logo-dinamico').addEventListener('click', () => {
    if(body.classList.contains('modo-activo')) cambiarVista('vista-inicio');
});

// ==========================================
// BÚSQUEDA Y LÓGICA DE LIMPIEZA DE DATOS
// ==========================================
inputBuscar.addEventListener("focus", () => body.classList.add('modo-activo'));

inputBuscar.addEventListener("input", (e) => {
    clearTimeout(temporizadorBusqueda);
    const textoBusqueda = e.target.value.trim();

    if (textoBusqueda.length === 0) { 
        listaResultados.classList.remove("visible"); 
        panelPreview.classList.remove("visible");
        return; 
    }

    temporizadorBusqueda = setTimeout(async () => {
        listaResultados.classList.add("visible");
        listaResultados.innerHTML = "<div style='padding:20px;text-align:center;'>⏳ Buscando...</div>";
        panelPreview.classList.remove("visible"); 
        
        try {
            const res = await fetch(`https://api.jikan.moe/v4/anime?q=${textoBusqueda}&sfw`);
            const json = await res.json();
            const resultados = json.data;
            
            listaResultados.innerHTML = "";
            if (!resultados || resultados.length === 0) {
                listaResultados.innerHTML = "<div style='padding:20px;text-align:center;'>No hay registros.</div>"; 
                return;
            }

            resultados.slice(0, 8).forEach(anime => {
                if (!anime.title || !anime.images?.jpg?.large_image_url) return;
                
                // Limpieza de datos estricta (Si no existe, no aparece)
                let extraInfo = "";
                const hasScore = anime.score != null;
                const hasYear = anime.year != null;
                
                if (hasScore && hasYear) extraInfo = `⭐ ${anime.score} • ${anime.year}`;
                else if (hasScore) extraInfo = `⭐ ${anime.score}`;
                else if (hasYear) extraInfo = `${anime.year}`;
                
                const paragraph = extraInfo ? `<p style="color: #cbd5e1; font-size:0.8rem;">${extraInfo}</p>` : '';

                const item = document.createElement("div");
                item.className = "item-busqueda";
                item.innerHTML = `
                    <img src="${anime.images.jpg.small_image_url || anime.images.jpg.image_url}">
                    <div class="info-mini">
                        <h4>${anime.title}</h4>
                        ${paragraph}
                    </div>
                `;

                item.addEventListener("mouseenter", () => {
                    document.querySelectorAll('.item-busqueda').forEach(el => el.classList.remove('hovered'));
                    item.classList.add('hovered');
                    mostrarPreviewCascada(anime);
                });

                item.addEventListener("click", () => {
                    cerrarBuscador();
                    abrirModal(anime);
                });

                listaResultados.appendChild(item);
            });
        } catch (error) { console.error(error); }
    }, 400); 
});

function mostrarPreviewCascada(anime) {
    panelPreview.classList.add("visible");
    const sinopsisCorta = anime.synopsis ? anime.synopsis : "Sin información disponible en la base de datos.";
    
    panelPreview.innerHTML = `
        <img class="preview-imagen" src="${anime.images.jpg.large_image_url}" alt="${anime.title}">
        <h3 class="preview-titulo">${anime.title}</h3>
        <div class="preview-texto-fade">
            <p>${sinopsisCorta}</p>
        </div>
        <button class="preview-btn" onclick="abrirModalDesdePreview()">Abrir Ficha Completa</button>
    `;
    animeModalActual = anime;
}

window.abrirModalDesdePreview = function() {
    cerrarBuscador();
    if(animeModalActual) abrirModal(animeModalActual);
}

function cerrarBuscador() {
    inputBuscar.value = "";
    listaResultados.classList.remove("visible");
    panelPreview.classList.remove("visible");
}

// ==========================================
// CARGA DE DIRECTORIO / HORARIOS
// ==========================================
async function cargarTemporada() {
    try {
        const res = await fetch("https://api.jikan.moe/v4/seasons/now?sfw");
        const json = await res.json();
        const animesUnicos = json.data.filter((anime, index, self) => index === self.findIndex((a) => a.mal_id === anime.mal_id));
        galeriaTemporada.innerHTML = ""; 
        renderizarTarjetas(animesUnicos.slice(0, 24), galeriaTemporada);
    } catch (error) { console.error(error); }
}

async function cargarDia(dia) {
    try {
        const res = await fetch(`https://api.jikan.moe/v4/schedules?filter=${dia}&sfw`);
        const json = await res.json();
        const animesUnicos = json.data.filter((anime, index, self) => index === self.findIndex((a) => a.mal_id === anime.mal_id));
        galeriaCalendario.innerHTML = "";
        renderizarTarjetas(animesUnicos, galeriaCalendario);
    } catch (error) { console.error(error); }
}

function renderizarTarjetas(animes, contenedor) {
    animes.forEach(anime => {
        if (!anime.title || !anime.images?.jpg?.large_image_url) return;
        const score = anime.score ? `⭐ ${anime.score}` : 'En emisión';
        const tarjeta = document.createElement("article");
        tarjeta.className = "tarjeta";
        tarjeta.innerHTML = `
            <img src="${anime.images.jpg.large_image_url}" loading="lazy">
            <div class="tarjeta-info">
                <h3>${anime.title}</h3>
                <p style="color: var(--acento); font-size: 0.85rem; font-weight: 600;">${score}</p>
            </div>
        `;
        tarjeta.addEventListener("click", () => abrirModal(anime));
        contenedor.appendChild(tarjeta);
    });
}

// ==========================================
// MODAL PREMIUM
// ==========================================
async function abrirModal(anime) {
    animeModalActual = anime; 
    
    document.getElementById("modal-img").src = anime.images.jpg.large_image_url;
    document.getElementById("modal-titulo").textContent = anime.title;
    document.getElementById("modal-score").textContent = anime.score || 'N/A';
    document.getElementById("modal-eps").textContent = anime.episodes || '?';
    document.getElementById("modal-emision").textContent = anime.status || '?';
    
    btnModalGuardar.textContent = "🤍 Guardar en Bóveda";
    btnModalGuardar.style.background = "var(--acento)";
    btnModalGuardar.style.color = "#000";
    btnModalGuardar.disabled = false;

    const contenedorTags = document.getElementById("modal-tags");
    contenedorTags.innerHTML = "";
    if (anime.genres) {
        anime.genres.forEach(g => {
            const span = document.createElement("span"); span.textContent = g.name; contenedorTags.appendChild(span);
        });
    }

    const pSinopsis = document.getElementById("modal-sinopsis");
    const indicador = document.getElementById("indicador-traduccion");
    
    if (anime.synopsis) {
        pSinopsis.textContent = anime.synopsis; 
        indicador.textContent = "Traduciendo...";
        try {
            const textoLimpio = anime.synopsis.substring(0, 499);
            const resTrad = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(textoLimpio)}&langpair=en|es`);
            const dataTrad = await resTrad.json();
            
            if (dataTrad.responseData && dataTrad.responseData.translatedText) {
                pSinopsis.textContent = dataTrad.responseData.translatedText + "...";
                indicador.textContent = "Traducido";
            } else {
                indicador.textContent = "Inglés";
            }
        } catch (e) { indicador.textContent = "Inglés"; }
    } else {
        pSinopsis.textContent = "No hay sinopsis disponible.";
        indicador.textContent = "";
    }

    modalDetalle.classList.add("modal-visible");
}

btnCerrarModal.addEventListener("click", () => modalDetalle.classList.remove("modal-visible"));
window.addEventListener("click", (e) => {
    if (e.target === modalDetalle) modalDetalle.classList.remove("modal-visible");
});

// Guardado Mongo
btnModalGuardar.addEventListener("click", async () => {
    if (!animeModalActual) return;
    btnModalGuardar.textContent = "⏳ Sincronizando...";
    btnModalGuardar.disabled = true;

    try {
        const datosAnime = {
            mal_id: animeModalActual.mal_id,
            titulo: animeModalActual.title,
            imagen: animeModalActual.images.jpg.large_image_url,
            puntaje: animeModalActual.score,
            episodios: animeModalActual.episodes,
            horario_emision: animeModalActual.broadcast ? animeModalActual.broadcast : null 
        };
        const res = await fetch(RENDER_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datosAnime)
        });
        if (!res.ok) throw new Error(`Error HTTP`);
        btnModalGuardar.textContent = "✅ Asegurado en la Bóveda";
        btnModalGuardar.style.background = "#10b981";
        btnModalGuardar.style.color = "#fff";
    } catch (error) {
        btnModalGuardar.textContent = "❌ Error de conexión";
        setTimeout(() => { 
            btnModalGuardar.textContent = "🤍 Guardar en Bóveda"; 
            btnModalGuardar.disabled = false; 
            btnModalGuardar.style.background = "var(--acento)";
            btnModalGuardar.style.color = "#000";
        }, 3000);
    }
});

botonesDias.forEach(b => {
    b.addEventListener("click", (e) => {
        botonesDias.forEach(btn => btn.classList.remove("activo-dia"));
        e.target.classList.add("activo-dia");
        cargarDia(e.target.getAttribute("data-dia"));
    });
});

document.addEventListener("DOMContentLoaded", () => {
    cargarTemporada();
    cargarDia("friday");
});