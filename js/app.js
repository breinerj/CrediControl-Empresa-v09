console.log("APP.JS CARGADO", new Date().toLocaleTimeString());

/*=========================================================
    CREDICONTROL 1.0
    app.js
=========================================================*/

document.addEventListener(
    "DOMContentLoaded",
    iniciarAplicacion
);

/*=========================================================
    INICIAR APLICACION
=========================================================*/

async function iniciarAplicacion(){

    /*=====================================================
        CONEXION AUTOMATICA CON CREDICONTROL CENTRAL
    =====================================================*/

    if(
        typeof inicializarConexionCentral === "function"
    ){

        try{

            const resultado =
                await inicializarConexionCentral();

            console.log(
                "Estado conexión central:",
                resultado
            );
        
            if(!resultado){

                mostrarPantallaActivacion();

            }
        }catch(error){

            console.error(
                "Error conectando con CrediControl Central:",
                error
            );

        }

    }else{

        console.warn(
            "La función inicializarConexionCentral no está disponible."
        );

    }


    /*=====================================================
        CONFIGURAR CREDICONTROL
    =====================================================*/

    configurarMenu();

/*
    SINCRONIZAR CLIENTES
    DESDE SUPABASE
*/

    /*
    CARGAR CLIENTES
    DESDE SUPABASE
*/

    if(
    typeof cargarClientesSupabase ===
    "function"
){

    await cargarClientesSupabase();

}


    if(
        typeof cargarPrestamosSupabase ===
        "function"
    ){

        await cargarPrestamosSupabase();

    }


    if(
        typeof cargarPagosSupabase ===
        "function"
    ){

        await cargarPagosSupabase();

    }


    /*
        ACTUALIZAR INTERFAZ
    */

    cargarClientes();

    cargarPrestamos();

    listarPagos();

    cargarDashboard();


    if(
        typeof listarPagos === "function"
    ){

        listarPagos();

    }


    configurarBotones();

}
/*=========================================================
    MENU LATERAL
=========================================================*/

function configurarMenu(){

    const opciones = document.querySelectorAll(".menu li");

    opciones.forEach(opcion=>{

        opcion.addEventListener("click",function(){

            opciones.forEach(x=>x.classList.remove("active"));

            this.classList.add("active");

            let pagina=this.dataset.page;

            mostrarPagina(pagina);

        });

    });

}

function mostrarPagina(nombre){

    document.querySelectorAll(".page").forEach(p=>{

        p.classList.add("d-none");

    });

    const pagina=document.getElementById(nombre);

    if(pagina){

        pagina.classList.remove("d-none");

    }

}

/*=========================================================
    BOTONES
=========================================================*/

function configurarBotones(){

    const btnCliente = document.getElementById("btnNuevoCliente");

    if(btnCliente){
        btnCliente.addEventListener("click", abrirModalCliente);
    }

    const btnPrestamo = document.getElementById("btnNuevoPrestamo");

    if(btnPrestamo){
        btnPrestamo.addEventListener("click", abrirModalPrestamo);
    }

    

}

/*=========================================================
    CARGAS INICIALES
=========================================================*/

function cargarDashboard(){

    if(typeof actualizarDashboard==="function"){

        actualizarDashboard();

    }

}

function cargarClientes(){

    if(typeof listarClientes==="function"){

        listarClientes();

    }

}

function cargarPrestamos(){

    if(typeof listarPrestamos==="function"){

        listarPrestamos();

    }

}

/*=========================================================
    UTILIDADES
=========================================================*/

function mensaje(texto){

    alert(texto);

}

function confirmar(texto){

    return confirm(texto);

}

function limpiarFormularioCliente(){

    const campos=[

        "clienteNombre",

        "clienteCedula",

        "clienteTelefono",

        "clienteCiudad",

        "clienteDireccion",

        "clienteObservaciones"

    ];

    campos.forEach(id=>{

        const c=document.getElementById(id);

        if(c)c.value="";

    });

}



/*=========================================================
    FORMATEO
=========================================================*/

function formatoMoneda(valor){

    return new Intl.NumberFormat(

        "es-CO",

        {

            style:"currency",

            currency:"COP"

        }

    ).format(valor);

}
[
    "nuevoPlazo",
    "nuevaTasa",
    "nuevaPeriodicidad",
    "nuevoPrimerPago"
].forEach(id=>{

    const control=document.getElementById(id);

    if(control){

        control.addEventListener(
            "input",
            ()=>actualizarVistaPreviaReestructuracion()
        );

        control.addEventListener(
            "change",
            ()=>actualizarVistaPreviaReestructuracion()
        );

    }

});