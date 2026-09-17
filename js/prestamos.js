/*=========================================================
    CREDICONTROL
    prestamos.js
=========================================================*/

let prestamoEditando = null;

/*=========================================================
    EVENTOS
=========================================================*/

document.addEventListener("DOMContentLoaded",()=>{

    const btn=document.getElementById("btnGuardarPrestamo");

    if(btn){

        btn.addEventListener("click",guardarPrestamo);

    }

    const controles=[

        "capital",
        "interes",
        "meses",
        "periodicidad"

    ];

    controles.forEach(id=>{

        let c=document.getElementById(id);

        if(c){

            c.addEventListener("input",calcularPrestamo);
            c.addEventListener("change",calcularPrestamo);

        }

    });

});

/*=========================================================
        SELECT CLIENTES
=========================================================*/

function cargarSelectClientes(){

    const select = document.getElementById("prestamoCliente");

    select.innerHTML = "";

    DB.clientes
        .filter(cliente => cliente.estado === "ACTIVO")
        .forEach(cliente => {

            select.innerHTML += `
                <option value="${cliente.id}">
                    ${cliente.nombre}
                </option>
            `;

        });
    }

/*=========================================================
        GUARDAR PRESTAMO
=========================================================*/

async function guardarPrestamo(){

     if(!esAdministrador()){

        alert(
            "No tiene permisos para reestructurar préstamos."
        );

        return;

    }
    
    try{

        console.count("guardarPrestamo");

        console.trace("guardarPrestamo");

        console.log("1");

        let clienteId = document.getElementById("prestamoCliente").value;

const cliente = DB.clientes.find(
    c =>
        Number(c.id) ===
        Number(clienteId)
);

if(!cliente){

    alert(
        "No se encontró el cliente."
    );

    return;

}

if(cliente.estado !== "ACTIVO"){

    alert(
        "El cliente está INACTIVO.\n\nDebe reactivarlo antes de crear un nuevo préstamo."
    );

    return;

}
        console.log("2");

        let capital = Number(document.getElementById("capital").value);

        let interes = Number(document.getElementById("interes").value);

        let meses = Number(document.getElementById("meses").value);

        console.log("3");

        let cronograma = construirCronograma();

        console.log("Cronograma",cronograma);

        let interesTotal = cronograma.reduce(
            (s,c)=>s+c.interes,
            0
        );

        console.log("4");

        let total = capital + interesTotal;

        console.log("5");

        let nuevoPrestamo =
    await agregarPrestamoSupabase({

        id: Date.now(),

        clienteId: Number(clienteId),

        capital,

        interes,

        tipoInteres:
            document.getElementById("tipoInteres").value,

        meses,

        periodicidad:
            document.getElementById("periodicidad").value,

        fechaPrestamo:
            document.getElementById("fechaPrestamo").value,

        primerPago:
            document.getElementById("primerPago").value,

        observaciones:
            document.getElementById("observacionesPrestamo").value,

        interesTotal,

        total,

        saldoCapital: capital,

        saldoTotal: total,

        capitalRecuperado: 0,

        interesRecuperado: 0,

        estado: "ACTIVO",

        archivado: false,

        cronograma

    });


if(!nuevoPrestamo){

    return;

}

        console.log("6",nuevoPrestamo);

        listarPrestamos();

        console.log("7");

        actualizarDashboard();

        console.log("8");

        cerrarModalPrestamo();

        console.log("9");

        abrirCronograma(nuevoPrestamo.id);

        console.log("10");

    }catch(e){

        console.error(e);

        alert(e.message);

    }

}

/***********************************************************
    CARGAR PRÉSTAMOS DESDE SUPABASE
***********************************************************/
async function cargarPrestamosSupabase(){

    try{

        const empresaId =
            DB.config?.licencia?.empresaId;

        if(!empresaId){

            console.error(
                "Empresa no identificada al cargar préstamos."
            );

            return false;

        }

        /*
            OBTENER PRÉSTAMOS
            DESDE SUPABASE
        */

        const {
            data,
            error
        } =
        await supabaseClient
            .from("prestamos")
            .select("*")
            .eq(
                "empresa_id",
                empresaId
            )
            .order(
                "id",
                {
                    ascending:true
                }
            );

        if(error){

            console.error(
                "Error cargando préstamos desde Supabase:",
                error
            );

            return false;

        }


        /*
            RECONSTRUIR FORMATO
            DE CREDICONTROL
        */

        const prestamosCargados = [];

        for(const prestamo of data){

            /*
                CARGAR CRONOGRAMA
                DEL PRÉSTAMO
            */

            const cronograma =
                await obtenerCronogramaSupabase(
                    prestamo.id
                );


            prestamosCargados.push({

                /*
                    ID LOCAL
                */

                id:
                    Number(
                        prestamo.local_id
                    ),

                /*
                    ID SUPABASE
                */

                supabaseId:
                    prestamo.id,

                codigo:
                    prestamo.codigo,

                clienteId:
                    Number(
                        prestamo.cliente_local_id
                    ),

                capital:
                    Number(
                        prestamo.capital || 0
                    ),

                interes:
                    Number(
                        prestamo.interes || 0
                    ),

                tipoInteres:
                    prestamo.tipo_interes,

                meses:
                    Number(
                        prestamo.meses || 0
                    ),

                periodicidad:
                    prestamo.periodicidad,

                fechaPrestamo:
                    prestamo.fecha_prestamo,

                primerPago:
                    prestamo.primer_pago,

                observaciones:
                    prestamo.observaciones,

                interesTotal:
                    Number(
                        prestamo.interes_total || 0
                    ),

                total:
                    Number(
                        prestamo.total || 0
                    ),

                saldoCapital:
                    Number(
                        prestamo.saldo_capital || 0
                    ),

                saldoTotal:
                    Number(
                        prestamo.saldo_total || 0
                    ),

                capitalRecuperado:
                    Number(
                        prestamo.capital_recuperado || 0
                    ),

                interesRecuperado:
                    Number(
                        prestamo.interes_recuperado || 0
                    ),

                estado:
                    prestamo.estado,

                archivado:
                    prestamo.archivado || false,

                cronograma:
                    cronograma || []

            });

        }


        /*
            REEMPLAZAR CACHÉ LOCAL
        */

        DB.prestamos =
            prestamosCargados;


        /*
            GUARDAR CACHÉ
            EN LOCALSTORAGE
        */

        DB.guardar();


        console.log(
            "Préstamos cargados desde Supabase:",
            DB.prestamos.length
        );

        return true;


    }catch(error){

        console.error(
            "Error cargarPrestamosSupabase:",
            error
        );

        return false;

    }

}
/*=========================================================
        LISTAR PRESTAMOS
=========================================================*/

