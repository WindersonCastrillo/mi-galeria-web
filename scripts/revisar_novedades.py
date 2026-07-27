"""
Revisa la Bóveda de AniSync Toshokan contra AniList y detecta episodios nuevos.

Pensado para correr sin dependencias externas (solo stdlib) porque lo ejecuta
una rutina en la nube de Claude Code que no garantiza `pip install` previo.

Uso:
    python3 revisar_novedades.py

Variable de entorno opcional:
    API_URL  (por defecto apunta al backend en Render)

Salida: una línea por anime con episodio nuevo detectado, formato
    NOVEDAD | <título> | episodio <N>
para que el agente que lo invoque decida si notifica o no. Sin salida = sin novedades.
"""
import json
import os
import urllib.request
import urllib.error

API_URL = os.environ.get("API_URL", "https://anisync-backend-bpfv.onrender.com")
ANILIST_URL = "https://graphql.anilist.co"
TIMEOUT_SEGUNDOS = 20

QUERY_ANILIST = """
query ($ids: [Int]) {
    Page(perPage: 50) {
        media(id_in: $ids, type: ANIME) {
            id
            episodes
            status
            nextAiringEpisode { episode }
        }
    }
}
"""


def solicitar_http(url, metodo="GET", cuerpo=None):
    datos = json.dumps(cuerpo).encode("utf-8") if cuerpo is not None else None
    # AniList (detrás de Cloudflare) devuelve 403 al User-Agent por defecto de urllib.
    headers = {"User-Agent": "AniSyncToshokan/1.0", "Accept": "application/json"}
    if datos:
        headers["Content-Type"] = "application/json"
    peticion = urllib.request.Request(url, data=datos, method=metodo, headers=headers)
    with urllib.request.urlopen(peticion, timeout=TIMEOUT_SEGUNDOS) as respuesta:
        crudo = respuesta.read()
        return json.loads(crudo) if crudo else None


def obtener_boveda():
    return solicitar_http(f"{API_URL}/api/boveda")


def consultar_anilist_batch(ids):
    resultado = {}
    for inicio in range(0, len(ids), 50):
        lote = ids[inicio:inicio + 50]
        cuerpo = {"query": QUERY_ANILIST, "variables": {"ids": lote}}
        respuesta = solicitar_http(ANILIST_URL, metodo="POST", cuerpo=cuerpo)
        for media in respuesta["data"]["Page"]["media"]:
            resultado[media["id"]] = media
    return resultado


def episodios_disponibles(media):
    if media["status"] == "RELEASING" and media.get("nextAiringEpisode"):
        return media["nextAiringEpisode"]["episode"] - 1
    if media["status"] == "FINISHED" and media.get("episodes"):
        return media["episodes"]
    return None


def actualizar_episodio(mal_id, ultimo_episodio_visto, tiene_novedad):
    solicitar_http(
        f"{API_URL}/api/boveda/{mal_id}/episodio",
        metodo="PATCH",
        cuerpo={"ultimo_episodio_visto": ultimo_episodio_visto, "tiene_novedad": tiene_novedad},
    )


def main():
    try:
        boveda = obtener_boveda()
    except (urllib.error.URLError, urllib.error.HTTPError) as error:
        print(f"ERROR | No se pudo leer la Bóveda: {error}")
        return

    if not boveda:
        return

    ids = [anime["mal_id"] for anime in boveda if anime.get("mal_id")]
    if not ids:
        return

    try:
        info_anilist = consultar_anilist_batch(ids)
    except (urllib.error.URLError, urllib.error.HTTPError) as error:
        print(f"ERROR | No se pudo consultar AniList: {error}")
        return

    for anime in boveda:
        mal_id = anime.get("mal_id")
        media = info_anilist.get(mal_id)
        if not media:
            continue

        disponibles = episodios_disponibles(media)
        if disponibles is None:
            continue

        ultimo_visto = anime.get("ultimo_episodio_visto")

        try:
            if ultimo_visto is None:
                # Primera revisión: fijamos línea base sin avisar, para no generar
                # una novedad falsa por cada anime ya existente en la Bóveda.
                actualizar_episodio(mal_id, disponibles, False)
                continue

            if disponibles > ultimo_visto:
                actualizar_episodio(mal_id, disponibles, True)
                print(f"NOVEDAD | {anime.get('title', mal_id)} | episodio {disponibles}")
        except (urllib.error.URLError, urllib.error.HTTPError) as error:
            print(f"ERROR | No se pudo actualizar {anime.get('title', mal_id)}: {error}")
            continue


if __name__ == "__main__":
    main()
