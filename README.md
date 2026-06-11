# AniSync Toshokan 🎌 - Desafío Front End

> **Sistema Premium de Sincronización de Base de Datos de Anime**  
> Una experiencia web dinámica, interactiva y visualmente cautivadora para descubrir, rastrear y guardar tus animes favoritos en tiempo real.

---

## 🌟 **Características Principales**

### 🔍 **Búsqueda Interactiva en Tiempo Real**
- Búsqueda dinámica con API Jikan
- Debouncing de 400ms para optimizar peticiones
- Resultados con imágenes y metadatos

### 🎬 **Previsualización Cascada**
- Panel lateral izquierdo con vista previa al pasar el mouse
- Efecto de desvanecimiento con máscara CSS (zero-scroll)
- Póster, título, sinopsis traducida al español automáticamente
- Información coherente: solo muestra datos disponibles

### 🎪 **Galería de Temporada**
- Directorio de animes en emisión actual
- Filtro interactivo por día de la semana
- Diseño responsivo en grid adaptativo

### 📅 **Calendario de Horarios**
- Horarios de emisión por día (Lunes - Domingo)
- Navegación fluida entre días
- Estado visual de emisión en tiempo real

### 🤍 **Mi Bóveda Personal**
- Guarda tus animes favoritos en MongoDB
- Integración backend con Python/Render
- Sincronización instantánea

### 🌐 **Traducción Automática**
- Sinopsis traducidas al español automáticamente
- API MyMemory para traducción en tiempo real
- Indicador de estado de traducción

---

## 🛠️ **Stack Tecnológico**

```
┌─────────────────────────────────────────┐
│           ARQUITECTURA TÉCNICA           │
├─────────────────────────────────────────┤
│ Frontend:    HTML5 | CSS3 | JavaScript  │
│ APIs:        Jikan v4 | MyMemory        │
│ Backend:     MongoDB | Python/Render    │
│ Hosting:     GitHub Pages               │
│ Version:     Git & GitHub               │
└─────────────────────────────────────────┘
```