function listarPrestamos(){

    let tabla=document.getElementById("tablaPrestamos");

    if(!tabla) return;

    tabla.innerHTML = "";


/*
    IDENTIFICAR USUARIO ACTUAL
*/

const usuario =
    obtenerUsuarioActual();

console.log(
    "USUARIO DESDE LISTAR PRESTAMOS:",
    usuario
);

if(!usuario){

    console.warn(
        "Usuario aún no disponible. Reintentando cargar préstamos..."
    );

    setTimeout(
        () => {
            listarPrestamos();
        },
        500
    );

    return;

}


/*
    FILTRAR PRÉSTAMOS
    SEGÚN EL ROL DEL USUARIO
*/

let prestamosFiltrados = [];


/*
    ADMINISTRADOR

    Ve los préstamos que ya están
    cargados para su empresa.
*/

if(
    usuario.rol === "ADMINISTRADOR"
){

    prestamosFiltrados =
        DB.prestamos.filter(

            prestamo =>

                !prestamo.archivado &&

                prestamo.estado === "ACTIVO"

        );

}


/*
    COBRADOR

    Solo ve préstamos de los clientes
    asignados directamente a él.
*/

else if(
    usuario.rol === "COBRADOR"
){

    prestamosFiltrados =
        DB.prestamos.filter(

            prestamo => {

                if(
                    prestamo.archivado ||
                    prestamo.estado !== "ACTIVO"
                ){

                    return false;

                }


                /*
                    BUSCAR CLIENTE DEL PRÉSTAMO
                */

                const cliente =
                    DB.clientes.find(

                        c =>
                            Number(c.id) ===
                            Number(prestamo.clienteId)

                    );


                if(!cliente){

                    return false;

                }


                /*
                    MISMA REGLA UTILIZADA
                    EN LISTAR CLIENTES
                */

                return String(
                    cliente.usuarioAsignadoId
                ) === String(
                    usuario.id
                )

                &&

                cliente.estado === "ACTIVO";

            }

        );

}


/*
    MOSTRAR PRÉSTAMOS FILTRADOS
*/

prestamosFiltrados.forEach(prestamo=>{

        let cliente = DB.clientes.find(

            c=>c.id==prestamo.clienteId

        );

        let siguiente = prestamo.cronograma.find(

            x=>x.estado=="PENDIENTE"

        );

        tabla.innerHTML+=`

        <tr>

            <td>${prestamo.codigo}</td>

            <td>${cliente ? cliente.nombre : ""}</td>

            <td>${dinero(prestamo.capital)}</td>

            <td>${dinero(prestamo.saldoTotal)}</td>

            <td>${siguiente ? siguiente.fecha : "-"}</td>

            <td>

                <span class="badge bg-success">

                    ${prestamo.estado}

                </span>

            </td>

            <td>

                <td>

                <button
                    class="btn btn-primary btn-sm"
                    onclick="abrirCronograma(${prestamo.id})">

                    📅 Cronograma

                </button>

                ${prestamo.estado==="ACTIVO" ? `

                <button
                    class="btn btn-warning btn-sm"
                    onclick="abrirReestructuracion(${prestamo.id})">

                    🔄 Reestructurar

                </button>

                ` : ""}

                ${prestamo.estado==="FINALIZADO" && !prestamo.archivado ? `

                <button
                    class="btn btn-secondary btn-sm"
                    onclick="archivarPrestamo(${prestamo.id})">

                    📦 Archivar

                </button>

                ` : ""}

            </td>

            

        </tr>

        `;

    });

}

/*=========================================================
        VER CRONOGRAMA
=========================================================*/

