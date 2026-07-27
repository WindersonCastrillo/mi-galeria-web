import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient

app = Flask(__name__)
# Habilitamos CORS para que el frontend HTML pueda hablar con Python sin bloqueos
CORS(app)

# Conexión a MongoDB usando Variables de Entorno para máxima seguridad
# Render inyectará automáticamente el valor de MONGO_URI aquí
MONGO_URI = os.getenv("MONGO_URI") 
cliente = MongoClient(MONGO_URI)
db = cliente['anisync_db']
coleccion_boveda = db['boveda']

@app.route('/api/guardar', methods=['POST'])
def guardar_anime():
    datos_anime = request.json

    # Validamos que el anime no exista ya en la base de datos (Filtro Anti-Duplicados)
    if coleccion_boveda.find_one({"mal_id": datos_anime.get("mal_id")}):
        return jsonify({"mensaje": "Este anime ya está en tu bóveda", "status": "duplicado"}), 200

    # Insertamos el documento en MongoDB
    coleccion_boveda.insert_one(datos_anime)
    return jsonify({"mensaje": "Anime guardado con éxito", "status": "ok"}), 201

@app.route('/api/boveda', methods=['GET'])
def obtener_boveda():
    # Extraemos la bóveda completa para cuando quieras visualizarla
    animes = list(coleccion_boveda.find({}, {'_id': 0}))
    return jsonify(animes), 200

@app.route('/api/eliminar/<int:mal_id>', methods=['DELETE'])
def eliminar_anime(mal_id):
    resultado = coleccion_boveda.delete_one({"mal_id": mal_id})
    if resultado.deleted_count == 0:
        return jsonify({"mensaje": "Anime no encontrado en la bóveda", "status": "no_encontrado"}), 404
    return jsonify({"mensaje": "Anime eliminado con éxito", "status": "ok"}), 200

@app.route('/api/boveda/<int:mal_id>/episodio', methods=['PATCH'])
def actualizar_episodio(mal_id):
    # Usado por el script de seguimiento (scripts/revisar_novedades.py) para
    # guardar el último episodio conocido y marcar si hay novedad sin ver.
    datos = request.json or {}
    campos = {}
    if "ultimo_episodio_visto" in datos:
        campos["ultimo_episodio_visto"] = datos["ultimo_episodio_visto"]
    if "tiene_novedad" in datos:
        campos["tiene_novedad"] = datos["tiene_novedad"]

    resultado = coleccion_boveda.update_one({"mal_id": mal_id}, {"$set": campos})
    if resultado.matched_count == 0:
        return jsonify({"mensaje": "Anime no encontrado en la bóveda", "status": "no_encontrado"}), 404
    return jsonify({"mensaje": "Episodio actualizado", "status": "ok"}), 200

@app.route('/api/boveda/<int:mal_id>/marcar-visto', methods=['PATCH'])
def marcar_visto(mal_id):
    # Llamado por el frontend cuando el usuario abre un anime desde la Bóveda,
    # para apagar el badge de "nuevo episodio".
    resultado = coleccion_boveda.update_one({"mal_id": mal_id}, {"$set": {"tiene_novedad": False}})
    if resultado.matched_count == 0:
        return jsonify({"mensaje": "Anime no encontrado en la bóveda", "status": "no_encontrado"}), 404
    return jsonify({"mensaje": "Marcado como visto", "status": "ok"}), 200

if __name__ == '__main__':
    print("Iniciando los servidores de AniSync Toshokan...")
    app.run(debug=True, port=5000)
