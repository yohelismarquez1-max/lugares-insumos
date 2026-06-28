# Dominio propio

No se puede registrar un dominio solo desde el codigo: hay que comprarlo en un registrador con una cuenta y metodo de pago. Lo que si queda preparado aqui es la configuracion para conectarlo al hosting.

## Nombres sugeridos

Revisa disponibilidad antes de comprar:

```txt
insumossolidarios.org
insumossolidarios.com
ayudavenezuela.org
mapadeinsumos.org
redinsumosvenezuela.org
```

Para un proyecto publico de ayuda, `.org` suele comunicar mejor la finalidad solidaria. Si el `.org` no esta disponible, usa `.com`.

## Donde comprarlo

Puedes comprarlo en cualquier registrador:

```txt
Cloudflare Registrar
Namecheap
GoDaddy
Google Domains / Squarespace Domains
Porkbun
```

Despues de comprarlo, el panel del registrador te dejara editar DNS.

## Si despliegas en Render

1. En Render, abre el servicio `lugares-insumos`.
2. Ve a Settings > Custom Domains.
3. Agrega el dominio, por ejemplo:

```txt
insumossolidarios.org
```

4. Render mostrara los registros DNS exactos que debes crear.
5. En el DNS del dominio, crea esos registros.
6. Vuelve a Render y pulsa Verify.

Render indica que al agregar el dominio desde el Dashboard hay que configurar DNS en el proveedor y luego verificarlo. Tambien crea/renueva certificados TLS automaticamente.

### render.yaml opcional

Cuando el dominio ya sea tuyo, puedes descomentar este bloque en `render.yaml`:

```yaml
domains:
  - insumossolidarios.org
  - www.insumossolidarios.org
```

Reemplaza `insumossolidarios.org` por el dominio comprado.

## Si despliegas en Railway

1. En Railway, abre el servicio de la app.
2. Ve a Settings > Networking.
3. Agrega el dominio propio.
4. Railway mostrara el registro DNS que debes crear.
5. En el DNS del dominio, crea el CNAME o registro indicado por Railway.
6. Espera la propagacion y verifica el dominio.

## Registros DNS habituales

El hosting te dira los valores exactos. Normalmente sera algo parecido a:

```txt
www    CNAME    tu-app.onrender.com
@      A/CNAME/ALIAS segun indique el hosting o tu proveedor DNS
```

No adivines los valores finales: copialos del panel de Render o Railway.

## Checklist

- Dominio comprado y a tu nombre.
- App desplegada y funcionando con la URL temporal del hosting.
- Dominio agregado en Render/Railway.
- DNS creado en el registrador.
- HTTPS activo.
- La version con `www` y sin `www` abre correctamente.