function verCronograma(id){

    let prestamo = DB.prestamos.find(

        p=>p.id==id

    );

    

    if(!prestamo) return;

    let texto="";

    texto+="PRÉSTAMO: "+prestamo.codigo+"\\n\\n";

    prestamo.cronograma.forEach(c=>{

        texto+=

        "Cuota "+c.numero+

        " | "+c.fecha+

        " | "+dinero(c.valor)+

        " | "+c.estado+

        "\\n";

    });

    alert(texto);

}
/*=========================================================
        MODAL CRONOGRAMA
=========================================================*/

let modalCronograma;

async function abrirCronograma(id){

    let prestamo = DB.prestamos.find(

        p=>p.id==id

    );

    prestamo.cronograma =
        await obtenerCronogramaSupabase(
            prestamo.supabaseId
    );

    if(!prestamo){

        alert("No se encontró el préstamo.");

        return;

    }
    let cliente = DB.clientes.find(

    c => c.id == prestamo.clienteId

);

let cuotasPagadas = prestamo.cronograma.filter(

    c => c.estado == "PAGADA"

).length;

let cuotasPendientes = prestamo.cronograma.filter(

    c => c.estado != "PAGADA"

).length;

document.getElementById("resumenPrestamo").innerHTML = `

<div class="row">

    <div class="col-md-4">

        <strong>Cliente:</strong><br>

        ${cliente ? cliente.nombre : ""}

    </div>

    <div class="col-md-4">

        <strong>Préstamo:</strong><br>

        ${prestamo.codigo}

    </div>

    <div class="col-md-4">

        <strong>Estado:</strong><br>

        ${prestamo.estado}

    </div>

</div>

<hr>

<div class="row">

    <div class="col-md-3">

        <strong>Capital Prestado:</strong><br>

        ${dinero(prestamo.capital)}

    </div>

    <div class="col-md-3">

        <strong>Saldo Total:</strong><br>

        ${dinero(prestamo.saldoTotal)}

    </div>

    <div class="col-md-3">

        <strong>Capital Recuperado:</strong><br>

        ${dinero(prestamo.capitalRecuperado)}

    </div>

    <div class="col-md-3">

        <strong>Interés Recuperado:</strong><br>

        ${dinero(prestamo.interesRecuperado)}

    </div>

</div>

<hr>

<div class="row">

    <div class="col-md-6">

        <strong>Cuotas Pagadas:</strong><br>

        ${cuotasPagadas}

    </div>

    <div class="col-md-6">

        <strong>Cuotas Pendientes:</strong><br>

        ${cuotasPendientes}

    </div>

</div>
<hr>

<div class="d-flex gap-2 mt-3">

    <button
        class="btn btn-success"
        onclick="abrirPagoRapido(${prestamo.id})">

        💰 Registrar Pago

    </button>

    <button
        class="btn btn-warning"
        onclick="abrirReestructuracion(${prestamo.id})">

        🔄 Reestructurar

    </button>

</div>

`;
    if(!modalCronograma){

        modalCronograma = new bootstrap.Modal(

            document.getElementById("modalCronograma")

        );

    }

    cargarCronograma(prestamo);

    const elementoModalPago =
    document.getElementById("modalPago");

    if(elementoModalPago){

        const instanciaPago =
            bootstrap.Modal.getInstance(
                elementoModalPago
            );

        if(instanciaPago){

            instanciaPago.hide();

    }

}

    modalCronograma.show();

}

/*=========================================================
        CARGAR CRONOGRAMA
=========================================================*/

function cargarCronograma(prestamo){

    let tabla = document.getElementById("tablaCronograma");

    tabla.innerHTML="";

    prestamo.cronograma.forEach(cuota=>{

        let color="secondary";

        if(cuota.estado=="PAGADA"){

            color="success";

        }

        if(cuota.estado=="PARCIAL"){

            color="warning";

        }

        if(cuota.estado=="VENCIDA"){

            color="danger";

        }

        tabla.innerHTML += `

        <tr>

            <td>${cuota.numero}</td>

            <td>${cuota.fecha}</td>

            <td>${dinero(cuota.capital)}</td>

            <td>${dinero(cuota.interes)}</td>

            <td>${dinero(cuota.valor)}</td>

            <td>${dinero(cuota.pagado)}</td>

            <td>

                <span class="badge bg-${color}">

                    ${cuota.estado}

                </span>

            </td>

            <td>

                <button

                    class="btn btn-success btn-sm"

                    onclick="abrirPago(

                        ${prestamo.id},

                        ${cuota.numero}

                    )">

                    💰 Cobrar

                </button>

            </td>

        </tr>

        `;

    });

}
/*=========================================================
        BUSCAR PRESTAMO
=========================================================*/

function obtenerPrestamo(id){

    return DB.prestamos.find(

        p=>Number(p.id)===Number(id)

    );

}

/*=========================================================
        BUSCAR CLIENTE
=========================================================*/

function obtenerCliente(id){

    return DB.clientes.find(

        c=>Number(c.id)===Number(id)

    );

}


/*=========================================================
    MODAL PRESTAMO
=========================================================*/

let modalPrestamo;

