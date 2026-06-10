// Referencias principales del DOM
const galeria = document.getElementById("galeria");
const heroSlider = document.getElementById("hero-slider");
const tituloHero = document.getElementById("hero-titulo");
const sinopsisHero = document.getElementById("hero-sinopsis");
const generosHero = document.querySelector(".generos");
const posterHero = document.getElementById("hero-img-src");

// Botón de guardado en Mongo
const btnGuardarFavorito = document.getElementById("btn-guardar-favorito");

// Referencias de navegación
const btnTemporada = document.getElementById("btn-temporada");
const btnCalendario = document.getElementById("btn-calendario");
const menuDias = document.getElementById("menu-dias");
const botonesDias = document.querySelectorAll(".dia-btn");

// Variable global para saber qué anime está en el Hero Slider en este momento
let animeDestacadoActual = null;

// ==========================================
// CONFIGURACIÓN DE TU BACKEND (RENDER + MONGO)
// ==========================================
// ¡Kirito, aquí debes poner la URL de tu API alojada en Render!
// Por ahora dejo una de prueba (JSONPlaceholder) para que no dé error, pero cámbiala por la tuya.
const RENDER_API_URL = "https://asuna-cloudcore.onrender.com/favoritos";

// ==========================================
// FUNCIÓN 1: CARGAR TEMPORADA (Endpoint principal)
// ==========================================
async function cargarTemporada() {
    galeria.innerHTML = "<p style='text-align:center; color:white; grid-column: 1 / -1;'>Conectando a los servidores de Jikan...</p>";
    
    try {
        const res = await fetch("https://api.jikan.moe/v4/seasons/now?sfw");
        if (!res.ok) throw new Error(`Error HTTP: ${res.status}`);
        
        const json = await res.json();
        
        // Filtro Antiduplicados
        const animesUnicos = json.data.filter((anime, index, self) =>
            index === self.findIndex((a) => a.mal_id === anime.mal_id)
        );
        
        if (!animesUnicos || animesUnicos.length === 0) return;

        // Actualizamos el Hero con el anime más popular y lo guardamos en la variable global
        animeDestacadoActual = animesUnicos[0];
        actualizarHero(animeDestacadoActual);

        galeria.innerHTML = ""; 
        const animesGaleria = animesUnicos.slice(1, 16); 
        renderizarTarjetas(animesGaleria);

    } catch (error) {
        mostrarError(error);
    }
}

// ==========================================
// FUNCIÓN 2: CARGAR CALENDARIO POR DÍA
// ==========================================
async function cargarDia(dia) {
    galeria.innerHTML = "<p style='text-align:center; color:white; grid-column: 1 / -1;'>Cargando animes programados...</p>";
    
    try {
        const res = await fetch(`https://api.jikan.moe/v4/schedules?filter=${dia}&sfw`);
        if (!res.ok) throw new Error(`Error HTTP: ${res.status}`);
        
        const json = await res.json();
        
        // Filtro Antiduplicados
        const animesUnicos = json.data.filter((anime, index, self) =>
            index === self.findIndex((a) => a.mal_id === anime.mal_id)
        );
        
        galeria.innerHTML = "";
        
        if (!animesUnicos || animesUnicos.length === 0) {
            galeria.innerHTML = "<p style='color:white; text-align:center; grid-column: 1 / -1;'>No hay animes fuertes programados para este día.</p>";
            return;
        }

        renderizarTarjetas(animesUnicos);

    } catch (error) {
        mostrarError(error);
    }
}

