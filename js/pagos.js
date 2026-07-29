/*=========================================================
    CREDICONTROL
    pagos.js
=========================================================*/

let prestamoSeleccionado = null;

/*=========================================================
        BUSCAR PRESTAMO
=========================================================*/

function seleccionarPrestamo(id){

    prestamoSeleccionado = DB.prestamos.find(

        p=>p.id==id

    );

    if(!prestamoSeleccionado){

        alert("Préstamo no encontrado");

        return;

    }

    mostrarCuotasPendientes();

}

/*=========================================================
        MOSTRAR CUOTAS
=========================================================*/

function mostrarCuotasPendientes(){

    let pendientes = prestamoSeleccionado.cronograma.filter(

        c=>c.estado!="PAGADA"

    );

    console.clear();

    console.table(pendientes);

}

/*=========================================================
        PAGAR CUOTA
=========================================================*/

function pagarCuota(numeroCuota){

    let cuota = prestamoSeleccionado.cronograma.find(

        c=>c.numero==numeroCuota

    );

    if(!cuota){

        alert("No existe la cuota");

        return;

    }

    let valor = Number(

        prompt(

            "Valor recibido",

            cuota.valor

        )

    );

    if(valor<=0){

        return;

    }

    cuota.pagado += valor;

    if(cuota.pagado>=cuota.valor){

        cuota.pagado = cuota.valor;

        cuota.estado = "PAGADA";

    }else{

        cuota.estado = "PARCIAL";

    }

    function construirCronograma(){

    let capital = Number(
        document.getElementById("capital").value
    );

    let interes = Number(
        document.getElementById("interes").value
    );

    let meses = Number(
        document.getElementById("meses").value
    );

    let periodicidad =
        document.getElementById("periodicidad").value;

    let cuotas = meses;

    if(periodicidad=="Quincenal"){

        cuotas = meses*2;

    }

    let interesTotal =
        capital*(interes/100)*meses;

    let valorCuota =
        (capital+interesTotal)/cuotas;

    let capitalCuota =
        capital/cuotas;

    let interesCuota =
        interesTotal/cuotas;

    let saldo = capital;

    let fechaPago = new Date(

        document.getElementById("primerPago").value

    );

    let cronograma=[];

    for(let i=1;i<=cuotas;i++){

        saldo-=capitalCuota;

        cronograma.push({

            numero:i,

            fecha:fechaPago.toISOString().substring(0,10),

            capital:capitalCuota,

            interes:interesCuota,

            valor:valorCuota,

            saldo:Math.max(saldo,0),

            pagado:0,

            estado:"PENDIENTE"

        });

        if(periodicidad=="Mensual"){

            fechaPago.setMonth(

                fechaPago.getMonth()+1

            );

        }else{

            fechaPago.setDate(

                fechaPago.getDate()+15

            );

        }

    }

    return cronograma;

}

    registrarPago({

        id:generarId(),

        prestamoId:prestamoSeleccionado.id,

        cuota:cuota.numero,

        fecha:hoy(),

        valor:valor

    });

    prestamoSeleccionado.saldoTotal -= valor;

    if(prestamoSeleccionado.saldoTotal<0){

        prestamoSeleccionado.saldoTotal=0;

    }

    DB.guardar();

    listarPrestamos();

    actualizarDashboard();

    alert("Pago registrado correctamente.");

}
/*=========================================================
        MODAL PAGO
=========================================================*/

let modalPago;

