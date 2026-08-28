

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
        MOVER MODALES DIRECTAMENTE AL BODY
    =====================================================*/

    const modales = [

        "modalCliente",

        "modalPrestamo",

        "modalUsuario",

        "modalCronograma",

        "modalPago",

        "modalReestructuracion"

    ];

    modales.forEach(id => {

        const modal =
            document.getElementById(id);

        if(modal){

            document.body.appendChild(modal);

        }

    });

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
                "Error conectando con BKC Central:",
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

const usuarioActual =
    obtenerUsuarioActual();

console.log(
    "Usuario antes de cargar clientes:",
    usuarioActual
);

if(!usuarioActual){

    console.warn(
        "No hay usuario activo todavía. Se omite carga inicial de clientes."
    );

}else{

    if(
        typeof cargarClientesSupabase === "function"
    ){

        await cargarClientesSupabase();

    }

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
    const sidebar = document.querySelector(".sidebar");
    const btnMenuMovil = document.getElementById("btnMenuMovil");

    /* ABRIR Y CERRAR MENU MOVIL */

    if(btnMenuMovil && sidebar){

        btnMenuMovil.addEventListener("click", function(){

            sidebar.classList.toggle("show");

        });

    }

    /* OPCIONES DEL MENU */

    opciones.forEach(opcion=>{

        opcion.addEventListener("click", function(){

            opciones.forEach(x=>x.classList.remove("active"));

            this.classList.add("active");

            const pagina = this.dataset.page;

            mostrarPagina(pagina);

            /* CERRAR MENU DESPUES DE ELEGIR UNA OPCION */

            if(
                sidebar &&
                window.innerWidth <= 992
            ){

                sidebar.classList.remove("show");

            }

        });

    });

}

/*=========================================================
    MOSTRAR PAGINA
=========================================================*/

function mostrarPagina(nombre){

    document.querySelectorAll(".page").forEach(pagina => {

        pagina.classList.add("d-none");

    });

    const paginaSeleccionada =
        document.getElementById(nombre);

    if(paginaSeleccionada){

        paginaSeleccionada.classList.remove("d-none");

    }

}


/*=========================================================
    BOTONES
=========================================================*/

function configurarBotones(){

    const btnCliente =
        document.getElementById("btnNuevoCliente");

    if(btnCliente){

        btnCliente.addEventListener(
            "click",
            () => {

                const modalElemento =
                    document.getElementById(
                        "modalCliente"
                    );

                if(!modalElemento){

                    console.error(
                        "No se encontró el modalCliente"
                    );

                    return;

                }

                const modal =
                    bootstrap.Modal.getOrCreateInstance(
                        modalElemento
                    );

                modal.show();

            }
        );

    }


    const btnPrestamo =
        document.getElementById(
            "btnNuevoPrestamo"
        );

    if(btnPrestamo){

        btnPrestamo.addEventListener(
            "click",
            abrirModalPrestamo
        );

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


