const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const dotenv = require('dotenv')
const fs = require('fs')
const PROTO_PATH = "./proto/audio.proto";
const portAudio = require('naudiodon');

// Carga la configuración del archivo .env
dotenv.config()

// Carga la implementacion del archivo proto para JS
const packageDefinition = protoLoader.loadSync(PROTO_PATH);
const audioProto = grpc.loadPackageDefinition(packageDefinition);

// Crea un cliente gRPC
const stub = new audioProto.AudioService(`localhost:${process.env.SERVER_PORT}`, grpc.credentials.createInsecure())

async function main() {
    nombre_archivo = 'sample.wav'

    // Sube un archivo al servidor
    uploadAudio(stub, nombre_archivo)

    await waitForKey(13);

    // Reproduce el stream mientras lo descarga
    streamAudio(stub, nombre_archivo)
}

// Funcion principal
main()


// Función que recibe el stream y lo reproduce mientras lo descarga
function streamAudio(stub, nombre_archivo) {
    // Crea un reproductor de audio como un WritableStream
    var ao = new portAudio.AudioIO({
        outOptions: {
            channelCount: 2,
            sampleFormat: portAudio.SampleFormat16Bit,
            sampleRate: 48000
        }
    });
    ao.start();

    console.log(`\nReproduciendo el archivo: ${nombre_archivo}`)
    // Usando el stub, realizamos la llamada streaming RPC
    stub.downloadAudio({
        nombre: nombre_archivo
    }).on('data', (DataChunkResponse) => {
        process.stdout.write('.')
        ao.write(DataChunkResponse.data)
    }).on('end', function () {
        console.log('\nRecepción de datos correcta.')
    })
}

// Función que sube un archivo por stream
function uploadAudio(stub, nombre_archivo) {
    console.log(`\Enviando el archivo: ${nombre_archivo}`)

    const serviceCall = stub.uploadAudio((err, response) => {
        if (err) { console.log(err); }
        else {
            console.log("\nEl servidor indica que recibió correctamente el archivo: " + response.nombre)
            console.log("Presione la tecla ENTER para reproducir el audio subido...")
        }
    });

    serviceCall.write({
        nombre: nombre_archivo
    });

    // Se crea un stream en chunk de 1024
    const stream = fs.createReadStream(`./recursos/${nombre_archivo}`, { highWaterMark: 1024 })
    stream.on('data', (chunk) => {
        serviceCall.write({ data: chunk });
        process.stdout.write('.');
    }).on('end', function () {
        serviceCall.end();
        console.log('\nEnvío de datos terminado.')
    })
}

// Función auxiliar para parar hasta presionar una tecla
function waitForKey(keyCode) {
    return new Promise(resolve => {
        process.stdin.on('data', function (chunk) {
            if (chunk[0] === keyCode) {
                resolve();
                process.stdin.pause();
            }
        });
    });
}