// ==========================================
// FUNCIÓN BONUS: PETICIÓN POST A RENDER/MONGO
// ==========================================
async function guardarEnMongoDB(anime) {
    // Si no hay anime cargado, no hacemos nada
    if (!anime) return;

    // Cambiamos el texto del botón para que el usuario sepa que está cargando
    const textoOriginal = btnGuardarFavorito.textContent;
    btnGuardarFavorito.textContent = "⏳ Guardando...";
    btnGuardarFavorito.disabled = true;

    try {
        // Armamos el JSON con los datos específicos que queremos guardar en tu base de datos
        const datosAnime = {
            mal_id: anime.mal_id,
            titulo: anime.title,
            imagen: anime.images.jpg.large_image_url,
            puntaje: anime.score,
            episodios: anime.episodes
        };

        // Hacemos el fetch con método POST
        const res = await fetch(RENDER_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(datosAnime)
        });

        if (!res.ok) throw new Error(`Error HTTP POST: ${res.status}`);

        const respuestaBackend = await res.json();
        console.log("¡Éxito! Datos guardados en la Base de Datos:", respuestaBackend);
        
        // Alerta bonita para confirmar
        btnGuardarFavorito.textContent = "✅ ¡Guardado!";
        btnGuardarFavorito.style.background = "#10b981"; // Lo ponemos verde
        btnGuardarFavorito.style.borderColor = "#10b981";

        // Volvemos al estilo normal después de 2 segundos
        setTimeout(() => {
            btnGuardarFavorito.textContent = textoOriginal;
            btnGuardarFavorito.style.background = "rgba(255, 255, 255, 0.1)";
            btnGuardarFavorito.style.borderColor = "rgba(255, 255, 255, 0.2)";
            btnGuardarFavorito.disabled = false;
        }, 2000);

    } catch (error) {
        console.error("Error al intentar guardar en Mongo:", error);
        alert("Ocurrió un error al guardar el favorito. Revisa la consola.");
        btnGuardarFavorito.textContent = textoOriginal;
        btnGuardarFavorito.disabled = false;
    }
}

// ==========================================
// FUNCIONES AUXILIARES (Renderizado y Errores)
// ==========================================
function renderizarTarjetas(animes) {
    animes.forEach(anime => {
        if (!anime.title || !anime.images?.jpg?.large_image_url) return;

        const tarjeta = document.createElement("article");
        tarjeta.className = "tarjeta";
        
        tarjeta.innerHTML = `
            <img src="${anime.images.jpg.large_image_url}" alt="Portada de ${anime.title}">
            <div class="tarjeta-info">
                <h3>${anime.title}</h3>
                <p style="color: #ff5722; font-size: 0.85rem; font-weight: 600;">
                    ⭐ ${anime.score || 'N/A'} &nbsp; • &nbsp; ${anime.episodes ? anime.episodes + ' Eps' : 'Emisión'}
                </p>
            </div>
        `;
        galeria.appendChild(tarjeta);
    });
}

function actualizarHero(anime) {
    tituloHero.textContent = anime.title;
    sinopsisHero.textContent = anime.synopsis ? anime.synopsis : "Sin sinopsis disponible.";
    posterHero.src = anime.images.jpg.large_image_url;
    heroSlider.style.backgroundImage = `url('${anime.images.jpg.large_image_url}')`;
    
    generosHero.innerHTML = "";
    if (anime.genres && anime.genres.length > 0) {
        anime.genres.slice(0, 3).forEach(genero => {
            const span = document.createElement("span");
            span.textContent = genero.name;
            generosHero.appendChild(span);
        });
    }
}

function mostrarError(error) {
    console.error("Error en la petición:", error);
    galeria.innerHTML = `<p style='color: #ff5722; text-align:center; grid-column: 1 / -1;'>
        Ocurrió un error al cargar los datos. <br> Detalle: ${error.message}
    </p>`;
}

// ==========================================
// EVENTOS DE BOTONES Y PESTAÑAS
// ==========================================

// Evento para el botón de POST (Guardar en Mongo)
btnGuardarFavorito.addEventListener("click", () => {
    guardarEnMongoDB(animeDestacadoActual);
});

btnCalendario.addEventListener("click", () => {
    btnCalendario.classList.add("activo");
    btnTemporada.classList.remove("activo");
    
    heroSlider.style.display = "none"; 
    menuDias.style.display = "flex";   
    
    cargarDia("friday"); 
});

btnTemporada.addEventListener("click", () => {
    btnTemporada.classList.add("activo");
    btnCalendario.classList.remove("activo");
    
    menuDias.style.display = "none";   
    heroSlider.style.display = "block"; 
    
    cargarTemporada(); 
});

botonesDias.forEach(boton => {
    boton.addEventListener("click", (e) => {
        botonesDias.forEach(b => b.classList.remove("activo-dia"));
        e.target.classList.add("activo-dia");
        
        const diaSeleccionado = e.target.getAttribute("data-dia");
        cargarDia(diaSeleccionado);
    });
});

// Iniciar aplicación al cargar la página
document.addEventListener("DOMContentLoaded", cargarTemporada);