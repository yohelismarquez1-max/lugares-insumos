# Insumos Solidarios

Pagina publica para informar lugares de Venezuela que necesitan insumos. Permite publicar pedidos, filtrar por estado/localidad, verlos en un mapa real de Google Maps y guardar datos en SQLite.

## Requisitos

- Node.js 24 o superior.
- Un disco persistente en produccion para guardar `places.sqlite`.

## Ejecutar en local

```bash
npm start
```

La app queda disponible en:

```txt
http://localhost:4173
```

## Variables de entorno

```txt
PORT=4173
SQLITE_FILE=./data/places.sqlite
IP_HASH_SECRET=una-frase-larga-y-secreta
```

En produccion, `SQLITE_FILE` debe apuntar a un volumen persistente. No uses una ruta temporal.

## Base de datos

La aplicacion usa SQLite nativo de Node (`node:sqlite`). El repositorio incluye `data/places.sqlite` como base inicial versionada. Si la base no existe, se crea automaticamente. Si existe `data/places.json`, se usa una vez para poblar la base inicial.

Archivos temporales que no deben subirse al repositorio:

```txt
data/*.sqlite-shm
data/*.sqlite-wal
```

En produccion, el archivo activo debe vivir en un volumen persistente. GitHub sirve para llevar una base inicial, pero no reemplaza los respaldos ni el almacenamiento persistente del hosting.

## Proteccion anti-spam

El servidor incluye:

- limite de publicaciones por IP
- campo trampa invisible para bots
- tiempo minimo antes de enviar el formulario
- bloqueo de duplicados recientes
- bloqueo de publicaciones con demasiados enlaces
- registro interno de intentos sospechosos

## Despliegue

Lee [DEPLOY.md](./DEPLOY.md) para subirla a Render o Railway con volumen persistente.

Para conectar un dominio propio, lee [DOMAIN.md](./DOMAIN.md).
