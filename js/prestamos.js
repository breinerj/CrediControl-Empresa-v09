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

    tabla.innerHTML="";

    DB.prestamos
    .filter(prestamo => !prestamo.archivado)
    .forEach(prestamo=>{

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

        <strong>Capital:</strong><br>

        ${dinero(prestamo.capital)}

    </div>

    <div class="col-md-3">

        <strong>Saldo:</strong><br>

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

    if(modalPago){

    modalPago.hide();

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

        await supabaseClient
            .from("prestamos")
            .update({
                codigo: codigo
            })
            .eq("id", data.id);

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

        // Valores iniciales para la simulación
    document.getElementById("nuevoPlazo").value = 12;
    document.getElementById("nuevaTasa").value = 5;
    document.getElementById("nuevoPrimerPago").value =
        new Date().toISOString().substring(0,10);

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

    // Capital que realmente queda pendiente
    const capitalPendiente =
        Number(prestamo.saldoCapital || 0);

    // Capital inicial del préstamo
    const capitalInicial =
        Number(prestamo.capital || 0);

    // Tasa mensual original
    const tasa =
        Number(prestamo.interes || 0);

    // Buscar pagos realizados para este préstamo
    const pagosPrestamo = (DB.pagos || []).filter(

        pago =>
            Number(pago.prestamo) === Number(prestamo.id)

    );

    let fechaInicioPeriodo;

    // Si existen pagos, buscamos el último
    if(pagosPrestamo.length > 0){

        pagosPrestamo.sort(

            (a,b) =>
                new Date(b.fecha) - new Date(a.fecha)

        );

        fechaInicioPeriodo =
            pagosPrestamo[0].fecha;

    }else{

        // Si todavía no ha pagado ninguna cuota,
        // usamos la fecha de creación del préstamo

        fechaInicioPeriodo =
            prestamo.fechaPrestamo;

    }


    if(!fechaInicioPeriodo){

        return {

            capitalPendiente:capitalPendiente,

            diasTranscurridos:0,

            interesProporcional:0,

            saldoProvisional:capitalPendiente

        };

    }


    const fechaInicio =
        new Date(fechaInicioPeriodo + "T00:00:00");

    const fechaActual =
        new Date(hoy() + "T00:00:00");


    let diasTranscurridos = Math.floor(

        (fechaActual - fechaInicio) /

        (1000 * 60 * 60 * 24)

    );


    // Evitar valores negativos

    diasTranscurridos =
        Math.max(diasTranscurridos,0);


    // Interés mensual sobre el capital inicial
    // según la regla definida para la liquidación

    const interesMensual =
        capitalInicial * (tasa / 100);


    // Interés proporcional usando mes financiero de 30 días

    const interesProporcional =

        interesMensual *

        (diasTranscurridos / 30);


    // Capital pendiente + interés causado

    const saldoProvisional =

        capitalPendiente +

        interesProporcional;


    return {

        capitalPendiente:

            capitalPendiente,

        diasTranscurridos:

            diasTranscurridos,

        interesProporcional:

            interesProporcional,

        saldoProvisional:

            saldoProvisional

    };

}

function actualizarVistaPreviaReestructuracion(prestamo){

    if(prestamo){
        prestamoReestructuracion = prestamo;
    }

    if(!prestamoReestructuracion) return;

    const liquidacion =
    calcularSaldoProvisional(prestamoReestructuracion);

    const saldo =
    liquidacion.saldoProvisional;

    console.log("Liquidación provisional:", liquidacion);

    const meses = Number(
        document.getElementById("nuevoPlazo").value
    );

    const interes = Number(
        document.getElementById("nuevaTasa").value
    );

    const periodicidad =
        document.getElementById("nuevaPeriodicidad").value;

    const primerPago =
        document.getElementById("nuevoPrimerPago").value;

    const tabla =
        document.getElementById("tablaReestructuracion");

    if(
        saldo<=0 ||
        meses<=0 ||
        primerPago==""
    ){
        tabla.innerHTML="";
        return;
    }

    let cuotas = meses;

    if(periodicidad=="Quincenal"){
        cuotas = meses*2;
    }

    const interesTotal =
        saldo*(interes/100)*meses;

    const capitalCuota = saldo/cuotas;
    const interesCuota = interesTotal/cuotas;
    const valorCuota = capitalCuota+interesCuota;

    let saldoPendiente = saldo;
    let fecha = new Date(primerPago);

    tabla.innerHTML="";

    for(let i=1;i<=cuotas;i++){

        saldoPendiente -= capitalCuota;

        tabla.innerHTML += `
        <tr>
            <td>${i}</td>
            <td>${fecha.toISOString().substring(0,10)}</td>
            <td>${dinero(capitalCuota)}</td>
            <td>${dinero(interesCuota)}</td>
            <td>${dinero(valorCuota)}</td>
            <td>${dinero(Math.max(saldoPendiente,0))}</td>
        </tr>`;

        if(periodicidad=="Mensual"){
            fecha.setMonth(fecha.getMonth()+1);
        }else{
            fecha.setDate(fecha.getDate()+15);
        }

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

     if(!esAdministrador()){

        alert(
            "No tiene permisos para reestructurar préstamos."
        );

        return;

    }

    try{

        if(!prestamoReestructuracion){

            alert("No hay un préstamo seleccionado.");

            return;

        }

        const prestamo = prestamoReestructuracion;

        const meses = Number(
            document.getElementById("nuevoPlazo").value
        );

        const interes = Number(
            document.getElementById("nuevaTasa").value
        );

        const periodicidad =
            document.getElementById("nuevaPeriodicidad").value;

        const primerPago =
            document.getElementById("nuevoPrimerPago").value;


        if(meses <= 0){

            alert("Ingrese un plazo válido.");

            return;

        }

        if(interes < 0){

            alert("Ingrese una tasa válida.");

            return;

        }

        if(!primerPago){

            alert("Seleccione la fecha del primer pago.");

            return;

        }


        /*=============================================
            CALCULAR LIQUIDACION ACTUAL
        =============================================*/

        const liquidacion =
            calcularSaldoProvisional(prestamo);

        const capitalPendiente =
            Number(liquidacion.capitalPendiente || 0);

        const interesCausado =
            Number(liquidacion.interesProporcional || 0);

        const saldoProvisional =
            capitalPendiente + interesCausado;


        if(saldoProvisional <= 0){

            alert("El préstamo no tiene saldo pendiente.");

            return;

        }


        /*=============================================
            GUARDAR HISTORIAL ANTES DE MODIFICAR
        =============================================*/

        if(!prestamo.historialReestructuraciones){

            prestamo.historialReestructuraciones = [];

        }

        prestamo.historialReestructuraciones.push({

            fecha:hoy(),

            capitalOriginal:
                Number(prestamo.capital || 0),

            tasaAnterior:
                Number(prestamo.interes || 0),

            plazoAnterior:
                Number(prestamo.meses || 0),

            periodicidadAnterior:
                prestamo.periodicidad,

            saldoCapitalAnterior:
                Number(prestamo.saldoCapital || 0),

            saldoTotalAnterior:
                Number(prestamo.saldoTotal || 0),

            capitalRecuperado:
                Number(prestamo.capitalRecuperado || 0),

            interesRecuperado:
                Number(prestamo.interesRecuperado || 0),

            diasTranscurridos:
                liquidacion.diasTranscurridos,

            interesCausado:
                interesCausado,

            saldoReestructurado:
                saldoProvisional,

            nuevaTasa:
                interes,

            nuevoPlazo:
                meses,

            nuevaPeriodicidad:
                periodicidad,

            nuevoPrimerPago:
                primerPago

        });


        /*=============================================
            GENERAR NUEVO CRONOGRAMA
        =============================================*/

        let cuotas = meses;

        let tasaPeriodo = interes;

        if(periodicidad === "Quincenal"){

            cuotas = meses * 2;

            tasaPeriodo = interes / 2;

        }


        /*
            El capital financiero real sigue siendo
            únicamente el capital pendiente.

            El interés proporcional causado se agrega
            como interés pendiente en la primera cuota.
        */

        const capitalCuota =
            capitalPendiente / cuotas;


        /*
            Por ahora la reestructuración utiliza
            interés fijo sobre el capital pendiente.
        */

        const interesPeriodo =
            capitalPendiente *
            (tasaPeriodo / 100);


        let saldoCapital =
            capitalPendiente;

        let fecha =
            new Date(primerPago + "T00:00:00");

        let nuevoCronograma = [];


        for(let i = 1; i <= cuotas; i++){

            let interesCuota =
                interesPeriodo;

            /*
                El interés causado antes de la
                reestructuración se cobra en la
                primera cuota.
            */

            if(i === 1){

                interesCuota +=
                    interesCausado;

            }


            const valorCuota =
                capitalCuota +
                interesCuota;


            saldoCapital -=
                capitalCuota;


            nuevoCronograma.push({

                numero:i,

                fecha:
                    fecha
                    .toISOString()
                    .substring(0,10),

                capital:
                    capitalCuota,

                interes:
                    interesCuota,

                valor:
                    valorCuota,

                saldo:
                    Math.max(
                        saldoCapital,
                        0
                    ),

                pagado:0,

                estado:"PENDIENTE"

            });


            if(periodicidad === "Mensual"){

                fecha.setMonth(
                    fecha.getMonth() + 1
                );

            }else{

                fecha.setDate(
                    fecha.getDate() + 15
                );

            }

        }


        /*=============================================
            CALCULAR NUEVO TOTAL PENDIENTE
        =============================================*/

        const nuevoInteresTotal =
            nuevoCronograma.reduce(

                (total, cuota) =>
                    total +
                    Number(cuota.interes || 0),

                0

            );


        const nuevoSaldoTotal =
            capitalPendiente +
            nuevoInteresTotal;


        /*=============================================
            ACTUALIZAR EL MISMO PRESTAMO
        =============================================*/

        prestamo.interes =
            interes;

        prestamo.meses =
            meses;

        prestamo.periodicidad =
            periodicidad;

        prestamo.primerPago =
            primerPago;

        prestamo.interesTotal =
            nuevoInteresTotal;

        prestamo.saldoCapital =
            capitalPendiente;

        prestamo.saldoTotal =
            nuevoSaldoTotal;

        prestamo.cronograma =
            nuevoCronograma;

        prestamo.estado =
            "ACTIVO";

        prestamo.reestructurado =
            true;

        prestamo.fechaUltimaReestructuracion =
            hoy();


        /*=============================================
    SINCRONIZAR REESTRUCTURACION
    CON SUPABASE
=============================================*/

        const sincronizado =
            await guardarReestructuracionSupabase(
                prestamo,
                nuevoCronograma
            );


        if(!sincronizado){

            alert(
                "No fue posible guardar la reestructuración en Supabase."
            );

            return;

        }


        /*=============================================
            GUARDAR COPIA LOCAL
        =============================================*/

        DB.guardar();


        /*=============================================
            ACTUALIZAR INTERFAZ
        =============================================*/

        listarPrestamos();

        actualizarDashboard();

        modalReestructuracion.hide();

        prestamoReestructuracion = null;


        alert(
            "Reestructuración guardada correctamente."
        );


    }catch(error){

        console.error(
            "Error al guardar reestructuración:",
            error
        );

        alert(
            "No fue posible guardar la reestructuración: " +
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