function abrirModalPrestamo(){

    if(!modalPrestamo){

        modalPrestamo = new bootstrap.Modal(

            document.getElementById("modalPrestamo")

        );

    }

    cargarSelectClientes();

    limpiarFormularioPrestamo();

    calcularPrestamo();

    modalPrestamo.show();

}

function cerrarModalPrestamo(){

    if(modalPrestamo){

        modalPrestamo.hide();

    }

}

function limpiarFormularioPrestamo(){

    document.getElementById("capital").value="";

    document.getElementById("interes").value=5;

    document.getElementById("meses").value=12;

    document.getElementById("periodicidad").value="Mensual";

    document.getElementById("fechaPrestamo").value=hoy();

    document.getElementById("primerPago").value="";

    document.getElementById("observacionesPrestamo").value="";

    document.getElementById("cronogramaPreview").innerHTML="";

}

/***********************************************************
    AGREGAR PRÉSTAMO EN SUPABASE
***********************************************************/
async function agregarPrestamoSupabase(prestamo){

    const empresaId =
        DB.config?.licencia?.empresaId;

    if(!empresaId){

        alert("Empresa no identificada.");

        return null;

    }

    /*
        BUSCAR EL CLIENTE
        PARA OBTENER EL ID DE SUPABASE
    */

    const cliente =
        DB.clientes.find(
            c =>
                Number(c.id) ===
                Number(prestamo.clienteId)
        );

    if(!cliente){

        alert("Cliente no encontrado.");

        return null;

    }

    if(!cliente.supabaseId){

        alert("El cliente no está sincronizado con Supabase.");

        return null;

    }

    try{

        const nuevoPrestamo = {

            empresa_id: empresaId,

            local_id: prestamo.id,

            cliente_local_id: prestamo.clienteId,

            cliente_supabase_id: cliente.supabaseId,

            capital: prestamo.capital,

            interes: prestamo.interes,

            tipo_interes: prestamo.tipoInteres,

            meses: prestamo.meses,

            periodicidad: prestamo.periodicidad,

            fecha_prestamo: prestamo.fechaPrestamo,

            primer_pago: prestamo.primerPago,

            observaciones: prestamo.observaciones,

            interes_total: prestamo.interesTotal,

            total: prestamo.total,

            saldo_capital: prestamo.saldoCapital,

            saldo_total: prestamo.saldoTotal,

            capital_recuperado: prestamo.capitalRecuperado,

            interes_recuperado: prestamo.interesRecuperado,

            estado: prestamo.estado,

            archivado: prestamo.archivado

        };

        console.count("INSERT PRESTAMO");

        console.log("Objeto enviado:", nuevoPrestamo);

        const {
            data,
            error
        } =
        await supabaseClient
            .from("prestamos")
            .insert(
                nuevoPrestamo
            )
            .select()
            .single();

        const codigo = "PRE-" + String(data.id).padStart(6, "0");

        const { error: errorCodigo } =
            await supabaseClient
                .from("prestamos")
                .update({
                    codigo: codigo
                })
                .eq("id", data.id);

        if(errorCodigo){

            console.error(
                "Error actualizando código del préstamo:",
                errorCodigo
            );

        }

        data.codigo = codigo;

        console.log("Respuesta:", data);


        if(error){

            console.error(error);

            alert(
                "No fue posible guardar el préstamo."
            );

            return null;

        }

        /*
            GUARDAR EL ID
            DE SUPABASE
        */

     prestamo.supabaseId = data.id;

    prestamo.codigo = data.codigo;

    console.log("Antes de guardar cronograma");
    console.log("ID Supabase:", data.id);
    console.log("Cronograma:", prestamo.cronograma);

    await guardarCronogramaSupabase(
        data.id,
        prestamo.cronograma
);

    console.log("Después de guardar cronograma");

    DB.prestamos.push(prestamo);

    DB.guardar();

    return prestamo;

    }catch(error){

        if (error) {
            console.error("Error completo:", error);
            console.error("Mensaje:", error.message);
            console.error("Detalles:", error.details);
            console.error("Hint:", error.hint);
            console.error("Código:", error.code);
}

        alert(
            "Error guardando préstamo."
        );

        return null;

    }

}

/***********************************************************
    GUARDAR CRONOGRAMA EN SUPABASE
***********************************************************/
async function guardarCronogramaSupabase(prestamoId, cronograma) {


    console.log("Entró a guardarCronogramaSupabase");
    console.log("Prestamo ID:", prestamoId);
    console.log("Cronograma recibido:", cronograma);
    try {

        const cuotas = cronograma.map(cuota => ({

            prestamo_id: prestamoId,

            numero: cuota.numero,

            fecha: cuota.fecha,

            capital: cuota.capital,

            interes: cuota.interes,

            valor: cuota.valor,

            saldo: cuota.saldo,

            pagado: cuota.pagado || 0,

            estado: cuota.estado || "PENDIENTE"

        }));

        console.log("Cuotas a insertar:", cuotas);

        const { data, error } = await supabaseClient
            .from("cronograma_prestamos")
            .insert(cuotas)
            .select();

        if (error) {
            console.error("Error cronograma:", error);
            return false;
        }

        console.log("Cronograma guardado:", data);

        return true;

    } catch (e) {

        console.error("Error:", e);
        return false;

    }

}
/*=========================================================
    CRUD PRESTAMOS
=========================================================*/

