/***********************************************************
    OBTENER RESUMEN FINANCIERO DESDE SUPABASE
***********************************************************/
async function obtenerResumenDashboardSupabase(){

    try{

        const empresaId =
            DB.config?.licencia?.empresaId;

        if(!empresaId){

            console.error(
                "Empresa no identificada en dashboard."
            );

            return null;

        }

        /*
            OBTENER PRÉSTAMOS DE LA EMPRESA
        */

        const {
            data: prestamos,
            error
        } =
        await supabaseClient
            .from("prestamos")
            .select(`
                capital,
                saldo_capital,
                saldo_total,
                capital_recuperado,
                interes_recuperado,
                estado
            `)
            .eq(
                "empresa_id",
                empresaId
            );

        if(error){

            console.error(
                "Error obteniendo resumen dashboard:",
                error
            );

            return null;

        }

        /*
            CALCULAR INDICADORES
        */

        const resumen = {

            capitalPrestado: 0,

            capitalRecuperado: 0,

            capitalPendiente: 0,

            interesesRecuperados: 0,

            prestamosActivos: 0

        };


        prestamos.forEach(prestamo=>{

            resumen.capitalPrestado +=
                Number(
                    prestamo.capital || 0
                );

            resumen.capitalRecuperado +=
                Number(
                    prestamo.capital_recuperado || 0
                );

            resumen.capitalPendiente +=
                Number(
                    prestamo.saldo_total || 0
                );

            resumen.interesesRecuperados +=
                Number(
                    prestamo.interes_recuperado || 0
                );

            if(
                prestamo.estado === "ACTIVO"
            ){

                resumen.prestamosActivos++;

            }

        });

        return resumen;

    }catch(error){

        console.error(
            "Error obtenerResumenDashboardSupabase:",
            error
        );

        return null;

    }

}

/***********************************************************
    OBTENER COBROS PENDIENTES DESDE SUPABASE
***********************************************************/
async function obtenerCobrosSupabase(){

    try{

        const empresaId =
            DB.config?.licencia?.empresaId;

        if(!empresaId){

            console.error(
                "Empresa no identificada."
            );

            return [];

        }

        /*
            OBTENER PRÉSTAMOS
            DE LA EMPRESA
        */

        const {
            data: prestamos,
            error: errorPrestamos
        } =
        await supabaseClient
            .from("prestamos")
            .select(`
                id,
                local_id,
                codigo,
                cliente_local_id
            `)
            .eq(
                "empresa_id",
                empresaId
            );

        if(errorPrestamos){

            console.error(
                "Error obteniendo préstamos:",
                errorPrestamos
            );

            return [];

        }


        /*
            IDS DE PRÉSTAMOS
        */

        const idsPrestamos =
            prestamos.map(
                p => p.id
            );

        if(idsPrestamos.length === 0){

            return [];

        }


        /*
            OBTENER CRONOGRAMA
        */

        const fechaActual = hoy();

        const {
            data: cuotas,
            error: errorCuotas
        } =
        await supabaseClient
            .from("cronograma_prestamos")
            .select("*")
            .in(
                "prestamo_id",
                idsPrestamos
            )
            .neq(
                "estado",
                "PAGADA"
            )
            .lte(
                "fecha",
                fechaActual
            )
            .order(
                "fecha",
                {
                    ascending:true
                }
            );


        if(errorCuotas){

            console.error(
                "Error obteniendo cobros:",
                errorCuotas
            );

            return [];

        }

        console.log(
            "Fecha actual:",
            fechaActual
        );

        console.log(
            "Cobros obtenidos desde Supabase:",
            cuotas
        );


        /*
            UNIR CUOTA CON PRÉSTAMO
        */

        return cuotas.map(cuota=>{

            const prestamo =
                prestamos.find(
                    p =>
                        Number(p.id) ===
                        Number(cuota.prestamo_id)
                );

            return {

                ...cuota,

                prestamo

            };

        });


    }catch(error){

        console.error(
            "Error obtenerCobrosSupabase:",
            error
        );

        return [];

    }

}

/*=========================================================
    ACTUALIZAR DASHBOARD
=========================================================*/

