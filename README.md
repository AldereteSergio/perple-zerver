# 🐸 Pepe: Pepe-MCP-Server (Español)

Un servidor de investigación de alta densidad que implementa el Protocolo de Contexto de Modelo (MCP) para ofrecer capacidades de investigación potenciadas por IA a través de la interfaz web de Perplexity.

[![Compatible con MCP](https://img.shields.io/badge/MCP-Compatible-333)]()
[![Base de código en TypeScript](https://img.shields.io/badge/TypeScript-Codebase-333)]()
[![Pruebas superadas](https://img.shields.io/badge/Tests-Passing-333)]()
[![Entorno Node.js](https://img.shields.io/badge/Runtime-Node.js-333)]()

## 📌 Índice
1. [Capacidades de Investigación](#capacidades-de-investigación)
2. [Herramientas Disponibles (Pepe Tools)](#herramientas-disponibles)
3. [Filosofía SCQA + Primeros Principios](#filosofía-scqa--primeros-principios)
4. [Comenzando (Instalación y Configuración)](#comenzando)
5. [Soporte para Cuentas Pro](#-soporte-para-cuentas-pro-opcional)
6. [Comparativa Técnica](#comparativa-técnica)
7. [Solución de Problemas](#solución-de-problemas)
8. [🚀 Roadmap y Visión Futura](ROADMAP.md)

---

## Capacidades de Investigación

- **Investigación Web Inteligente**: Busca y resume contenido sin límites de API.
- **Deep Research**: Modo de investigación profunda y multi-paso para reportes de élite.
- **Selección de Modelos Pro**: Elige entre Claude 3.5 Sonnet, GPT-4o, Sonar y más.
- **Archivos Adjuntos**: Sube imágenes o documentos para que Pepe los analice.
- **Conversaciones Persistentes**: Mantén el contexto con almacenamiento local de chat en SQLite.
- **Extracción de Contenido**: Extracción limpia de artículos con soporte para repositorios de GitHub.
- **Herramientas para Desarrolladores**: Recuperación de documentación, descubrimiento de APIs y análisis de código.
- **Operación sin llaves**: La automatización del navegador reemplaza el requisito de llaves API.

---

## Herramientas Disponibles

### Buscar (`search`)
Investigación web de alta densidad.  
*Requiere SCQA + Primeros Principios. Soporta modelos y archivos adjuntos.*

### Investigación Profunda (`deep_research`)
El modo más potente de Pepe para análisis exhaustivos.  
*Ideal para reportes estratégicos y de mercado.*

### Modo Chat (`chat_perplexity`)
Conversaciones interactivas manteniendo el hilo y contexto histórico.  
*Soporta modelos Pro y archivos adjuntos.*

### Listar Modelos (`list_available_models`)
Muestra los modelos de IA disponibles en tu cuenta de Perplexity.

### Obtener Documentación (`get_documentation`)
Recupera documentación técnica oficial y ejemplos de implementación.

### Encontrar APIs (`find_apis`)
Descubre y compara APIs externas para tus necesidades técnicas.

### Revisar Código Depreciado (`check_deprecated_code`)
Audita fragmentos de código en busca de patrones obsoletos o deuda técnica.

### Extraer Contenido de URL (`extract_url_content`)
Extractor de contenido puro (limpio de anuncios) con soporte para GitHub.

---

## Filosofía SCQA + Primeros Principios

Pepe no es un buscador convencional; es un **ejecutor de planes de investigación**. Para obtener resultados de élite, el agente (tú) debe aplicar:

1.  **SCQA**: Definir la **S**ituación, la **C**omplicación, la **Q**ueja (Pregunta) y la **A**cción (Respuesta esperada).
2.  **Primeros Principios**: Deconstruir problemas complejos en sus verdades fundamentales antes de investigar.

Las descripciones de las herramientas están optimizadas para forzar este comportamiento en los modelos de lenguaje.

---

## Comenzando

### Requisitos Previos
- Node.js 18+ (Recomendado v20+)
- npm (incluido con Node.js)

### Instalación Rápida (npx)
No necesitas clonar el repositorio. Puedes usar a Pepe directamente en tu configuración de MCP:

```json
{
  "mcpServers": {
    "pepe": {
      "command": "npx",
      "args": ["-y", "github:AldereteSergio/Pepe-MCP-Server"],
      "timeout": 300
    }
  }
}
```

### Configuración de Cuenta Pro (Login)
Para acceder a las funciones Pro de Perplexity (modelos avanzados, Deep Research, etc.), debes iniciar sesión una vez:

```bash
npx -y github:AldereteSergio/Pepe-MCP-Server login
```
Esto abrirá una ventana de Chrome/Edge local. Inicia sesión, cierra la ventana y tu sesión quedará guardada de forma persistente en tu carpeta de usuario (`~/.pepe-mcp-session`).

### Instalación Manual (Desarrollo)
```bash
git clone https://github.com/AldereteSergio/Pepe-MCP-Server.git
cd Pepe-MCP-Server
npm install
npm run build
```

### Configuración Manual
Añade esto a tu archivo de configuración de MCP (ej. `mcp.json` en Cursor):
```json
{
  "mcpServers": {
    "pepe": {
      "command": "node",
      "args": ["/ruta/absoluta/a/Pepe-MCP-Server/build/main.js"],
      "timeout": 300
    }
  }
}
```

### Uso
Inicia comandos a través de tu cliente MCP:
- "Usa perplexity para investigar avances en computación cuántica"
- "Pregunta a perple por la documentación de React 18"
- "Inicia una conversación con perplexity sobre redes neuronales"

---

## 🔐 Soporte para Cuentas Pro (Opcional)

Usa tu suscripción de Perplexity Pro para acceder a mejores modelos (Claude 3.5 Sonnet, GPT-4o) y límites más altos.

### Configuración Única
```bash
npm run build
npm run login
```

Se abrirá una ventana del navegador. **Inicia sesión usando correo electrónico** (recomendado para mejor compatibilidad), luego cierra el navegador. ¡Tu sesión quedará guardada!

> **Nota**: El inicio de sesión con Google/SSO puede funcionar, pero el correo electrónico es más confiable con la automatización del navegador.

### Variables de Entorno

| Variable | Por defecto | Descripción |
|----------|---------|-------------|
| `PERPLEXITY_BROWSER_DATA_DIR` | `~/.perplexity-mcp` | Directorio del perfil del navegador |
| `PERPLEXITY_PERSISTENT_PROFILE` | `true` | Cambia a `false` para modo anónimo |

---

## Comparativa Técnica

| Característica       | Esta Implementación | APIs Tradicionales |
|----------------------|---------------------|-------------------|
| Autenticación        | No requerida        | Llaves API        |
| Costo                | Gratis              | Basado en uso     |
| Privacidad de Datos  | Procesamiento local | Servidores remotos|
| Integración GitHub   | Soporte nativo      | Limitado          |
| Persistencia Historial| Almacenamiento SQLite| Basado en sesión  |

---

## Solución de Problemas

**Problemas de Conexión del Servidor**
1. Verifica la ruta absoluta en la configuración.
2. Confirma la instalación de Node.js con `node -v`.
3. Asegúrate de que la compilación terminó con éxito (`npm run build`).

**Extracción de Contenido**
- Las rutas de GitHub deben usar URLs completas del repositorio.
- Ajusta la profundidad de recursión de enlaces en la configuración de origen.

---

## Orígenes y Licencia
 
Basado en - [wysh3/perplexity-mcp-zerver](https://github.com/wysh3/perplexity-mcp-zerver)  

Licenciado bajo **GNU GPL v3.0** - [Ver Licencia](LICENSE)

---

> Este proyecto interactúa con Perplexity a través de la automatización del navegador. Úsalo de manera responsable y ética. La estabilidad depende de la consistencia del sitio web de Perplexity. Solo para uso educativo.