function agregarPrestamo(prestamo){

    prestamo.codigo =
        "PRE-" + String(DB.prestamos.length + 1).padStart(5,"0");

    DB.prestamos.push(prestamo);

    DB.guardar();

    return prestamo;

}
/*=========================================================
        ARCHIVAR PRESTAMO
=========================================================*/

function eliminarPrestamo(id){

    DB.prestamos = DB.prestamos.filter(

        p => Number(p.id) !== Number(id)

    );

    DB.guardar();

}

    listarPrestamos();

    actualizarDashboard();


/*=========================================================
        ACTUALIZAR VISTA PREVIA
=========================================================*/

document.addEventListener("DOMContentLoaded",()=>{

    [

        "capital",

        "interes",

        "meses",

        "periodicidad",

        "primerPago"

    ].forEach(id=>{

        let campo=document.getElementById(id);

        if(!campo) return;

        campo.addEventListener(

            "input",

            actualizarVistaPreviaCronograma

        );

        campo.addEventListener(

            "change",

            actualizarVistaPreviaCronograma

        );

    });

});
/*=========================================================
        REESTRUCTURAR PRESTAMO
=========================================================*/

let modalReestructuracion;

function abrirReestructuracion(id){

     if(!esAdministrador()){

        alert(
            "No tiene permisos para reestructurar préstamos."
        );

        return;

    }

    let prestamo = obtenerPrestamo(id);

    if(!prestamo){

        alert("No se encontró el préstamo.");

        return;

    }

    let cliente = obtenerCliente(prestamo.clienteId);

    if(!modalReestructuracion){

        modalReestructuracion = new bootstrap.Modal(

            document.getElementById("modalReestructuracion")

        );

    }

    document.getElementById("resCliente").value =
        cliente ? cliente.nombre : "";

    document.getElementById("resCodigo").value =
        prestamo.codigo;

    document.getElementById("resEstado").value =
        prestamo.estado;

    document.getElementById("resCapital").value =
        dinero(prestamo.capital);

    document.getElementById("resSaldo").value =
        dinero(prestamo.saldoTotal);

    document.getElementById("resCapitalRec").value =
        dinero(prestamo.capitalRecuperado);

    document.getElementById("resInteresRec").value =
        dinero(prestamo.interesRecuperado);

      

    const fechaPagoTotal =
        document.getElementById("fechaPagoTotal");

    if(fechaPagoTotal){
        fechaPagoTotal.value = hoy();
}

    actualizarVistaPreviaReestructuracion(prestamo);

    modalReestructuracion.show();

}

/*=========================================================
        PAGO RAPIDO DESDE LA FICHA
=========================================================*/

function abrirPagoRapido(idPrestamo){

    let prestamo = obtenerPrestamo(idPrestamo);

    if(!prestamo){

        alert("No se encontró el préstamo.");

        return;

    }

    let cuota = prestamo.cronograma.find(

        c => c.estado != "PAGADA"

    );

    if(!cuota){

        alert("El préstamo ya está finalizado.");

        return;

    }

    abrirPago(

        idPrestamo,

        cuota.numero

    );

}
let prestamoReestructuracion = null;