async function abrirPago(idPrestamo, numeroCuota){

    /*
        BUSCAR PRÉSTAMO LOCAL
    */

    let prestamo =
        obtenerPrestamo(idPrestamo);

    if(!prestamo){

        alert(
            "No se encontró el préstamo."
        );

        return;

    }

    /*
        VALIDAR ID DE SUPABASE
    */

    if(!prestamo.supabaseId){

        alert(
            "El préstamo no está sincronizado con Supabase."
        );

        return;

    }

    /*
        OBTENER CLIENTE
    */

    let cliente =
        obtenerCliente(
            prestamo.clienteId
        );

    if(!cliente){

        alert(
            "No se encontró el cliente."
        );

        return;

    }

    /*
        CARGAR CRONOGRAMA ACTUALIZADO
        DESDE SUPABASE
    */

    const cronograma =
        await obtenerCronogramaSupabase(
            prestamo.supabaseId
        );

    if(
        !cronograma ||
        cronograma.length === 0
    ){

        alert(
            "No fue posible consultar el cronograma del préstamo."
        );

        return;

    }

    /*
        ACTUALIZAR COPIA LOCAL
    */

    prestamo.cronograma =
        cronograma;

    /*
        BUSCAR CUOTA
    */

    let cuota =
        cronograma.find(
            c =>
                Number(c.numero) ===
                Number(numeroCuota)
        );

    if(!cuota){

        alert(
            "No se encontró la cuota."
        );

        return;

    }

    /*
        IMPORTANTE:
        cuota.id AHORA ES EL ID REAL
        DE cronograma_prestamos EN SUPABASE
    */

    console.log(
        "Préstamo:",
        prestamo
    );

    console.log(
        "Cuota Supabase:",
        cuota
    );

    console.log(
        "Cuota ID Supabase:",
        cuota.id
    );

    /*
        CREAR MODAL
    */

    if(!modalPago){

        modalPago =
            new bootstrap.Modal(
                document.getElementById(
                    "modalPago"
                )
            );

    }

    /*
        ASIGNAR DATOS
    */

    document.getElementById(
        "pagoPrestamo"
    ).value =
        idPrestamo;

    document.getElementById(
        "pagoCuota"
    ).value =
        numeroCuota;

    document.getElementById(
        "lblClientePago"
    ).value =
        cliente.nombre;

    const saldoCuota =
        Number(cuota.valor || 0) -
        Number(cuota.pagado || 0);

    document.getElementById(
        "lblValorCuotaPago"
    ).value =
        dinero(saldoCuota);

    document.getElementById(
        "valorPago"
    ).value =
        saldoCuota;

    document.getElementById(
        "observacionPago"
    ).value =
        "";

    /*
        ABRIR MODAL
    */

    modalPago.show();

}
/*=========================================================
        GUARDAR PAGO
=========================================================*/

document.addEventListener("DOMContentLoaded",()=>{

    const btn=document.getElementById("btnGuardarPago");

    if(btn){

        btn.addEventListener(

            "click",

            guardarPago

        );

    }

});

/***********************************************************
    OBTENER PAGOS ANTERIORES DE UNA CUOTA
***********************************************************/
async function obtenerPagosCuotaSupabase(cuotaId){

    const { data, error } =
        await supabaseClient
            .from("pagos")
            .select("capital, interes")
            .eq("cuota_id", cuotaId);

    if(error){

        console.error(
            "Error consultando pagos anteriores:",
            error
        );

        return null;

    }

    const totales = data.reduce(
        (acumulado, pago) => {

            acumulado.capital +=
                Number(pago.capital || 0);

            acumulado.interes +=
                Number(pago.interes || 0);

            return acumulado;

        },
        {
            capital: 0,
            interes: 0
        }
    );

    return totales;

}

