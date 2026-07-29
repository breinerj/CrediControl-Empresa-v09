/*=========================================================
    CREDICONTROL
    utilidades.js
=========================================================*/

function toast(mensaje,tipo="success"){

    console.log(`[${tipo}] ${mensaje}`);

}

function generarId(){

    return Date.now()+Math.floor(Math.random()*1000);

}

function porcentaje(parte,total){

    if(total==0) return 0;

    return (parte*100)/total;

}

function copiarObjeto(obj){

    return JSON.parse(

        JSON.stringify(obj)

    );

}

function redondear(numero){

    return Math.round(numero*100)/100;

}

function estadoColor(estado){

    switch(estado){

        case "PAGADA":

            return "success";

        case "PARCIAL":

            return "warning";

        case "VENCIDA":

            return "danger";

        default:

            return "secondary";

    }

}
/*=========================================================
    FORMATO MONEDA
=========================================================*/

function dinero(valor){

    valor = Number(valor) || 0;

    return new Intl.NumberFormat(

        "es-CO",

        {

            style:"currency",

            currency:"COP",

            minimumFractionDigits:0

        }

    ).format(valor);

}
/*=========================================================
    FECHA ACTUAL
=========================================================*/

function hoy(){

    let fecha = new Date();

    let anio = fecha.getFullYear();

    let mes = String(

        fecha.getMonth()+1

    ).padStart(2,"0");

    let dia = String(

        fecha.getDate()

    ).padStart(2,"0");

    return `${anio}-${mes}-${dia}`;

}
/*=========================================================
    CONVERTIR A NÚMERO
=========================================================*/

function numero(valor){

    if(valor === null || valor === undefined || valor === ""){

        return 0;

    }

    return Number(valor);

}