# mi-galeria-web — AniSync Toshokan

Sitio web estático (HTML/CSS/JS) que sirve como una galería interactiva de animes. Incluye búsqueda usando la API pública Jikan, listado de temporada actual, horarios por día y una "Bóveda" para guardar favoritos mediante un pequeño backend en Python/Flask que persiste en MongoDB.

Estado: proyecto educativo / demostración (no configurado para producción)

---

## Características

- Búsqueda de animes usando la API Jikan (api.jikan.moe).
- Hero rotativo con títulos destacados.
- Catálogo de la temporada actual.
- Horarios de emisión por día.
- Ficha de detalles de cada anime.
- Guardado de favoritos en "Mi Bóveda" mediante un backend (Flask + MongoDB).
- Implementación frontend con HTML5, CSS3 y JavaScript (vanilla).

---

## Estructura del repositorio

```
mi-galeria-web/
├── index.html         # Página principal (frontend)
├── css/
│   └── estilos.css    # Estilos (no se incluye en este README)
├── js/
│   └── app.js         # Lógica JS: consumo de API, SPA y UI
├── server.py          # API simple en Flask para guardar/obtener favoritos (MongoDB)
├── requirements.txt   # Dependencias Python para el backend
└── README.md          # Documentación (este archivo)
```

---

## Tecnologías

- Frontend: HTML, CSS, JavaScript (vanilla)
- APIs externas: Jikan (anime), MyMemory (traducción opcional)
- Backend: Python 3, Flask, PyMongo
- Base de datos: MongoDB (Atlas u otra instancia compatible)

---

## Requisitos

Para usar solo el frontend:
- Navegador moderno (Chrome/Firefox/Edge/Safari)

Para ejecutar el backend localmente:
- Python 3.8+
- pip
- Una instancia de MongoDB accesible (MongoDB Atlas o local)

Instala dependencias del backend:

```bash
pip install -r requirements.txt
```

--

## Ejecutar el proyecto

Opción A — Abrir solo el frontend (rápido, sin guardar favoritos):

1. Clona el repo:

```bash
git clone https://github.com/WindersonCastrillo/mi-galeria-web.git
cd mi-galeria-web
```

2. Abre `index.html` en tu navegador o levanta un servidor estático:

```bash
python3 -m http.server 8000
# Abrir http://localhost:8000
```

Opción B — Ejecutar backend local para usar "Mi Bóveda":

1. Configura la cadena de conexión de MongoDB en `server.py` (reemplaza la URI hardcodeada):

```py
# server.py
cliente = MongoClient('TU_MONGODB_URI_AQUI')
```

2. Crea y activa un entorno virtual (opcional) e instala requisitos:

```bash
python -m venv .venv
source .venv/bin/activate  # Linux / macOS
.\.venv\Scripts\activate   # Windows
pip install -r requirements.txt
```

3. Ejecuta el servidor Flask:

```bash
python server.py
# Por defecto arranca en http://127.0.0.1:5000
```

4. En el frontend, actualiza la constante `API_URL` en `js/app.js` para apuntar a tu backend local (por defecto está configurada a un enlace de Render):

```javascript
const API_URL = 'http://127.0.0.1:5000';
```

Con esto podrás guardar y listar favoritos desde la "Bóveda".

---

## Endpoints del backend (server.py)

- POST /api/guardar
  - Cuerpo: JSON con al menos { mal_id, title, image_url, type, year, status, score }
  - Respuestas:
    - 201: { mensaje: "Anime guardado con éxito", status: "ok" }
    - 200: { mensaje: "Este anime ya está en tu bóveda", status: "duplicado" }

- GET /api/boveda
  - Devuelve: array JSON de animes guardados (sin _id)

Nota: server.py actualmente contiene una URI de MongoDB en claro — reemplaza esa URI por tu credencial/URI segura y no publiques credenciales.

---

## Seguridad y privacidad

- No se deben subir credenciales (URI de MongoDB, claves) al repositorio público.
- Si vas a desplegar el backend, usa variables de entorno para la cadena de conexión y habilita autenticación/SSL en MongoDB.

---

## Contribuciones

Este proyecto es una demostración educativa. Si quieres contribuir:

1. Haz fork del repositorio.
2. Crea una rama feature/mi-cambio.
3. Envía un Pull Request con una descripción clara.

---

## Créditos

- Proyecto/Concepto: AniSync Toshokan — desarrollado por Winderson Castrillo
- APIs: Jikan (https://jikan.moe), MyMemory (opcional)

---

## Licencia

No se especificó una licencia en el repositorio. Si quieres permitir contribuciones/uso libre, añade un archivo LICENSE (por ejemplo MIT). Si prefieres otro modelo, indícalo aquí.

---

Si quieres, puedo:
- Añadir badges (GitHub Pages, licencia, tecnologías)
- Publicar una versión más corta del README enfocada a usuarios finales
- Crear un archivo LICENSE (p. ej. MIT) y añadirlo al repo
