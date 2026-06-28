# Guia corta de despliegue

Esta app necesita Node 24 y un volumen persistente para SQLite. Evita hostings donde el sistema de archivos se borra en cada deploy si no agregas una base externa.

## Opcion recomendada: Render

El archivo `render.yaml` ya define:

- runtime Node
- comando de arranque `npm start`
- variable `SQLITE_FILE=/var/data/places.sqlite`
- disco persistente montado en `/var/data`
- `IP_HASH_SECRET` generado automaticamente

Pasos:

1. Sube este proyecto a un repositorio de GitHub.
2. En Render, crea un nuevo Blueprint desde ese repositorio.
3. Revisa que el servicio tenga un disco persistente montado en `/var/data`.
4. Despliega.
5. Abre la URL publica y publica un registro de prueba.
6. Reinicia el servicio desde Render y confirma que el registro sigue ahi.

Si creas el servicio manualmente en Render:

```txt
Build command: npm install
Start command: npm start
NODE_VERSION: 24
SQLITE_FILE: /var/data/places.sqlite
IP_HASH_SECRET: una-frase-larga-y-secreta
Persistent disk mount path: /var/data
```

## Opcion recomendada: Railway

Railway normalmente configura el volumen desde el panel del proyecto. El archivo `railway.json` deja preparado el comando de arranque.

Pasos:

1. Sube este proyecto a GitHub.
2. En Railway, crea un proyecto desde el repositorio.
3. Crea un volumen y montalo en:

```txt
/app/data
```

4. Configura variables:

```txt
NODE_VERSION=24
SQLITE_FILE=/app/data/places.sqlite
IP_HASH_SECRET=una-frase-larga-y-secreta
```

5. Despliega.
6. Publica un registro de prueba.
7. Reinicia el servicio y confirma que el registro sigue guardado.

## Checklist antes de compartir la pagina

- La pagina abre por HTTPS.
- Puedes publicar un pedido real.
- La publicacion permanece despues de reiniciar el servicio.
- El mapa carga correctamente.
- `IP_HASH_SECRET` no usa el valor de ejemplo.
- El archivo SQLite vive en un volumen persistente.
- El dominio propio apunta al hosting, si vas a usar uno.
- Tienes una forma de descargar o respaldar `places.sqlite`.

## Dominio propio

Lee [DOMAIN.md](./DOMAIN.md). Ahi estan los nombres sugeridos, los pasos DNS y el bloque opcional para activar dominios en `render.yaml`.
