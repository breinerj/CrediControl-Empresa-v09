/*=========================================================
    CARGAR USUARIOS EN REPORTE
=========================================================*/

function cargarCobradoresReporte(){

    const select =
        document.getElementById("filtroCobrador");

    if(!select) return;


    select.innerHTML = `

        <option value="">
            Todos los usuarios
        </option>

    `;


    DB.usuarios.forEach(usuario=>{

        select.innerHTML += `

            <option value="${usuario.id}">

                ${usuario.nombre}

                (${usuario.rol})

            </option>

        `;

    });

}

/*=========================================================
    DATOS ACTUALES DEL REPORTE
=========================================================*/

let reporteCobradoresActual = [];


/*=========================================================
    GENERAR REPORTE DE RECAUDO
=========================================================*/

function generarReporteCobradores(){

    if(!esAdministrador()){

        alert(
            "No tiene permisos para consultar este reporte."
        );

        return;

    }


    const usuarioId =
        document.getElementById(
            "filtroCobrador"
        ).value;


    const fechaDesde =
        document.getElementById(
            "filtroFechaDesde"
        ).value;


    const fechaHasta =
        document.getElementById(
            "filtroFechaHasta"
        ).value;


    const tabla =
        document.getElementById(
            "tablaReporteCobradores"
        );


    if(!tabla) return;


    let pagos =
    DB.pagos.filter(pago=>{


        /*=================================================
            FILTRO COBRADOR
        =================================================*/

        if(usuarioId){

            const usuarioSeleccionado =
                DB.usuarios.find(

                    usuario =>
                        String(usuario.id) ===
                        String(usuarioId)

                );


            if(!usuarioSeleccionado){

                return false;

            }


            /*
                ID DEL USUARIO

                Si existe, lo usamos.
            */

            const pagoUsuarioId =
                pago.usuarioId ??
                pago.usuario_id ??
                null;


            /*
                NOMBRE DEL USUARIO

                Sirve para los pagos que fueron
                cargados desde Supabase y que
                actualmente conservan usuarioNombre.
            */

            const pagoUsuarioNombre =
                String(
                    pago.usuarioNombre ||
                    pago.usuario ||
                    ""
                )
                .trim()
                .toLowerCase();


            const usuarioNombre =
                String(
                    usuarioSeleccionado.nombre ||
                    ""
                )
                .trim()
                .toLowerCase();


            /*
                COMPARAR POR ID O POR NOMBRE
            */

            const coincidePorId =

                pagoUsuarioId !== null &&

                String(pagoUsuarioId) ===
                String(usuarioId);


            const coincidePorNombre =

                pagoUsuarioNombre !== "" &&

                pagoUsuarioNombre ===
                usuarioNombre;


            /*
                SI NO COINCIDE POR NINGUNO
                SE DESCARTA EL PAGO
            */

            if(
                !coincidePorId &&
                !coincidePorNombre
            ){

                return false;

            }

        }


        /*=================================================
            FILTRO FECHA DESDE
        =================================================*/

        if(
            fechaDesde &&
            pago.fecha < fechaDesde
        ){

            return false;

        }


        /*=================================================
            FILTRO FECHA HASTA
        =================================================*/

        if(
            fechaHasta &&
            pago.fecha > fechaHasta
        ){

            return false;

        }


        return true;

    });
            /* GUARDAR RESULTADO ACTUAL */

            reporteCobradoresActual = pagos;

    /*=============================================
        TOTALES
    =============================================*/

    const totalRecaudado =
        pagos.reduce(

            (total,pago)=>
                total +
                Number(pago.valor || 0),

            0

        );


    const capitalRecuperado =
        pagos.reduce(

            (total,pago)=>
                total +
                Number(
                    pago.capitalPagado || 0
                ),

            0

        );


    const interesesRecuperados =
        pagos.reduce(

            (total,pago)=>
                total +
                Number(
                    pago.interesPagado || 0
                ),

            0

        );


    /* MOSTRAR INDICADORES */

    document.getElementById(
        "reporteTotalRecaudado"
    ).innerHTML =
        dinero(totalRecaudado);


    document.getElementById(
        "reporteCapitalRecuperado"
    ).innerHTML =
        dinero(capitalRecuperado);


    document.getElementById(
        "reporteInteresesRecuperados"
    ).innerHTML =
        dinero(interesesRecuperados);


    document.getElementById(
        "reporteCantidadPagos"
    ).innerHTML =
        pagos.length;


    /*=============================================
        TABLA
    =============================================*/

    tabla.innerHTML = "";


    pagos.forEach(pago=>{

        const prestamo =
            obtenerPrestamo(

                pago.prestamo ||
                pago.prestamoId

            );


        const cliente =
            prestamo

            ? obtenerCliente(
                prestamo.clienteId
            )

            : null;


        tabla.innerHTML += `

        <tr>

            <td>
                ${pago.fecha || ""}
            </td>

            <td>
                ${pago.recibo || ""}
            </td>

            <td>
                ${pago.usuarioNombre || ""}
            </td>

            <td>
                ${cliente ? cliente.nombre : ""}
            </td>

            <td>
                ${prestamo ? prestamo.codigo : ""}
            </td>

            <td>
                ${dinero(pago.capitalPagado || 0)}
            </td>

            <td>
                ${dinero(pago.interesPagado || 0)}
            </td>

            <td>
                <strong>
                    ${dinero(pago.valor || 0)}
                </strong>
            </td>

        </tr>

        `;

    });

}

