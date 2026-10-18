const URL_LOCALIDADES = 'https://apis.datos.gob.ar/georef/api/localidades';
const cache = new Map();

export async function buscarLocalidadesArgentina(consulta) {
  const nombre = consulta.trim();
  if (nombre.length < 3) return [];

  const clave = nombre.toLocaleLowerCase('es-AR');
  if (cache.has(clave)) return cache.get(clave);

  const parametros = new URLSearchParams({
    nombre,
    max: '10',
    campos: 'nombre,provincia.nombre,departamento.nombre',
    orden: 'nombre'
  });
  const respuesta = await fetch(`${URL_LOCALIDADES}?${parametros}`);
  if (!respuesta.ok) throw new Error(`Georef respondió con estado ${respuesta.status}.`);

  const datos = await respuesta.json();
  if (!Array.isArray(datos.localidades)) throw new Error('Georef devolvió una respuesta no válida.');

  const localidades = datos.localidades
    .filter(localidad => localidad.nombre && localidad.provincia?.nombre)
    .map(localidad => ({
      id: localidad.id,
      nombre: localidad.nombre,
      etiqueta: [
        localidad.nombre,
        localidad.departamento?.nombre,
        localidad.provincia.nombre
      ].filter(Boolean).join(', ')
    }));
  cache.set(clave, localidades);
  return localidades;
}