async function guardarPago(){

    const idPrestamo=

        Number(

            document.getElementById("pagoPrestamo").value

        );

    const numeroCuota=

        Number(

            document.getElementById("pagoCuota").value

        );

    const valor=

        Number(

            document.getElementById("valorPago").value

        );

    const observacion=

        document.getElementById("observacionPago").value;

    if(valor<=0){

        alert("Ingrese un valor.");

        return;

    }

    let prestamo=

        obtenerPrestamo(idPrestamo);

    let cuota=

        prestamo.cronograma.find(

            c=>c.numero==numeroCuota

        );

    cuota.pagado+=valor;

    if(cuota.pagado>=cuota.valor){

        cuota.pagado=cuota.valor;

        cuota.estado="PAGADA";

    }else{

        cuota.estado="PARCIAL";

    }
    /*=========================================================
    ACTUALIZAR RECUPERACION
=========================================================*/

const pagosAnteriores =
    await obtenerPagosCuotaSupabase(
        cuota.id
    );

if(!pagosAnteriores){

    alert(
        "No fue posible consultar los pagos anteriores de la cuota."
    );

    return;

}

const capitalPendiente =
    Math.max(
        0,
        Number(cuota.capital) -
        Number(pagosAnteriores.capital)
    );

const interesPendiente =
    Math.max(
        0,
        Number(cuota.interes) -
        Number(pagosAnteriores.interes)
    );


let capitalPagado =
    Math.min(
        capitalPendiente,
        valor
    );


let restante =
    valor - capitalPagado;


let interesPagado =
    Math.min(
        interesPendiente,
        restante
    );

prestamo.capitalRecuperado =

    Number(prestamo.capitalRecuperado || 0)

    + capitalPagado;

prestamo.interesRecuperado =

    Number(prestamo.interesRecuperado || 0)

    + interesPagado;

prestamo.saldoCapital =

    Math.max(

        0,

        Number(prestamo.saldoCapital || 0)

        - capitalPagado

    );

    /*=========================================================
    USUARIO QUE REGISTRA EL PAGO
=========================================================*/

const usuarioActual =
    obtenerUsuarioActual();


const nuevoPago = {

    id:
        Date.now(),

    recibo:
        generarConsecutivoRecibo(),

    prestamo:
        idPrestamo,

    cuota:
        numeroCuota,

    fecha:
        hoy(),

    fechaHoraRegistro:
        new Date().toISOString(),

    valor:
        valor,

    capitalPagado:
        capitalPagado,

    interesPagado:
        interesPagado,

    saldoCapital:
        prestamo.saldoCapital,

    observacion:
        observacion,

    /* DATOS DEL USUARIO */

    usuarioId:
        usuarioActual
            ? usuarioActual.id
            : null,

    usuarioNombre:
        usuarioActual
            ? usuarioActual.nombre
            : "Sistema",

    usuarioRol:
        usuarioActual
            ? usuarioActual.rol
            : ""

};


    const pagoSupabase =
        await registrarPagoSupabase(
            nuevoPago,
            prestamo,
            cuota
        );

    if(!pagoSupabase){

        alert(
            "El pago no fue registrado. No se realizaron cambios."
        );

        return;

}

    const cuotaActualizada =
        await actualizarCuotaSupabase(
            cuota
        );

    if(!cuotaActualizada){

        alert(
            "El pago fue registrado, pero ocurrió un error al actualizar la cuota."
        );

        return;

}

    nuevoPago.supabaseId =
        pagoSupabase.id;

    registrarPago(nuevoPago);

    recalcularSaldo(prestamo);

    /*
    GUARDAR EL SALDO QUE QUEDÓ
    INMEDIATAMENTE DESPUÉS DEL PAGO
*/

    await actualizarSaldoHistoricoPagoSupabase(
        pagoSupabase.id,
        prestamo
    );

    /*
        GUARDAR TAMBIÉN EN LA COPIA LOCAL
    */

    nuevoPago.saldoCapital =
        prestamo.saldoCapital;

    nuevoPago.saldoTotal =
        prestamo.saldoTotal;

        setTimeout(function(){

    const generar = confirm(
        "Pago registrado correctamente.\n\n" +
        "Recibo: " + nuevoPago.recibo + "\n\n" +
        "¿Desea generar el comprobante de pago?"
    );

    if(generar){

        generarReciboPDF(
            nuevoPago.id
        );

    }

},300);

        /*=========================================================
    VALIDAR ESTADO DEL PRÉSTAMO
=========================================================*/

const cuotasPendientes = prestamo.cronograma.filter(

    cuota => cuota.estado !== "PAGADA"

);

prestamo.estado = cuotasPendientes.length === 0
    ? "FINALIZADO"
    : "ACTIVO";

        /*=========================================================
    VALIDAR SI EL PRÉSTAMO FINALIZÓ
=========================================================*/

const pendientes = prestamo.cronograma.filter(

    cuota => cuota.estado !== "PAGADA"

);

if(pendientes.length === 0){

    prestamo.estado = "FINALIZADO";

}else{

    prestamo.estado = "ACTIVO";

}

const prestamoActualizado =
    await actualizarPrestamoSupabase(
        prestamo
    );

if(!prestamoActualizado){

    console.warn(
        "El pago y la cuota se guardaron, pero no se pudo actualizar el préstamo en Supabase."
    );

}

        actualizarDashboard();

        listarPrestamos();

        listarPagos();

        DB.guardar();

        modalPago.hide();

        abrirCronograma(idPrestamo);

}

