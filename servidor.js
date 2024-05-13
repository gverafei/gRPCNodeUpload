const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const dotenv = require('dotenv')
const fs = require('fs')
const PROTO_PATH = "./proto/audio.proto"

// Carga la configuración del archivo .env
dotenv.config()

// Carga la implementacion del archivo proto para JS
const packageDefinition = protoLoader.loadSync(PROTO_PATH);
const audioProto = grpc.loadPackageDefinition(packageDefinition);

// Crea un servidor gRPC
const server = new grpc.Server();
server.addService(audioProto.AudioService.service, { downloadAudio: downloadAudioImpl, uploadAudio: uploadAudioImpl });

// Inicia el servidor en el puerto SERVER_PORT
server.bindAsync(`localhost:${process.env.SERVER_PORT}`, grpc.ServerCredentials.createInsecure(), () => {
    console.log(`Servidor gRPC en ejecución en el puerto ${process.env.SERVER_PORT}`)
});

// Implementación de downloadAudio
function downloadAudioImpl(call) {
    // Se crea un stream en chunk de 1024
    const stream = fs.createReadStream(`./uploads/${call.request.nombre}`, { highWaterMark: 1024 })

    console.log(`\n\nEnviando el archivo: ${call.request.nombre}`)
    stream.on('data', function (chunk) {
        call.write({ data: chunk })
        process.stdout.write('.');
    }).on('end', function () {
        call.end()
        stream.close()
        console.log('\nEnvío de datos terminado.')
    })
}

// Implementación de uploadAudio
function uploadAudioImpl(call, callback) {
    let nombreArchivo, chunk;
    let tempFilePath;

    // Vamos a recibir el nombre y el stream
    call.on('data', async (DataChunkResponse) => {
        if (DataChunkResponse.nombre) {
            nombreArchivo = DataChunkResponse.nombre;
            tempFilePath = `./uploads/${nombreArchivo}`;
            console.debug(`Recibiendo el archivo: ${tempFilePath}`);
        }
        else if (DataChunkResponse.data) {
            chunk = DataChunkResponse.data;
            fs.appendFileSync(tempFilePath, chunk);
            process.stdout.write('.');
        }
    }).on('end', function () {
        callback(null, { nombre: nombreArchivo });
        console.log('\nEnvío de datos terminado.')
    })
}
