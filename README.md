# Entregas Distritodo — App instalable (PWA)

Registro de entregas con usuarios, permisos por almacén, evidencia fotografica,
firma del cliente y datos compartidos en la nube.

---

## Pasos para publicarla (resumen)

Es el mismo proceso que ya conoces:

1. **GitHub:** crea un repositorio y sube el CONTENIDO de esta carpeta
   (package.json, index.html, vite.config.js, src, public, etc.) en la raiz.
   Usa "choose your files" para evitar que Windows traduzca los nombres.
2. **Vercel:** Add New -> Project -> importa el repositorio -> Deploy.
   Deja Root Directory vacio (los archivos estan en la raiz).
3. **Supabase (nube):** sigue la guia PDF para crear la base de datos y pegar
   las dos claves en `src/App.jsx`.

---

## Conectar la base de datos (Supabase)

1. Crea un proyecto en supabase.com.
2. En el SQL Editor, ejecuta este texto para crear la tabla:

```sql
create table datos (
  id integer primary key,
  contenido jsonb
);

alter table datos enable row level security;

create policy "lectura publica" on datos for select using (true);
create policy "escritura publica" on datos for all using (true) with check (true);

insert into datos (id, contenido) values (1, '{}');
```

3. En Settings -> API copia el **Project URL** y la **clave publica** (anon/publishable).
4. En `src/App.jsx`, cerca del inicio, pega ambos en el bloque
   "CONEXION A LA BASE DE DATOS":

```javascript
const SUPABASE_URL = "https://TU-PROYECTO.supabase.co";
const SUPABASE_KEY = "TU_CLAVE_PUBLICA_AQUI";
```

5. Guarda (Commit). Vercel republica solo. En la app, arriba debe verse
   el icono de nube indicando que esta sincronizada.

---

## Usuarios y claves de ejemplo (cambialos en la app)

- Administrador -> PIN 1234 (acceso total)
- Repartidor Centro -> PIN 1111
- Repartidor Norte -> PIN 2222

El administrador puede crear/editar usuarios, asignar almacenes con su prefijo
de documento, y definir permisos (incluido el de registrar motocicletas).

---

## Notas

- La camara funciona en el celular cuando la app esta publicada (https). Tambien
  existe "Galeria" para elegir una foto existente.
- Cada entrega guarda foto + firma comprimidas. Para un volumen muy alto de
  entregas con fotos, conviene revisar el espacio del plan de Supabase.
- El acceso por PIN es una barrera practica de organizacion, no seguridad fuerte.