/***********************************************************
    REGISTRAR PAGO EN SUPABASE
***********************************************************/
async function registrarPagoSupabase(pago, prestamo, cuota){

    try{

        const empresaId =
            DB.config?.licencia?.empresaId;

        if(!empresaId){

            alert("Empresa no identificada.");

            return null;

        }

        if(!prestamo.supabaseId){

            alert(
                "El préstamo no está sincronizado con Supabase."
            );

            return null;

        }

        if(!cuota.id){

            alert(
                "La cuota no tiene ID de Supabase."
            );

            return null;

        }

        const nuevoPago = {

            empresa_id: empresaId,

            prestamo_id: prestamo.supabaseId,

            cuota_id: cuota.id,

            fecha_pago: pago.fecha,

            valor: pago.valor,

            capital: pago.capitalPagado,

            interes: pago.interesPagado,

            observaciones: pago.observacion,

            usuario: pago.usuarioNombre,

            recibo: pago.recibo

};

        console.log(
            "Pago enviado a Supabase:",
            nuevoPago
        );

        const {
            data,
            error
        } = await supabaseClient
            .from("pagos")
            .insert(nuevoPago)
            .select()
            .single();

        if(error){

            console.error("Error completo guardando pago:", error);
            console.error("Código:", error.code);
            console.error("Mensaje:", error.message);
            console.error("Detalles:", error.details);
            console.error("Hint:", error.hint);

        alert(
            "No fue posible guardar el pago.\n\n" +
            "Error: " + error.message
        );

        return null;
}

/*
    GENERAR CÓDIGO ÚNICO DE RECIBO
    USANDO EL ID DE SUPABASE
*/

    const codigoRecibo =
        "REC-" +
        String(data.id).padStart(6, "0");


    const {
        error: errorRecibo
    } =
    await supabaseClient
        .from("pagos")
        .update({

            recibo: codigoRecibo

        })
        .eq(
            "id",
            data.id
        );


    if(errorRecibo){

        console.error(
            "Error generando código de recibo:",
            errorRecibo
        );

    }else{

        /*
            ACTUALIZAR RESPUESTA DE SUPABASE
        */

        data.recibo =
            codigoRecibo;

        /*
            ACTUALIZAR OBJETO LOCAL DEL PAGO
        */

        pago.recibo =
            codigoRecibo;

        console.log(
            "Código de recibo generado:",
            codigoRecibo
        );

    }

        console.log(
            "Pago guardado en Supabase:",
            data
        );

        return data;

    }catch(error){

        console.error(
            "Error registrarPagoSupabase:",
            error
        );

        return null;

    }

}

