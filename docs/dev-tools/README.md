# Herramientas de desarrollo

Goove incluye herramientas de los tres forks del propietario:

| Biblioteca                                                     | Uso                                                                                                                          | Instalación local                              |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| [Ponytail](https://github.com/borderlesste/ponytail)           | Cambios completos y pequeños; revisión de calidad y deuda                                                                    | Sus seis skills                                |
| [ECC](https://github.com/borderlesste/ECC)                     | React, APIs, accesibilidad, pruebas, migraciones y verificación                                                              | Once skills relevantes para Goove              |
| [Agency Agents](https://github.com/borderlesste/agency-agents) | Perspectivas de frontend, backend, revisión, bases de datos, DevOps, accesibilidad, APIs, AppSec y automatización de pruebas | Nueve skills y nueve perfiles nativos de Codex |

El skill `dev-toolkit` sirve de entrada. Hay **27 skills** en total, incluidos
los seis de Ponytail, los once de ECC y los nueve perfiles convertidos a skills.
Son instrucciones y recursos para el asistente; no cambian el runtime del sitio.
Las copias seleccionadas están versionadas y funcionan sin descargar bibliotecas.

## Uso

En Codex CLI o una extensión compatible, abre el proyecto y usa `$` o `/skills`
para elegir un skill. Ejemplos de peticiones:

- «Usa Ponytail para implementar esta mejora con el menor cambio completo».
- «Usa frontend-patterns y frontend-a11y de ECC para revisar este componente».
- «Usa el perfil Code Reviewer de Agency para revisar este cambio».
- «Usa verification-loop con los comandos reales de Goove para verificarlo».

En un chat que no muestre skills del sistema de archivos en su selector, el
asistente puede leer `AGENTS.md` y el `SKILL.md` correspondiente directamente.
Los perfiles nativos están en `.codex/agents/*.toml`; los skills `agency-*`
permiten aplicar las mismas perspectivas sin iniciar agentes adicionales.
La instalación no activa hooks, servidores MCP ni delegación automática.

Las instrucciones de Goove prevalecen sobre ejemplos genéricos: trabajar en
`main`, sin worktrees ni PRs; mantener React/Vite; usar las integraciones ya
conectadas para GitHub, Supabase y Vercel. Leer un perfil no cambia el modelo ni
los permisos del entorno. Ejecutar un perfil no equivale a haber comprobado sus
afirmaciones: toda conclusión debe apoyarse en el código y las verificaciones.

Codex admite skills de proyecto en `.agents/skills` y perfiles en
`.codex/agents`. Detecta cambios de skills; si el selector no se actualiza,
abre una sesión nueva. Referencia: [documentación de skills](https://developers.openai.com/codex/skills).

## Reinstalación y catálogo completo

```sh
npm run tools:setup
npm run tools:check
```

El instalador necesita Node, Git, Bash y tar. Obtiene exclusivamente los tres
repositorios indicados en `dev-tools.lock.json`, usa commits completos fijados y
extrae las fuentes a `work/dev-tools/sources/<id>-<revision>/`. Estos directorios
incluyen todos los skills, perfiles y documentos originales; se consultan cuando
el trabajo necesita algo fuera de la selección inicial. No ejecuta instaladores
de paquetes ni instala dependencias de esas bibliotecas.

Ponytail y ECC conservan sus archivos originales. Para Agency se usa su conversor
oficial: el formato `antigravity` genera skills del estándar Agent Skills,
compatible con Codex; el formato `codex` genera los TOML nativos. Las salidas
seleccionadas se copian al proyecto. Las licencias MIT se conservan en `licenses/`.

`dev-tools.installed.json` registra las revisiones y los SHA-256 de 39 archivos
gestionados. `tools:check` comprueba esa integridad sin conexión y forma parte de
`npm run check`. El instalador permite repetirse y rechaza sobrescribir ediciones
locales de los archivos gestionados. No modifica la configuración global de Codex.

Para actualizar, revisa los cambios de las bibliotecas, modifica las revisiones
y la selección en el lock, ejecuta `tools:setup`, revisa el diff y verifica antes
de publicar en `main`. Si hay ediciones locales, intégralas deliberadamente antes
de reinstalar. Los cambios en el inventario deben acompañar a sus archivos.

## Verificación de Goove

```sh
npm run check
npx deno task --cwd supabase/functions check
npm audit --audit-level=moderate
```

Usar estos comandos cuando correspondan al cambio. No ejecutar ejemplos de otros
frameworks ni afirmar cifras de cobertura que no se hayan medido.