/*=========================================================
    CALCULAR SALDO PROVISIONAL PARA REESTRUCTURACION
=========================================================*/
function calcularSaldoProvisional(prestamo){

    const capitalPendiente =
        Number(prestamo.saldoCapital || 0);

    const capitalInicial =
        Number(prestamo.capital || 0);

    const tasa =
        Number(prestamo.interes || 0);


    /*=========================================================
        FECHA ORIGINAL DEL CRÉDITO
    =========================================================*/

    const fechaPrestamo =
        prestamo.fechaPrestamo;


    if(!fechaPrestamo){

        return {

            capitalPendiente,
            capitalInicial,
            tasa,

            fechaInicio: null,
            fechaPagoTotal: hoy(),

            diasTranscurridos: 0,

            interesMensual: 0,
            interesProporcional: 0,

            saldoProvisional:
                capitalPendiente

        };
    }


    /*=========================================================
        FECHA DE PAGO TOTAL / FECHA DE CORTE
    =========================================================*/

    const campoFechaPagoTotal =
        document.getElementById(
            "fechaPagoTotal"
        );

    const fechaPagoTotal =
        campoFechaPagoTotal?.value ||
        hoy();


    /*=========================================================
        CONVERTIR FECHA ORIGINAL Y FECHA DE PAGO TOTAL
    =========================================================*/

    const fechaOriginal =
        new Date(
            fechaPrestamo + "T00:00:00"
        );

    const fechaFin =
        new Date(
            fechaPagoTotal + "T00:00:00"
        );


    /*=========================================================
        DÍA ANCLA DEL CRÉDITO

        Ejemplo:

        Crédito:
        08/05/2026

        Día ancla:
        8

        Los cortes serán:

        08/06
        08/07
        08/08
        08/09
        08/10
        etc.
    =========================================================*/

    const diaAncla =
        fechaOriginal.getDate();


    /*=========================================================
        DETERMINAR EL ÚLTIMO CORTE DE INTERÉS

        Buscamos el último día "8" que haya ocurrido
        antes o en la fecha de pago total.

        Ejemplo:

        Fecha pago total:
        17/09/2026

        Último corte:
        08/09/2026
    =========================================================*/

    let ultimoCorte =
        new Date(fechaFin);


    ultimoCorte.setDate(
        diaAncla
    );


    /*
        Si el día ancla todavía no ha ocurrido
        en el mes de la fecha de pago total,
        retrocedemos al mes anterior.
    */

    if(ultimoCorte > fechaFin){

        ultimoCorte.setMonth(
            ultimoCorte.getMonth() - 1
        );

        ultimoCorte.setDate(
            diaAncla
        );
    }


    /*=========================================================
        EVITAR QUE EL CORTE SEA ANTERIOR A LA FECHA ORIGINAL
    =========================================================*/

    if(ultimoCorte < fechaOriginal){

        ultimoCorte =
            new Date(fechaOriginal);
    }


    /*=========================================================
        CALCULAR DÍAS DESDE EL ÚLTIMO CORTE

        Ejemplo:

        Último corte:
        08/09/2026

        Fecha pago total:
        17/09/2026

        Resultado:
        9 días
    =========================================================*/

    let diasTranscurridos =
        Math.floor(
            (
                fechaFin -
                ultimoCorte
            ) /
            (1000 * 60 * 60 * 24)
        );


    diasTranscurridos =
        Math.max(
            diasTranscurridos,
            0
        );


    /*=========================================================
        INTERÉS MENSUAL

        Para interés fijo se utiliza SIEMPRE
        el CAPITAL INICIAL.

        No utilizamos el saldo pendiente.
    =========================================================*/

    const interesMensual =
        capitalInicial *
        (tasa / 100);


    /*=========================================================
        INTERÉS PROPORCIONAL

        Mes financiero = 30 días
    =========================================================*/

    const interesProporcional =
        interesMensual *
        (diasTranscurridos / 30);


    /*=========================================================
        SALDO A REESTRUCTURAR

        Capital pendiente
        +
        interés causado desde el último corte
    =========================================================*/

    const saldoProvisional =
        capitalPendiente +
        interesProporcional;


    /*=========================================================
        RESULTADO
    =========================================================*/

    return {

        capitalPendiente,

        capitalInicial,

        tasa,

        fechaInicio:
            ultimoCorte
                .toISOString()
                .substring(0,10),

        fechaPagoTotal,

        diasTranscurridos,

        interesMensual,

        interesProporcional,

        saldoProvisional
    };
}

function actualizarVistaPreviaReestructuracion(prestamo){

    if(prestamo){
        prestamoReestructuracion = prestamo;
    }

    if(!prestamoReestructuracion) return;


    /*=========================================================
        CALCULAR LIQUIDACIÓN TOTAL
    =========================================================*/

    const liquidacion =
        calcularSaldoProvisional(
            prestamoReestructuracion
        );


    console.log(
        "Liquidación total para reestructuración:",
        liquidacion
    );


    /*=========================================================
        MOSTRAR ÚLTIMO CORTE
    =========================================================*/

    const campoUltimoCorte =
        document.getElementById("resUltimoCorte");

    if(campoUltimoCorte){

        campoUltimoCorte.value =
            liquidacion.fechaInicio || "";

    }


    /*=========================================================
        MOSTRAR DÍAS DE INTERÉS
    =========================================================*/

    const campoDias =
        document.getElementById("resDiasInteres");

    if(campoDias){

        campoDias.value =
            liquidacion.diasTranscurridos || 0;

    }


    /*=========================================================
        MOSTRAR INTERÉS CAUSADO
    =========================================================*/

    const campoInteres =
        document.getElementById("resInteresCausado");

    if(campoInteres){

        campoInteres.value =
            dinero(
                liquidacion.interesProporcional || 0
            );

    }


    /*=========================================================
        MOSTRAR TOTAL A PAGAR
    =========================================================*/

    const campoTotal =
        document.getElementById("resTotalPagar");

    if(campoTotal){

        campoTotal.value =
            dinero(
                liquidacion.saldoProvisional || 0
            );

    }


    /*=========================================================
        YA NO SE GENERAN CUOTAS

        La reestructuración es una liquidación
        para pago total.
    =========================================================*/

    const tabla =
        document.getElementById(
            "tablaReestructuracion"
        );


    if(tabla){

        tabla.innerHTML = `
            <tr>
                <td colspan="6"
                    class="text-center text-muted py-3">

                    El crédito será liquidado
                    completamente en la fecha
                    de pago acordada.

                </td>
            </tr>
        `;

    }

}