async function actualizarDashboard(){

    const capitalPrestado =
        document.getElementById("capitalPrestado");

    const capitalRecuperado =
        document.getElementById("capitalRecuperado");

    const capitalPendiente =
        document.getElementById("capitalPendiente");

    const cobrosHoy =
        document.getElementById("cobrosHoy");

    const interesesRecuperados =
        document.getElementById("interesesRecuperados");

    const prestamosActivos =
        document.getElementById("prestamosActivos");

    const resumen =
        await obtenerResumenDashboardSupabase();

    const cobros =
        await obtenerCobrosSupabase();    

    if(!resumen){

        console.warn(
            "No fue posible cargar el resumen desde Supabase."
        );

    return;

}


    if(capitalPrestado){

        capitalPrestado.innerHTML =
            dinero(resumen.capitalPrestado);

    }


    if(capitalRecuperado){

        capitalRecuperado.innerHTML =
            dinero(resumen.capitalRecuperado);

    }


    if(capitalPendiente){

        capitalPendiente.innerHTML =
            dinero(resumen.capitalPendiente);

    }


    if(cobrosHoy){

        const cantidadHoy =
            cobros.filter(
                cuota =>
                    cuota.fecha === hoy()
            ).length;

        cobrosHoy.innerHTML =
            cantidadHoy;

}


    if(interesesRecuperados){

        interesesRecuperados.innerHTML =
            dinero(resumen.interesesRecuperados);

    }


    if(prestamosActivos){

        prestamosActivos.innerHTML =
            resumen.prestamosActivos;

    }


        const lblTotalHoy =
            document.getElementById("totalCobrosHoy");

        if(lblTotalHoy){

        const totalHoy =
            cobros
                .filter(
                    cuota =>
                        cuota.fecha === hoy()
                )
                .reduce(
                    (total, cuota) =>
                        total +
                        (
                            Number(cuota.valor || 0) -
                            Number(cuota.pagado || 0)
                        ),
                    0
                );

        lblTotalHoy.innerHTML =
            dinero(totalHoy);

}


    cargarTablaCobrosHoy(cobros);

    cargarTablaCobros(cobros);

    actualizarGraficoCapital(resumen);

}


/*=========================================================
    COBROS DEL DIA
=========================================================*/

function contarCobrosHoy(){

    let fecha = hoy();

    let cantidad = 0;

    DB.prestamos.forEach(prestamo=>{

        if(!prestamo.cronograma) return;

        prestamo.cronograma.forEach(cuota=>{

            if(cuota.fecha==fecha && cuota.estado!="PAGADA"){

                cantidad++;

            }

        });

    });

    return cantidad;

}

/*=========================================================
    TOTAL COBROS DEL DIA
=========================================================*/

function totalCobrosHoy(){

    let total = 0;

    let fecha = hoy();

    DB.prestamos.forEach(prestamo=>{

        if(!prestamo.cronograma) return;

        prestamo.cronograma.forEach(cuota=>{

            if(cuota.fecha===fecha && cuota.estado!=="PAGADA"){

                total += Number(cuota.valor - cuota.pagado);

            }

        });

    });

    return total;

}

/*=========================================================
    TABLA COBROS DEL DIA - SUPABASE
=========================================================*/