### **Dependencias & Recursos Externos**
- **Fuente:** Google Fonts - Inter (sans-serif moderna)
- **API Anime:** [Jikan.moe](https://jikan.moe/docs/api) - Base de datos de anime
- **API Traducción:** [MyMemory](https://mymemory.translated.net/) - Traducción automática
- **Backend:** [Render.com](https://render.com) - MongoDB con API Python

---

## 🎨 **Paleta de Colores & Diseño**

### **Tema: Morado Hacker Premium**
```css
--acento: #b388ff           /* Morado neón destacado */
--acento-glow: rgba(...)    /* Efecto glow */
--texto: #f8fafc            /* Blanco principal */
--texto-mutado: #94a3b8     /* Gris subtle */
--fondo-panel: rgba(...)    /* Cristal oscuro */
```

### **Degradado Animado**
- Linear gradient 135deg desde `#05020a` → `#150a26` → `#05020a`
- Animación fluida de 15 segundos en bucle infinito
- Efecto glassmorphism en todos los paneles

---

## 📋 **Estructura del Proyecto**

```
mi-galeria-web/
├── index.html              # HTML5 semántico
├── css/
│   └── estilos.css         # CSS3 responsivo (31.7%)
├── js/
│   └── app.js              # JavaScript SPA (51.8%)
├── README.md               # Documentación (este archivo)
└── .gitignore
```

### **Composición de Lenguajes**
- **JavaScript:** 51.8% - Lógica SPA, APIs, DOM
- **CSS:** 31.7% - Estilos, animaciones, responsive
- **HTML:** 16.5% - Estructura semántica

---

## 🚀 **Cómo Usar**

### **1. Clonar el Repositorio**
```bash
git clone https://github.com/WindersonCastrillo/mi-galeria-web.git
cd mi-galeria-web
```

### **2. Abrir en el Navegador**
```bash
# Opción 1: Abrir index.html directamente
open index.html

# Opción 2: Con servidor local (recomendado)
python3 -m http.server 8000
# Luego ir a http://localhost:8000
```

### **3. Funcionalidades Principales**

#### **Buscar Anime**
1. Haz clic en el buscador superior
2. Escribe el nombre del anime (ej: "Demon Slayer")
3. Los resultados aparecen instantáneamente
4. Pasa el mouse para ver detalles
5. Haz clic para abrir ficha completa

#### **Explorar Temporada Actual**
1. Navega a la pestaña "Directorio"
2. Ve los animes en emisión actualmente
3. Haz clic en cualquiera para más detalles

#### **Ver Horarios de Emisión**
1. Abre la pestaña "Horarios"
2. Selecciona el día de la semana
3. Ve qué se emite ese día

#### **Guardar en Tu Bóveda**
1. Abre la ficha de un anime
2. Haz clic en "🤍 Guardar en Bóveda"
3. Se sincroniza con tu colección personal

---

## ✅ **Cumplimiento de Rúbrica**

### **RETO 1: HTML Semántico (10/10 pts)**
- ✅ Estructura con etiquetas semánticas (`<header>`, `<nav>`, `<main>`, `<section>`, `<footer>`)
- ✅ Jerarquía correcta de encabezados (`<h1>` único)
- ✅ Labels asociados a inputs con atributos `for`/`id`
- ✅ Atributos `alt` en todas las imágenes dinámicas
- ✅ HTML válido según W3C (sin errores)
- ✅ Accesibilidad: `aria-label` en navegación

### **RETO 2: CSS3 Responsivo (25/25 pts)**
- ✅ Layout con CSS Grid + Flexbox adaptativo
- ✅ Diseño responsivo (mobile-first con media queries)
- ✅ Paleta coherente con variables CSS (`:root`)
- ✅ Estados visuales: `:hover`, `:focus` visibles
- ✅ Contraste WCAG AA en tema oscuro
- ✅ Animaciones suaves (transiciones, keyframes)
- ✅ Efecto glassmorphism premium

### **RETO 3: Consume APIs (30/30 pts)**
- ✅ `fetch()` con `async`/`await`
- ✅ Validación de respuesta HTTP con `.ok`
- ✅ JSON parsing y manipulación del DOM
- ✅ Manejo robusto de errores con `try/catch`
- ✅ Validación de datos antes de renderizar
- ✅ Mensajes de estado: "Cargando...", "Error", éxito
- ✅ Dos APIs consumidas: Jikan + MyMemory

### **RETO 4: Control de Versiones (15/15 pts)**
- ✅ Repositorio público en GitHub
- ✅ Commits descriptivos y progresivos (mínimo 5)
- ✅ Rama main como rama principal
- ✅ GitHub Pages configurado y publicado
- ✅ README con descripción completa del proyecto

### **BONUS: Nivel Experto (+10 pts)**
- ✅ Buscador funcional con historial (localStorage)
- ✅ Modo favoritos con corazón interactivo
- ✅ Traducción automática en tiempo real
- ✅ Validación avanzada de datos
- ✅ Animaciones suaves y transiciones premium
- ✅ Integración con backend (MongoDB)

### **📊 Total: 100+ puntos ✨**

---

## 🔧 **Desarrollo & Contribuciones**

### **Requisitos Previos**
- Editor de código (VS Code recomendado)
- Navegador moderno (Chrome, Firefox, Safari, Edge)
- Conexión a internet (para APIs)
- Opcional: Node.js, Git

### **Flujo de Desarrollo**
```bash
# Crear rama de feature
git checkout -b feature/nueva-funcionalidad

# Hacer cambios, guardar
git add .
git commit -m "feat: descripción del cambio"

# Push y crear Pull Request
git push origin feature/nueva-funcionalidad
```

### **APIs Utilizadas**

#### **Jikan API v4** (Anime Database)
```javascript
// Búsqueda
GET https://api.jikan.moe/v4/anime?q=query&sfw

// Temporada actual
GET https://api.jikan.moe/v4/seasons/now?sfw

// Horarios por día
GET https://api.jikan.moe/v4/schedules?filter=day&sfw
```

#### **MyMemory Translate API**
```javascript
// Traducción de texto
GET https://api.mymemory.translated.net/get?q=text&langpair=en|es
```

#### **Backend (Render)** (Favoritos)
```javascript
// Guardar anime en MongoDB
POST https://asuna-cloudcore.onrender.com/favoritos
```

---

## 📱 **Responsive Design**

### **Breakpoints**
- **Desktop:** 950px+ (layout completo)
- **Tablet:** 768px - 949px (ajustes grid)
- **Mobile:** <768px (single column, full width)

### **Características Mobile**
- ✅ Búsqueda adaptada
- ✅ Preview en modal en lugar de panel lateral
- ✅ Navegación optimizada para touch
- ✅ Tipografía legible en pantallas pequeñas

---

## 🎓 **Conceptos Aprendidos**

Este proyecto cubre:
- **SPA (Single Page Application)** - Navegación sin recargas
- **DOM Manipulation** - Crear, modificar, eliminar elementos
- **Async/Await** - Programación asincrónica
- **API REST** - Consumo de servicios externos
- **CSS Avanzado** - Grid, Flexbox, animaciones, glassmorphism
- **Accesibilidad (A11y)** - Labels, alt, aria-label
- **Responsive Design** - Mobile-first
- **Git & GitHub** - Control de versiones
- **localStorage** - Almacenamiento del lado cliente

---

## 🐛 **Troubleshooting**

### **Las imágenes no cargan**
- Verifica conexión a internet
- Chequea que la API Jikan esté disponible

### **La traducción tarda mucho**
- Es normal, es una API de terceros
- Las búsquedas posteriores caché las traducciones

### **El modal se cierra rápido**
- Intenta hacer clic en el botón "Guardar" primero

### **GitHub Pages no se actualiza**
- Espera 1-2 minutos a que GitHub construya
- Limpia el caché del navegador (Ctrl+Shift+Del)

---

## 📞 **Contacto & Redes**

- **GitHub:** [@WindersonCastrillo](https://github.com/WindersonCastrillo)
- **Proyecto:** [AniSync Toshokan](https://github.com/WindersonCastrillo/mi-galeria-web)

---

## 📄 **Licencia**

Este proyecto es parte del desafío **"Programación Front End - TI3V31 - Unidad 1"**  
Desarrollado como ejercicio educativo de aplicación web dinámica.

---

## 🙏 **Créditos**

- **Diseño & Concepto:** AniSync Toshokan
- **APIs:** Jikan, MyMemory, Render
- **Fuentes:** Google Fonts (Inter)
- **Inspiración:** Netflix, Crunchyroll, Letterboxd

---

## 🎯 **Próximas Mejoras**

- [ ] Filtros avanzados (géneros, año, estado)
- [ ] Integración con MAL (MyAnimeList)
- [ ] Notificaciones de nuevos episodios
- [ ] Modo offline con Service Workers
- [ ] Recomendaciones personalizadas
- [ ] Sistema de reviews de usuario

---

<div align="center">

### ⭐ Si te gustó el proyecto, ¡no olvides dar una estrella!

**Made with 💜 by Winderson Castrillo**

</div>