/***********************************************************
    GUARDAR REESTRUCTURACIÓN EN SUPABASE
***********************************************************/
async function guardarReestructuracionSupabase(
    prestamo,
    nuevoCronograma
){

    if(!prestamo.supabaseId){

        console.error(
            "El préstamo no tiene supabaseId."
        );

        return false;

    }

    try{

        /*
            1. OBTENER NÚMERO DE REESTRUCTURACIÓN
        */

        const numeroReestructuracion =
            Array.isArray(
                prestamo.historialReestructuraciones
            )
            ? prestamo.historialReestructuraciones.length
            : 1;


        /*
            2. DESACTIVAR CRONOGRAMA ANTERIOR

            No eliminamos las cuotas.
            Así conservamos el historial.
        */

        const {
            error: errorDesactivar
        } =
        await supabaseClient
            .from("cronograma_prestamos")
            .update({
                activo:false
            })
            .eq(
                "prestamo_id",
                prestamo.supabaseId
            )
            .eq(
                "activo",
                true
            );


        if(errorDesactivar){

            console.error(
                "Error desactivando cronograma anterior:",
                errorDesactivar
            );

            return false;

        }


        /*
            3. ACTUALIZAR PRÉSTAMO
        */

        const {
            error: errorPrestamo
        } =
        await supabaseClient
            .from("prestamos")
            .update({

                interes:
                    prestamo.interes,

                meses:
                    prestamo.meses,

                periodicidad:
                    prestamo.periodicidad,

                primer_pago:
                    prestamo.primerPago,

                interes_total:
                    prestamo.interesTotal,

                saldo_capital:
                    prestamo.saldoCapital,

                saldo_total:
                    prestamo.saldoTotal,

                estado:
                    prestamo.estado,

                reestructurado:
                    true,

                fecha_ultima_reestructuracion:
                    prestamo.fechaUltimaReestructuracion

            })
            .eq(
                "id",
                prestamo.supabaseId
            );


        if(errorPrestamo){

            console.error(
                "Error actualizando préstamo reestructurado:",
                errorPrestamo
            );

            return false;

        }


        /*
            4. PREPARAR NUEVO CRONOGRAMA
        */

        const cuotasSupabase =
            nuevoCronograma.map(
                cuota => ({

                    prestamo_id:
                        prestamo.supabaseId,

                    numero:
                        cuota.numero,

                    fecha:
                        cuota.fecha,

                    capital:
                        cuota.capital,

                    interes:
                        cuota.interes,

                    valor:
                        cuota.valor,

                    saldo:
                        cuota.saldo,

                    pagado:
                        cuota.pagado || 0,

                    estado:
                        cuota.estado || "PENDIENTE",

                    activo:
                        true,

                    reestructuracion_numero:
                        numeroReestructuracion

                })
            );


        /*
            5. INSERTAR NUEVO CRONOGRAMA
        */

        const {
            data,
            error: errorCronograma
        } =
        await supabaseClient
            .from("cronograma_prestamos")
            .insert(
                cuotasSupabase
            )
            .select();


        if(errorCronograma){

            console.error(
                "Error creando nuevo cronograma:",
                errorCronograma
            );

                    /*
            INTENTAR RESTAURAR
            EL CRONOGRAMA ANTERIOR
        */

        const {
            error: errorRestauracion
        } =
        await supabaseClient
            .from("cronograma_prestamos")
            .update({
                activo:true
            })
            .eq(
                "prestamo_id",
                prestamo.supabaseId
            )
            .eq(
                "activo",
                false
            )
            .neq(
                "reestructuracion_numero",
                numeroReestructuracion
            );


        if(errorRestauracion){

            console.error(
                "No fue posible restaurar el cronograma anterior:",
                errorRestauracion
            );

        }

            return false;

        }


        /*
            6. ACTUALIZAR IDs DE SUPABASE
            EN EL CRONOGRAMA LOCAL
        */

        if(data){

            data.forEach(
                (cuotaSupabase, index) => {

                    if(
                        nuevoCronograma[index]
                    ){

                        nuevoCronograma[index].id =
                            cuotaSupabase.id;

                    }

                }
            );

        }


        console.log(
            "Reestructuración sincronizada con Supabase."
        );

        return true;


    }catch(error){

        console.error(
            "Error guardando reestructuración en Supabase:",
            error
        );

        return false;

    }

}