/***********************************************************
    ACTUALIZAR CUOTA EN SUPABASE
***********************************************************/
async function actualizarCuotaSupabase(cuota){

    try{

        const { data, error } =
            await supabaseClient
                .from("cronograma_prestamos")
                .update({

                    pagado:
                        cuota.pagado,

                    estado:
                        cuota.estado

                })
                .eq(
                    "id",
                    cuota.id
                )
                .select()
                .single();

        if(error){

            console.error(
                "Error actualizando cuota:",
                error
            );

            return null;

        }

        console.log(
            "Cuota actualizada en Supabase:",
            data
        );

        return data;

    }catch(error){

        console.error(
            "Error actualizarCuotaSupabase:",
            error
        );

        return null;

    }

}

/***********************************************************
    ACTUALIZAR PRÉSTAMO EN SUPABASE DESPUÉS DE UN PAGO
***********************************************************/
async function actualizarPrestamoSupabase(prestamo){

    try{

        if(!prestamo.supabaseId){

            console.error(
                "El préstamo no tiene supabaseId."
            );

            return null;

        }

        const { data, error } =
            await supabaseClient
                .from("prestamos")
                .update({

                    saldo_capital:
                        prestamo.saldoCapital,

                    saldo_total:
                        prestamo.saldoTotal,

                    capital_recuperado:
                        prestamo.capitalRecuperado,

                    interes_recuperado:
                        prestamo.interesRecuperado,

                    estado:
                        prestamo.estado

                })
                .eq(
                    "id",
                    prestamo.supabaseId
                )
                .select()
                .single();

        if(error){

            console.error(
                "Error actualizando préstamo:",
                error
            );

            return null;

        }

        console.log(
            "Préstamo actualizado en Supabase:",
            data
        );

        return data;

    }catch(error){

        console.error(
            "Error actualizarPrestamoSupabase:",
            error
        );

        return null;

    }

}
/*=========================================================
    REGISTRAR PAGO
=========================================================*/

function registrarPago(pago){

    if(!DB.pagos){

        DB.pagos=[];

    }

    DB.pagos.push(pago);

    DB.guardar();

}

/***********************************************************
    CARGAR PAGOS DESDE SUPABASE
***********************************************************/
async function cargarPagosSupabase(){

    try{

        const empresaId =
            DB.config?.licencia?.empresaId;

        if(!empresaId){

            console.error(
                "Empresa no identificada al cargar pagos."
            );

            return false;

        }

        /*
            OBTENER PAGOS
            DESDE SUPABASE
        */

        const {
            data,
            error
        } =
        await supabaseClient
            .from("pagos")
            .select("*")
            .eq(
                "empresa_id",
                empresaId
            )
            .order(
                "created_at",
                {
                    ascending:false
                }
            );

        if(error){

            console.error(
                "Error cargando pagos desde Supabase:",
                error
            );

            return false;

        }


        /*
            CONVERTIR FORMATO SUPABASE
            AL FORMATO DE CREDICONTROL
        */

        DB.pagos =
            data.map(pago=>{

                /*
                    BUSCAR EL PRÉSTAMO LOCAL
                    USANDO EL ID DE SUPABASE
                */

                const prestamo =
                    DB.prestamos.find(
                        p =>
                            Number(p.supabaseId) ===
                            Number(pago.prestamo_id)
                    );


                /*
                    BUSCAR LA CUOTA
                    USANDO cuota_id
                */

                let cuotaNumero = "";

                if(
                    prestamo &&
                    prestamo.cronograma
                ){

                    const cuota =
                        prestamo.cronograma.find(
                            c =>
                                Number(c.id) ===
                                Number(pago.cuota_id)
                        );

                    if(cuota){

                        cuotaNumero =
                            cuota.numero;

                    }

                }


                return {

                    /*
                        ID DEL PAGO
                    */

                    id:
                        pago.id,

                    supabaseId:
                        pago.id,


                    /*
                        ID LOCAL DEL PRÉSTAMO
                    */

                    prestamo:
                        prestamo
                            ? prestamo.id
                            : null,

                    prestamoId:
                        prestamo
                            ? prestamo.id
                            : null,


                    /*
                        CUOTA
                    */

                    cuota:
                        cuotaNumero,

                    cuotaSupabaseId:
                        pago.cuota_id,


                    /*
                        DATOS DEL PAGO
                    */

                    fecha:
                        pago.fecha_pago,

                    valor:
                        Number(
                            pago.valor || 0
                        ),

                    capitalPagado:
                        Number(
                            pago.capital || 0
                        ),

                    interesPagado:
                        Number(
                            pago.interes || 0
                        ),


                    saldoCapital:
                        Number(
                            pago.saldo_capital_despues || 0
                        ),

                    saldoTotal:
                        Number(
                            pago.saldo_total_despues || 0
                        ),

                    observacion:
                        pago.observaciones || "",

                    usuarioNombre:
                        pago.usuario || "",


                    /*
                        RECIBO
                        POR AHORA PUEDE NO EXISTIR
                        EN SUPABASE
                    */

                    recibo:
                        pago.recibo || null

                };

            });


        /*
            ACTUALIZAR CACHÉ LOCAL
        */

        DB.guardar();


        console.log(
            "Pagos cargados desde Supabase:",
            DB.pagos.length
        );

        return true;


    }catch(error){

        console.error(
            "Error cargarPagosSupabase:",
            error
        );

        return false;

    }

}
/*=========================================================
        LISTAR PAGOS
=========================================================*/

