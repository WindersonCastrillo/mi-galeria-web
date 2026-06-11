from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient

app = Flask(__name__)
# Habilitamos CORS para que el frontend HTML pueda hablar con Python sin bloqueos
CORS(app)

# Conexión a MongoDB (Apunta a tu base de datos local por defecto)
# Si usas MongoDB Atlas, reemplaza esta URL por tu URI de conexión
cliente = MongoClient('mongodb://localhost:27017/') 
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

if __name__ == '__main__':
    print("Iniciando los servidores de AniSync Toshokan...")
    app.run(debug=True, port=5000)