/*=========================================================
    EXPORTAR RECAUDO POR COBRADOR A EXCEL
=========================================================*/

function exportarReporteCobradoresExcel(){

    if(!esAdministrador()){

        alert(
            "No tiene permisos para exportar este reporte."
        );

        return;

    }


    if(
        !reporteCobradoresActual ||
        reporteCobradoresActual.length === 0
    ){

        alert(
            "No hay información para exportar.\n\n" +
            "Realice primero una consulta."
        );

        return;

    }


    if(typeof XLSX === "undefined"){

        alert(
            "No se pudo cargar el módulo de exportación a Excel."
        );

        return;

    }


    const usuarioId =
        document.getElementById(
            "filtroCobrador"
        ).value;


    const fechaDesde =
        document.getElementById(
            "filtroFechaDesde"
        ).value;


    const fechaHasta =
        document.getElementById(
            "filtroFechaHasta"
        ).value;


    /*=============================================
        NOMBRE DEL COBRADOR
    =============================================*/

    let nombreCobrador =
        "Todos";


    if(usuarioId){

        const usuario =
            obtenerUsuario(usuarioId);


        if(usuario){

            nombreCobrador =
                usuario.nombre;

        }

    }


    /*=============================================
        PREPARAR DETALLE
    =============================================*/

    const detalle =
        reporteCobradoresActual.map(

            pago=>{

                const prestamo =
                    obtenerPrestamo(

                        pago.prestamo ||
                        pago.prestamoId

                    );


                const cliente =
                    prestamo

                    ? obtenerCliente(
                        prestamo.clienteId
                    )

                    : null;


                return {

                    "Fecha":
                        pago.fecha || "",

                    "Fecha y Hora Registro":
                        pago.fechaHoraRegistro || "",

                    "Recibo":
                        pago.recibo || "",

                    "Cobrador":
                        pago.usuarioNombre || "",

                    "Rol":
                        pago.usuarioRol || "",

                    "Cliente":
                        cliente
                            ? cliente.nombre
                            : "",

                    "Préstamo":
                        prestamo
                            ? prestamo.codigo
                            : "",

                    "Cuota":
                        pago.cuota || "",

                    "Capital Recuperado":
                        Number(
                            pago.capitalPagado || 0
                        ),

                    "Interés Recuperado":
                        Number(
                            pago.interesPagado || 0
                        ),

                    "Total Recaudado":
                        Number(
                            pago.valor || 0
                        )

                };

            }

        );


    /*=============================================
        CALCULAR RESUMEN
    =============================================*/

    const totalRecaudado =
        reporteCobradoresActual.reduce(

            (total,pago)=>
                total +
                Number(pago.valor || 0),

            0

        );


    const capitalRecuperado =
        reporteCobradoresActual.reduce(

            (total,pago)=>
                total +
                Number(
                    pago.capitalPagado || 0
                ),

            0

        );


    const interesesRecuperados =
        reporteCobradoresActual.reduce(

            (total,pago)=>
                total +
                Number(
                    pago.interesPagado || 0
                ),

            0

        );


    /*=============================================
        HOJA RESUMEN
    =============================================*/

    const resumen = [

        {
            "Concepto":
                "Cobrador",

            "Valor":
                nombreCobrador
        },

        {
            "Concepto":
                "Fecha desde",

            "Valor":
                fechaDesde || "Sin filtro"
        },

        {
            "Concepto":
                "Fecha hasta",

            "Valor":
                fechaHasta || "Sin filtro"
        },

        {
            "Concepto":
                "Cantidad de pagos",

            "Valor":
                reporteCobradoresActual.length
        },

        {
            "Concepto":
                "Capital recuperado",

            "Valor":
                capitalRecuperado
        },

        {
            "Concepto":
                "Intereses recuperados",

            "Valor":
                interesesRecuperados
        },

        {
            "Concepto":
                "Total recaudado",

            "Valor":
                totalRecaudado
        }

    ];


    /*=============================================
        CREAR LIBRO EXCEL
    =============================================*/

    const libro =
        XLSX.utils.book_new();


    const hojaResumen =
        XLSX.utils.json_to_sheet(
            resumen
        );


    const hojaDetalle =
        XLSX.utils.json_to_sheet(
            detalle
        );


    /* ANCHO DE COLUMNAS */

    hojaResumen["!cols"] = [

        {wch:25},

        {wch:25}

    ];


    hojaDetalle["!cols"] = [

        {wch:12},

        {wch:25},

        {wch:15},

        {wch:25},

        {wch:15},

        {wch:30},

        {wch:15},

        {wch:10},

        {wch:20},

        {wch:20},

        {wch:20}

    ];


    XLSX.utils.book_append_sheet(

        libro,

        hojaResumen,

        "Resumen"

    );


    XLSX.utils.book_append_sheet(

        libro,

        hojaDetalle,

        "Detalle Recaudo"

    );


    /*=============================================
        NOMBRE DEL ARCHIVO
    =============================================*/

    const nombreLimpio =
        nombreCobrador

            .replace(
                /[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/g,
                "_"
            );


    const fechaArchivo =
        new Date()
            .toISOString()
            .substring(0,10);


    const nombreArchivo =

        "Recaudo_" +

        nombreLimpio +

        "_" +

        fechaArchivo +

        ".xlsx";


    /*=============================================
        DESCARGAR
    =============================================*/

    XLSX.writeFile(

        libro,

        nombreArchivo

    );

}

document.addEventListener(
    "DOMContentLoaded",
    function(){

        cargarCobradoresReporte();


        const boton =
            document.getElementById(
                "btnConsultarRecaudo"
            );


        if(boton){

            boton.addEventListener(

                "click",

                generarReporteCobradores

            );

        }
        const botonExportar =
            document.getElementById(
                "btnExportarRecaudo"
            );


        if(botonExportar){

            botonExportar.addEventListener(

                "click",

                exportarReporteCobradoresExcel

    );

}

    }
);


/*=========================================================
    EXPORTAR CLIENTES
=========================================================*/

function exportarClientesExcel(){

    if(!esAdministrador()){

        alert(
            "No tiene permisos para exportar clientes."
        );

        return;

    }


    if(
        typeof XLSX === "undefined"
    ){

        alert(
            "No se pudo cargar el módulo de Excel."
        );

        return;

    }


    if(
        !DB.clientes ||
        DB.clientes.length === 0
    ){

        alert(
            "No existen clientes para exportar."
        );

        return;

    }


    const datos =
        DB.clientes.map(cliente=>{

            const cobrador =
                cliente.usuarioAsignadoId
                    ? obtenerUsuario(
                        cliente.usuarioAsignadoId
                    )
                    : null;


            return {

                "Código":
                    cliente.codigo || "",

                "Nombre":
                    cliente.nombre || "",

                "Cédula":
                    cliente.cedula || "",

                "Teléfono":
                    cliente.telefono || "",

                "Ciudad":
                    cliente.ciudad || "",

                "Dirección":
                    cliente.direccion || "",

                "Estado":
                    cliente.estado || "",

                "Estado Asignación":
                    cliente.estadoAsignacion || "",

                "Cobrador":
                    cobrador
                        ? cobrador.nombre
                        : "",

                "Observaciones":
                    cliente.observaciones || ""

            };

        });


    const hoja =
        XLSX.utils.json_to_sheet(
            datos
        );


    hoja["!cols"] = [

        {wch:15},
        {wch:30},
        {wch:15},
        {wch:15},
        {wch:20},
        {wch:35},
        {wch:20},
        {wch:25},
        {wch:25},
        {wch:40}

    ];


    const libro =
        XLSX.utils.book_new();


    XLSX.utils.book_append_sheet(

        libro,

        hoja,

        "Clientes"

    );


    XLSX.writeFile(

        libro,

        "Reporte_Clientes.xlsx"

    );

}


/*=========================================================
    EXPORTAR PRESTAMOS
=========================================================*/

function exportarPrestamosExcel(){

    if(!esAdministrador()){

        alert(
            "No tiene permisos para exportar préstamos."
        );

        return;

    }


    if(
        typeof XLSX === "undefined"
    ){

        alert(
            "No se pudo cargar el módulo de Excel."
        );

        return;

    }


    if(
        !DB.prestamos ||
        DB.prestamos.length === 0
    ){

        alert(
            "No existen préstamos para exportar."
        );

        return;

    }


    const datos =
        DB.prestamos.map(prestamo=>{

            const cliente =
                obtenerCliente(
                    prestamo.clienteId
                );


            const cobrador =
                cliente?.usuarioAsignadoId
                    ? obtenerUsuario(
                        cliente.usuarioAsignadoId
                    )
                    : null;


            return {

                "Código Préstamo":
                    prestamo.codigo || "",

                "Cliente":
                    cliente
                        ? cliente.nombre
                        : "",

                "Cédula":
                    cliente
                        ? cliente.cedula
                        : "",

                "Cobrador":
                    cobrador
                        ? cobrador.nombre
                        : "",

                "Capital":
                    Number(
                        prestamo.capital || 0
                    ),

                "Interés":
                    Number(
                        prestamo.interes || 0
                    ),

                "Total":
                    Number(
                        prestamo.total || 0
                    ),

                "Capital Recuperado":
                    Number(
                        prestamo.capitalRecuperado || 0
                    ),

                "Saldo Total":
                    Number(
                        prestamo.saldoTotal || 0
                    ),

                "Estado":
                    prestamo.estado || "",

                "Periodicidad":
                    prestamo.periodicidad || "",

                "Fecha":
                    prestamo.fecha || ""

            };

        });


    const hoja =
        XLSX.utils.json_to_sheet(
            datos
        );


    hoja["!cols"] = [

        {wch:20},
        {wch:30},
        {wch:15},
        {wch:25},
        {wch:18},
        {wch:18},
        {wch:18},
        {wch:22},
        {wch:18},
        {wch:18},
        {wch:18},
        {wch:15}

    ];


    const libro =
        XLSX.utils.book_new();


    XLSX.utils.book_append_sheet(

        libro,

        hoja,

        "Prestamos"

    );


    XLSX.writeFile(

        libro,

        "Reporte_Prestamos.xlsx"

    );

}


/*=========================================================
    EXPORTAR PAGOS
=========================================================*/

function exportarPagosExcel(){

    if(!esAdministrador()){

        alert(
            "No tiene permisos para exportar pagos."
        );

        return;

    }


    if(
        typeof XLSX === "undefined"
    ){

        alert(
            "No se pudo cargar el módulo de Excel."
        );

        return;

    }


    if(
        !DB.pagos ||
        DB.pagos.length === 0
    ){

        alert(
            "No existen pagos para exportar."
        );

        return;

    }


    const datos =
        DB.pagos.map(pago=>{

            const prestamo =
                obtenerPrestamo(

                    pago.prestamo ||
                    pago.prestamoId

                );


            const cliente =
                prestamo
                    ? obtenerCliente(
                        prestamo.clienteId
                    )
                    : null;


            return {

                "Fecha":
                    pago.fecha || "",

                "Fecha y Hora":
                    pago.fechaHoraRegistro || "",

                "Recibo":
                    pago.recibo || "",

                "Cobrador":
                    pago.usuarioNombre || "",

                "Rol":
                    pago.usuarioRol || "",

                "Cliente":
                    cliente
                        ? cliente.nombre
                        : "",

                "Cédula":
                    cliente
                        ? cliente.cedula
                        : "",

                "Préstamo":
                    prestamo
                        ? prestamo.codigo
                        : "",

                "Cuota":
                    pago.cuota || "",

                "Capital Recuperado":
                    Number(
                        pago.capitalPagado || 0
                    ),

                "Interés Recuperado":
                    Number(
                        pago.interesPagado || 0
                    ),

                "Total Pagado":
                    Number(
                        pago.valor || 0
                    )

            };

        });


    const hoja =
        XLSX.utils.json_to_sheet(
            datos
        );


    hoja["!cols"] = [

        {wch:15},
        {wch:25},
        {wch:15},
        {wch:25},
        {wch:15},
        {wch:30},
        {wch:15},
        {wch:20},
        {wch:10},
        {wch:22},
        {wch:22},
        {wch:20}

    ];


    const libro =
        XLSX.utils.book_new();


    XLSX.utils.book_append_sheet(

        libro,

        hoja,

        "Pagos"

    );


    XLSX.writeFile(

        libro,

        "Reporte_Pagos.xlsx"

    );

}


/*=========================================================
    COPIA DE SEGURIDAD BKC
=========================================================*/

function crearCopiaSeguridad(){

    if(!esAdministrador()){

        alert(
            "No tiene permisos para realizar copias de seguridad."
        );

        return;

    }


    if(!DB){

        alert(
            "No se encontró la base de datos local de BKC."
        );

        return;

    }


    const respaldo = {

        aplicacion:
            "BKC Gestión de Cartera",

        fecha:

            new Date()
                .toISOString(),

        clientes:
            DB.clientes || [],

        prestamos:
            DB.prestamos || [],

        pagos:
            DB.pagos || [],

        usuarios:
            DB.usuarios || [],

        usuariosEmpresa:
            DB.usuariosEmpresa || [],

        config:
            DB.config || {}

    };


    const contenido =
        JSON.stringify(
            respaldo,
            null,
            2
        );


    const archivo =
        new Blob(

            [contenido],

            {
                type:
                    "application/json"
            }

        );


    const url =
        URL.createObjectURL(
            archivo
        );


    const enlace =
        document.createElement(
            "a"
        );


    const fecha =
        new Date()
            .toISOString()
            .substring(0,10);


    enlace.href =
        url;


    enlace.download =
        "BKC_Backup_" +
        fecha +
        ".json";


    document.body.appendChild(
        enlace
    );


    enlace.click();


    document.body.removeChild(
        enlace
    );


    URL.revokeObjectURL(
        url
    );


    alert(
        "Copia de seguridad creada correctamente."
    );

}


/*=========================================================
    BOTONES DE REPORTES
=========================================================*/

document.addEventListener(
    "DOMContentLoaded",
    function(){

        const btnClientes =
            document.getElementById(
                "btnExportarClientes"
            );


        if(btnClientes){

            btnClientes.addEventListener(

                "click",

                exportarClientesExcel

            );

        }


        const btnPrestamos =
            document.getElementById(
                "btnExportarPrestamos"
            );


        if(btnPrestamos){

            btnPrestamos.addEventListener(

                "click",

                exportarPrestamosExcel

            );

        }


        const btnPagos =
            document.getElementById(
                "btnExportarPagos"
            );


        if(btnPagos){

            btnPagos.addEventListener(

                "click",

                exportarPagosExcel

            );

        }


        const btnBackup =
            document.getElementById(
                "btnCopiaSeguridad"
            );


        if(btnBackup){

            btnBackup.addEventListener(

                "click",

                crearCopiaSeguridad

            );

        }

    }

);