function cargarTablaCobrosHoy(cobros){

    const tabla =
        document.getElementById("tablaCobrosHoy");

    if(!tabla) return;

    tabla.innerHTML = "";

    const fechaActual = hoy();

    /*
        ORDENAR:
        PRIMERO LOS MÁS VENCIDOS
        DESPUÉS LOS DE HOY
    */

    const cobrosOrdenados =
        [...cobros].sort((a,b)=>{

            return new Date(a.fecha) -
                   new Date(b.fecha);

        });


    cobrosOrdenados.forEach(cuota=>{

        const prestamo =
            cuota.prestamo;

        if(!prestamo) return;


        /*
            BUSCAR CLIENTE LOCAL
        */

        const cliente =
            DB.clientes.find(
                c =>
                    Number(c.id) ===
                    Number(
                        prestamo.cliente_local_id
                    )
            );


        /*
            ESTADO DEL COBRO
        */

        let estadoCobro = "Hoy";

        let color =
            "bg-warning";

        let diasMora = 0;


        if(
            cuota.fecha <
            fechaActual
        ){

            estadoCobro =
                "Vencido";

            color =
                "bg-danger";


            const fechaCuota =
                new Date(
                    cuota.fecha +
                    "T00:00:00"
                );

            const fechaHoy =
                new Date(
                    fechaActual +
                    "T00:00:00"
                );


            diasMora =
                Math.floor(

                    (
                        fechaHoy -
                        fechaCuota
                    )

                    /

                    (
                        1000 *
                        60 *
                        60 *
                        24
                    )

                );

        }


        /*
            SALDO PENDIENTE
        */

        const saldoPendiente =

            Number(
                cuota.valor || 0
            )

            -

            Number(
                cuota.pagado || 0
            );


        tabla.innerHTML += `

            <tr>

                <td>
                    ${cliente
                        ? cliente.nombre
                        : ""}
                </td>

                <td>
                    ${cliente
                        ? cliente.telefono
                        : ""}
                </td>

                <td>
                    ${prestamo.codigo || ""}
                </td>

                <td>
                    ${cuota.numero}
                </td>

                <td>
                    ${dinero(
                        saldoPendiente
                    )}
                </td>

                <td>

                    <span
                        class="badge ${color}"
                    >

                        ${estadoCobro}

                    </span>

                </td>

                <td>
                    ${diasMora}
                </td>

                <td>

                    <button
                        class="btn btn-success btn-sm"
                        onclick="abrirPago(
                            ${prestamo.local_id},
                            ${cuota.numero}
                        )"
                    >
                        💰 Cobrar
                    </button>


                    <button
                        class="btn btn-info btn-sm"
                        onclick="abrirMapaCliente(
                            '${encodeURIComponent(
                                (cliente?.direccion || "") +
                                ", " +
                                (cliente?.ciudad || "")
                            )}'
                        )"
                        title="Ver ubicación del cliente"
                    >
                        📍 Mapa
                    </button>

                </td>

            </tr>

        `;

    });

}

/*=========================================================
    TABLA SECCION COBROS - SUPABASE
=========================================================*/

function cargarTablaCobros(cobros){

    const tabla =
        document.getElementById(
            "tablaCobros"
        );

    if(!tabla) return;

    tabla.innerHTML = "";

    const fechaActual =
        hoy();


    const cobrosOrdenados =
        [...cobros].sort((a,b)=>{

            return new Date(a.fecha) -
                   new Date(b.fecha);

        });


    cobrosOrdenados.forEach(cuota=>{

        const prestamo =
            cuota.prestamo;

        if(!prestamo) return;


        /*
            BUSCAR CLIENTE
        */

        const cliente =
            DB.clientes.find(
                c =>
                    Number(c.id) ===
                    Number(
                        prestamo.cliente_local_id
                    )
            );


        /*
            ESTADO COBRO
        */

        let estadoCobro =
            "Hoy";

        let color =
            "bg-warning";

        let diasMora =
            0;


        if(
            cuota.fecha <
            fechaActual
        ){

            estadoCobro =
                "Vencido";

            color =
                "bg-danger";


            const fechaCuota =
                new Date(
                    cuota.fecha +
                    "T00:00:00"
                );

            const fechaHoy =
                new Date(
                    fechaActual +
                    "T00:00:00"
                );


            diasMora =
                Math.floor(

                    (
                        fechaHoy -
                        fechaCuota
                    )

                    /

                    (
                        1000 *
                        60 *
                        60 *
                        24
                    )

                );

        }


        /*
            SALDO PENDIENTE
        */

        const saldoPendiente =

            Number(
                cuota.valor || 0
            )

            -

            Number(
                cuota.pagado || 0
            );


        tabla.innerHTML += `

            <tr>

                <td>
                    ${cliente
                        ? cliente.nombre
                        : ""}
                </td>

                <td>
                    ${cliente
                        ? cliente.telefono
                        : ""}
                </td>

                <td>
                    ${prestamo.codigo || ""}
                </td>

                <td>
                    ${cuota.numero}
                </td>

                <td>
                    ${dinero(
                        saldoPendiente
                    )}
                </td>

                <td>

                    <span
                        class="badge ${color}"
                    >

                        ${estadoCobro}

                    </span>

                </td>

                <td>
                    ${diasMora}
                </td>

                <td>

                    <button
                        class="btn btn-success btn-sm"

                        onclick="abrirPago(
                            ${prestamo.local_id},
                            ${cuota.numero}
                        )"
                    >

                        <i
                            class="fa fa-money-bill-wave"
                        ></i>

                        Cobrar

                    </button>

                </td>

            </tr>

        `;

    });

}
/*=========================================================
    INDICADORES FINANCIEROS
=========================================================*/

