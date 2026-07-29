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

            /*
                Excluir registros anteriores
                que no tienen auditoría de usuario
            */

            if(!pago.usuarioId){

                return false;

            }


            /* FILTRO USUARIO */

            if(
                usuarioId &&
                Number(pago.usuarioId) !==
                Number(usuarioId)
            ){

                return false;

            }


            /* FILTRO FECHA DESDE */

            if(
                fechaDesde &&
                pago.fecha < fechaDesde
            ){

                return false;

            }


            /* FILTRO FECHA HASTA */

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