function listarPagos(){

    const tabla =
        document.getElementById("tablaPagos");

    if(!tabla) return;

    tabla.innerHTML = "";

    DB.pagos.forEach(pago=>{

        const prestamo = obtenerPrestamo(

            pago.prestamo ||
            pago.prestamoId

        );

        const cliente = prestamo ?

            obtenerCliente(
                prestamo.clienteId
            )

            : null;


tabla.innerHTML += `

<tr>

    <td>
        ${pago.fecha}
    </td>

    <td>
        ${cliente ? cliente.nombre : ""}
    </td>

    <td>
        ${prestamo ? prestamo.codigo : ""}
    </td>

    <td>
        ${pago.cuota}
    </td>

    <td>
        ${dinero(pago.valor)}
    </td>

    <td>

        <span class="badge bg-success">
            Registrado
        </span>

    </td>


    <!-- REGISTRADO POR -->

    <td>

        ${
            pago.usuarioNombre
                ? pago.usuarioNombre
                : "Registro anterior"
        }

    </td>


    <!-- ACCIONES -->

    <td>

        ${
            pago.recibo

            ?

            `
            <button
                class="btn btn-primary btn-sm"
                onclick="generarReciboPDF(${pago.id})">

                <i class="fa fa-file-pdf"></i>

                ${pago.recibo}

            </button>


            <button
                class="btn btn-success btn-sm"
                onclick="compartirReciboWhatsApp(${pago.id})"
                title="Compartir por WhatsApp">

                <i class="fa-brands fa-whatsapp"></i>

                WhatsApp

            </button>
            `

            :

            `
            <span class="text-muted">
                Sin recibo
            </span>
            `
        }

    </td>

</tr>

`;

    });

}


/***********************************************************
    GUARDAR SALDO HISTÓRICO DEL PAGO
***********************************************************/
async function actualizarSaldoHistoricoPagoSupabase(
    pagoSupabaseId,
    prestamo
){

    try{

        const { error } =
            await supabaseClient
                .from("pagos")
                .update({

                    saldo_capital_despues:
                        prestamo.saldoCapital,

                    saldo_total_despues:
                        prestamo.saldoTotal

                })
                .eq(
                    "id",
                    pagoSupabaseId
                );

        if(error){

            console.error(
                "Error guardando saldo histórico del pago:",
                error
            );

            return false;

        }

        console.log(
            "Saldo histórico del pago actualizado."
        );

        return true;

    }catch(error){

        console.error(
            "Error actualizarSaldoHistoricoPagoSupabase:",
            error
        );

        return false;

    }

}