function totalCapitalPrestado(){

    let total = 0;

    DB.prestamos.forEach(prestamo=>{

        total += Number(prestamo.capital || 0);

    });

    return total;

}

function totalCapitalRecuperado(){

    let total = 0;

    DB.prestamos.forEach(prestamo=>{

        total += Number(prestamo.capitalRecuperado || 0);

    });

    return total;

}

function totalCapitalPendiente(){

    let total = 0;

    DB.prestamos.forEach(prestamo=>{

        total += Number(prestamo.saldoTotal || 0);

    });

    return total;

}
/*=========================================================
    INTERESES RECUPERADOS
=========================================================*/

function totalInteresesRecuperados(){

    let total = 0;

    DB.prestamos.forEach(prestamo=>{

        total += Number(prestamo.interesRecuperado || 0);

    });

    return total;

}

/*=========================================================
    PRESTAMOS ACTIVOS
=========================================================*/

function contarPrestamosActivos(){

    return DB.prestamos.filter(

        p=>p.estado==="ACTIVO"

    ).length;

}
/*=========================================================
    GRAFICO RESUMEN FINANCIERO
=========================================================*/

let graficoCapital = null;

function actualizarGraficoCapital(resumen){

    const canvas =
        document.getElementById("graficoCapital");

    if(!canvas) return;

    const recuperado =
        Number(resumen.capitalRecuperado || 0);

    const pendiente =
        Number(resumen.capitalPendiente || 0);

    const intereses =
        Number(resumen.interesesRecuperados || 0);


    // Si ya existe el gráfico, lo destruimos
    // antes de volver a crearlo

    if(graficoCapital){

        graficoCapital.destroy();

    }


    graficoCapital = new Chart(

        canvas,

        {

            type:"doughnut",

            data:{

                labels:[

                    "Capital Recuperado",

                    "Saldo Pendiente",

                    "Intereses Recuperados"

                ],

                datasets:[

                    {

                        data:[

                            recuperado,

                            pendiente,

                            intereses

                        ],

                        backgroundColor:[

                            "#198754",

                            "#f59e0b",

                            "#0d6efd"

                        ],

                        borderWidth:0,

                        hoverOffset:6

                    }

                ]

            },

            options:{

                responsive:true,

                maintainAspectRatio:false,

                cutout:"68%",

                plugins:{

                    legend:{

                        position:"bottom",

                        labels:{

                            usePointStyle:true,

                            padding:20,

                            font:{

                                size:12

                            }

                        }

                    },

                    tooltip:{

                        callbacks:{

                            label:function(context){

                                return context.label +
                                    ": " +
                                    dinero(context.raw);

                            }

                        }

                    }

                }

            }

        }

    );

}

/*=========================================================
    ABRIR UBICACIÓN DEL CLIENTE EN GOOGLE MAPS
=========================================================*/

function abrirMapaCliente(direccionCodificada){

    const direccion =
        decodeURIComponent(
            direccionCodificada || ""
        );

    /*
        VALIDAR DIRECCIÓN
    */

    if(
        !direccion ||
        direccion.trim() === "," ||
        direccion.trim() === ""
    ){

        alert(
            "El cliente no tiene una dirección registrada."
        );

        return;

    }

    /*
        CONSTRUIR URL GOOGLE MAPS
    */

    const url =
        "https://www.google.com/maps/search/?api=1&query=" +
        encodeURIComponent(
            direccion
        );

    /*
        ABRIR GOOGLE MAPS
    */

    window.open(
        url,
        "_blank"
    );

}