/*=========================================================
        GUARDAR REESTRUCTURACION
=========================================================*/
async function guardarReestructuracion(){

    /*=========================================================
        VALIDAR PERMISOS
    =========================================================*/

    if(!esAdministrador()){

        alert(
            "No tiene permisos para reestructurar préstamos."
        );

        return;
    }


    try{

        /*=====================================================
            VALIDAR PRÉSTAMO
        =====================================================*/

        if(!prestamoReestructuracion){

            alert(
                "No hay un préstamo seleccionado."
            );

            return;
        }


        const prestamo =
            prestamoReestructuracion;


        /*=====================================================
            OBTENER FECHA DE PAGO TOTAL
        =====================================================*/

        const campoFechaPagoTotal =
            document.getElementById(
                "fechaPagoTotal"
            );


        const fechaPagoTotal =
            campoFechaPagoTotal?.value || "";


        if(!fechaPagoTotal){

            alert(
                "Seleccione la fecha de pago total."
            );

            return;
        }


        /*=====================================================
            CALCULAR LIQUIDACIÓN
        =====================================================*/

        const liquidacion =
            calcularSaldoProvisional(
                prestamo
            );


        const capitalPendiente =
            Number(
                liquidacion.capitalPendiente || 0
            );


        const interesCausado =
            Number(
                liquidacion.interesProporcional || 0
            );


        const saldoProvisional =
            capitalPendiente +
            interesCausado;


        /*=====================================================
            VALIDAR SALDO
        =====================================================*/

        if(saldoProvisional <= 0){

            alert(
                "El préstamo no tiene saldo pendiente."
            );

            return;
        }


        /*=====================================================
            CONFIRMACIÓN DEL TOTAL
        =====================================================*/

        const confirmar =
            confirm(

                "LIQUIDACIÓN PARA PAGO TOTAL\n\n" +

                "Capital pendiente: " +
                dinero(capitalPendiente) +
                "\n\n" +

                "Interés causado: " +
                dinero(interesCausado) +
                "\n\n" +

                "TOTAL A PAGAR: " +
                dinero(saldoProvisional) +
                "\n\n" +

                "Fecha de pago total: " +
                fechaPagoTotal +
                "\n\n" +

                "¿Desea confirmar esta liquidación?"
            );


        if(!confirmar){

            return;
        }


        /*=====================================================
            CREAR HISTORIAL
        =====================================================*/

        if(
            !Array.isArray(
                prestamo.historialReestructuraciones
            )
        ){

            prestamo.historialReestructuraciones = [];

        }


        prestamo.historialReestructuraciones.push({

            fecha:
                hoy(),

            tipoOperacion:
                "PAGO_TOTAL",

            fechaPagoTotal:
                fechaPagoTotal,

            fechaUltimoCorte:
                liquidacion.fechaInicio,

            diasTranscurridos:
                liquidacion.diasTranscurridos,

            capitalOriginal:
                Number(
                    prestamo.capital || 0
                ),

            capitalPendiente:
                capitalPendiente,

            tasaOriginal:
                Number(
                    prestamo.interes || 0
                ),

            interesCausado:
                interesCausado,

            saldoReestructurado:
                saldoProvisional

        });


        /*=====================================================
            CREAR UNA ÚNICA OBLIGACIÓN DE PAGO TOTAL

            NO SE CREAN CUOTAS MENSUALES
            NO SE CREAN CUOTAS QUINCENALES
            NO SE GENERA INTERÉS NUEVO
        =====================================================*/

        const nuevoCronograma = [

            {

                numero:
                    1,

                fecha:
                    fechaPagoTotal,

                capital:
                    capitalPendiente,

                interes:
                    interesCausado,

                valor:
                    saldoProvisional,

                saldo:
                    saldoProvisional,

                pagado:
                    0,

                estado:
                    "PENDIENTE"

            }

        ];


        /*=====================================================
            ACTUALIZAR EL PRÉSTAMO

            CONSERVAMOS SUS CONDICIONES ORIGINALES.
            NO CAMBIAMOS PLAZO NI TASA.
        =====================================================*/

        prestamo.interesTotal =
            interesCausado;


        prestamo.saldoCapital =
            capitalPendiente;


        prestamo.saldoTotal =
            saldoProvisional;


        prestamo.cronograma =
            nuevoCronograma;


        prestamo.estado =
            "ACTIVO";


        prestamo.reestructurado =
            true;


        prestamo.fechaUltimaReestructuracion =
            hoy();


        prestamo.fechaPagoTotalReestructuracion =
            fechaPagoTotal;


        /*=====================================================
            SINCRONIZAR CON SUPABASE
        =====================================================*/

        const sincronizado =
            await guardarReestructuracionSupabase(
                prestamo,
                nuevoCronograma
            );


        if(!sincronizado){

            alert(
                "No fue posible guardar la liquidación en Supabase."
            );

            return;
        }


        /*=====================================================
            GUARDAR COPIA LOCAL
        =====================================================*/

        DB.guardar();


        /*=====================================================
            ACTUALIZAR INTERFAZ
        =====================================================*/

        listarPrestamos();

        actualizarDashboard();


        modalReestructuracion.hide();


        prestamoReestructuracion =
            null;


        /*=====================================================
            CONFIRMACIÓN
        =====================================================*/

        alert(

            "Liquidación para pago total guardada correctamente.\n\n" +

            "Fecha de pago: " +
            fechaPagoTotal +
            "\n\n" +

            "Total a pagar: " +
            dinero(saldoProvisional) +
            "\n\n" +

            "El crédito queda pendiente de pago total."
        );


    }catch(error){

        console.error(
            "Error al guardar liquidación para pago total:",
            error
        );


        alert(

            "No fue posible guardar la liquidación:\n\n" +
            error.message

        );

    }

}

/*=========================================================
        BOTON GUARDAR REESTRUCTURACION
=========================================================*/

const btnGuardarReestructuracion =
    document.getElementById(
        "btnGuardarReestructuracion"
    );

if(btnGuardarReestructuracion){

    btnGuardarReestructuracion.addEventListener(

        "click",

        guardarReestructuracion

    );

}

/***********************************************************
    OBTENER CRONOGRAMA ACTIVO DESDE SUPABASE
***********************************************************/
async function obtenerCronogramaSupabase(prestamoId){

    const {
        data,
        error
    } =
    await supabaseClient
        .from("cronograma_prestamos")
        .select("*")
        .eq(
            "prestamo_id",
            prestamoId
        )
        .eq(
            "activo",
            true
        )
        .order(
            "numero",
            {
                ascending:true
            }
        );

    if(error){

        console.error(
            "Error obteniendo cronograma:",
            error
        );

        return [];

    }

    return data || [];

}