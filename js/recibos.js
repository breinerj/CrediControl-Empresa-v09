/*=========================================================
    CREDICONTROL
    recibos.js
    GENERACION DE COMPROBANTES PDF
=========================================================*/

/*=========================================================
    GENERAR QR PARA RECIBO
=========================================================*/

function generarQRRecibo(datos){

    return new Promise((resolve,reject)=>{

        try{

            const contenedor =
                document.createElement("div");

            contenedor.style.position =
                "absolute";

            contenedor.style.left =
                "-9999px";

            document.body.appendChild(
                contenedor
            );


            new QRCode(contenedor,{

                text:datos,

                width:150,

                height:150,

                correctLevel:
                    QRCode.CorrectLevel.M

            });


            setTimeout(()=>{

                const canvas =
                    contenedor.querySelector("canvas");

                const imagen =
                    contenedor.querySelector("img");


                let base64 = "";


                if(canvas){

                    base64 =
                        canvas.toDataURL(
                            "image/png"
                        );

                }else if(imagen){

                    base64 =
                        imagen.src;

                }


                document.body.removeChild(
                    contenedor
                );


                if(base64){

                    resolve(base64);

                }else{

                    reject(
                        new Error(
                            "No se pudo generar el QR"
                        )
                    );

                }

            },100);


        }catch(error){

            reject(error);

        }

    });

}

/*=========================================================
    GENERAR RECIBO PDF
=========================================================*/

async function generarReciboPDF(idPago){

    try{

        const pago = DB.pagos.find(
            p => Number(p.id) === Number(idPago)
        );

        if(!pago){

            alert("No se encontró el pago.");

            return;

        }


        const prestamo = DB.prestamos.find(
            p => Number(p.id) === Number(pago.prestamo)
        );


        if(!prestamo){

            alert("No se encontró el préstamo.");

            return;

        }


        const cliente = DB.clientes.find(
            c => Number(c.id) === Number(prestamo.clienteId)
        );


        const empresa =
            DB.config.empresa || {};

            /*=============================================
    DATOS DE VALIDACION QR
=============================================*/

const datosQR = [

    "CREDICONTROL",

    "Recibo: " +
        (pago.recibo || ""),

    "Empresa: " +
        (empresa.nombre || "CrediControl"),

    "Cliente: " +
        (cliente ? cliente.nombre : ""),

    "Prestamo: " +
        (prestamo.codigo || ""),

    "Cuota: " +
        (pago.cuota || ""),

    "Fecha: " +
        (pago.fecha || ""),

    "Valor: " +
        Number(pago.valor || 0)

].join("\n");


let imagenQR = null;


try{

    imagenQR =
        await generarQRRecibo(
            datosQR
        );

}catch(error){

    console.warn(
        "No fue posible generar el QR:",
        error
    );

}


        const {
            jsPDF
        } = window.jspdf;


        const doc =
            new jsPDF();


        /*=============================================
            ENCABEZADO
        =============================================*/
        /*=============================================
    LOGO EMPRESARIAL
=============================================*/

if(empresa.logo){

    try{

        let formatoLogo = "PNG";

        if(
            empresa.logo
                .toLowerCase()
                .startsWith("data:image/jpeg")
        ){

            formatoLogo = "JPEG";

        }

        doc.addImage(
            empresa.logo,
            formatoLogo,
            20,     // Posición X
            12,     // Posición Y
            30,     // Ancho
            22      // Alto
        );

    }catch(error){

        console.warn(
            "No fue posible insertar el logo en el PDF:",
            error
        );

    }

}
        doc.setFontSize(20);

        doc.setFont(
            "helvetica",
            "bold"
        );

        doc.text(
            empresa.nombre || "CrediControl",
            105,
            20,
            {
                align:"center"
            }
        );


        doc.setFontSize(10);

        doc.setFont(
            "helvetica",
            "normal"
        );


        if(empresa.razonSocial){

            doc.text(
                empresa.razonSocial,
                105,
                27,
                {
                    align:"center"
                }
            );

        }


        if(empresa.nit){

            doc.text(
                "NIT: " + empresa.nit,
                105,
                33,
                {
                    align:"center"
                }
            );

        }


        let ubicacion = "";

        if(empresa.direccion){

            ubicacion +=
                empresa.direccion;

        }

        if(empresa.ciudad){

            ubicacion +=
                ubicacion
                    ? " - " + empresa.ciudad
                    : empresa.ciudad;

        }


        if(ubicacion){

            doc.text(
                ubicacion,
                105,
                39,
                {
                    align:"center"
                }
            );

        }


        if(empresa.telefono){

            doc.text(
                "Tel: " +
                empresa.telefono,
                105,
                45,
                {
                    align:"center"
                }
            );

        }


        /* LINEA */

        doc.line(
            20,
            50,
            190,
            50
        );


        /*=============================================
            TITULO
        =============================================*/

        doc.setFontSize(15);

        doc.setFont(
            "helvetica",
            "bold"
        );

        doc.text(
            "COMPROBANTE DE PAGO",
            105,
            62,
            {
                align:"center"
            }
        );


        doc.setFontSize(11);

        doc.text(
            pago.recibo || "SIN CONSECUTIVO",
            105,
            70,
            {
                align:"center"
            }
        );


        /*=============================================
            DATOS DEL PAGO
        =============================================*/

        doc.setFontSize(10);

        doc.setFont(
            "helvetica",
            "normal"
        );


        let y = 85;


        doc.text(
            "Fecha:",
            20,
            y
        );

        doc.text(
            String(pago.fecha || ""),
            65,
            y
        );


        y += 8;


        doc.text(
            "Cliente:",
            20,
            y
        );

        doc.text(
            cliente
                ? cliente.nombre
                : "",
            65,
            y
        );


        y += 8;


        doc.text(
            "Documento:",
            20,
            y
        );

        doc.text(
            cliente
                ? String(cliente.cedula || "")
                : "",
            65,
            y
        );


        y += 8;


        doc.text(
            "Préstamo:",
            20,
            y
        );

        doc.text(
            String(
                prestamo.codigo || ""
            ),
            65,
            y
        );


        y += 8;


        doc.text(
            "Cuota:",
            20,
            y
        );

        doc.text(
            String(
                pago.cuota || ""
            ),
            65,
            y
        );


        /*=============================================
            DETALLE FINANCIERO
        =============================================*/

        y += 15;


        doc.line(
            20,
            y,
            190,
            y
        );


        y += 12;


        doc.setFont(
            "helvetica",
            "bold"
        );


        doc.text(
            "DETALLE DEL PAGO",
            20,
            y
        );


        y += 12;


        doc.setFont(
            "helvetica",
            "normal"
        );


        doc.text(
            "Capital pagado:",
            20,
            y
        );

        doc.text(
            dinero(
                pago.capitalPagado || 0
            ),
            150,
            y,
            {
                align:"right"
            }
        );


        y += 9;


        doc.text(
            "Interés pagado:",
            20,
            y
        );

        doc.text(
            dinero(
                pago.interesPagado || 0
            ),
            150,
            y,
            {
                align:"right"
            }
        );


        y += 9;


        doc.setFont(
            "helvetica",
            "bold"
        );


        doc.text(
            "TOTAL PAGADO:",
            20,
            y
        );

        doc.text(
            dinero(
                pago.valor || 0
            ),
            150,
            y,
            {
                align:"right"
            }
        );


        y += 9;


        doc.setFont(
            "helvetica",
            "normal"
        );


        doc.text(
            "Saldo de capital:",
            20,
            y
        );

        doc.text(
            dinero(
                pago.saldoCapital || 0
            ),
            150,
            y,
            {
                align:"right"
            }
        );


        /*=============================================
            OBSERVACIONES
        =============================================*/

        y += 15;


        doc.line(
            20,
            y,
            190,
            y
        );


        y += 12;


        doc.setFont(
            "helvetica",
            "bold"
        );


        doc.text(
            "Observaciones:",
            20,
            y
        );


        y += 8;


        doc.setFont(
            "helvetica",
            "normal"
        );


        doc.text(
            pago.observacion ||
            "Pago registrado correctamente.",
            20,
            y
        );


        /*=============================================
            PIE DE PAGINA
        =============================================*/

        y += 30;


        doc.line(
            30,
            y,
            90,
            y
        );


        doc.line(
            120,
            y,
            180,
            y
        );


        y += 6;


        doc.text(
            "Firma Cliente",
            60,
            y,
            {
                align:"center"
            }
        );


        doc.text(
            "Firma Responsable",
            150,
            y,
            {
                align:"center"
            }
        );


        y += 20;


        doc.setFontSize(9);


        doc.text(
            "Gracias por su pago.",
            105,
            y,
            {
                align:"center"
            }
        );


        y += 5;


        doc.text(
            "Conserve este comprobante.",
            105,
            y,
            {
                align:"center"
            }
        );

        /*=============================================
    CODIGO QR
=============================================*/

if(imagenQR){

    doc.addImage(

        imagenQR,

        "PNG",

        165,

        235,

        25,

        25

    );


    doc.setFontSize(7);

    doc.text(

        "Validación del comprobante",

        177.5,

        264,

        {
            align:"center"
        }

    );

}

        /*=============================================
            DESCARGAR PDF
        =============================================*/

        doc.save(

            (pago.recibo || "recibo") +
            ".pdf"

        );


    }catch(error){

        console.error(
            "Error generando recibo:",
            error
        );

        alert(
            "No fue posible generar el comprobante PDF."
        );

    }

}

/*=========================================================
    COMPARTIR COMPROBANTE POR WHATSAPP
=========================================================*/

function compartirReciboWhatsApp(idPago){

    try{

        const pago = DB.pagos.find(
            p => Number(p.id) === Number(idPago)
        );

        if(!pago){

            alert("No se encontró el pago.");

            return;

        }


        const prestamo = DB.prestamos.find(
            p => Number(p.id) === Number(
                pago.prestamo || pago.prestamoId
            )
        );


        if(!prestamo){

            alert("No se encontró el préstamo.");

            return;

        }


        const cliente = DB.clientes.find(
            c => Number(c.id) === Number(prestamo.clienteId)
        );


        if(!cliente){

            alert("No se encontró el cliente.");

            return;

        }


        /* LIMPIAR NUMERO DE TELEFONO */

        let telefono = String(
            cliente.telefono || ""
        ).replace(/\D/g,"");


        if(!telefono){

            alert(
                "El cliente no tiene un número de teléfono registrado."
            );

            return;

        }


        /*
            Para números colombianos agregamos 57
            si el número tiene 10 dígitos.
        */

        if(telefono.length === 10){

            telefono = "57" + telefono;

        }


        const empresa =
            DB.config.empresa?.nombre ||
            "CrediControl";


        /* MENSAJE */

        const mensaje =

`Hola ${cliente.nombre}.

Hemos registrado correctamente su pago.

Empresa: ${empresa}
Comprobante: ${pago.recibo || ""}
Préstamo: ${prestamo.codigo || ""}
Cuota: ${pago.cuota || ""}
Fecha: ${pago.fecha || ""}
Capital pagado: ${dinero(pago.capitalPagado || 0)}
Interés pagado: ${dinero(pago.interesPagado || 0)}
Total pagado: ${dinero(pago.valor || 0)}
Saldo de capital: ${dinero(prestamo.saldoCapital || 0)}

Gracias por su pago.

Conserve su comprobante para cualquier consulta.`;


        const url =

            "https://wa.me/" +
            telefono +
            "?text=" +
            encodeURIComponent(mensaje);


        window.open(
            url,
            "_blank"
        );


    }catch(error){

        console.error(
            "Error compartiendo por WhatsApp:",
            error
        );

        alert(
            "No fue posible abrir WhatsApp."
        );

    }

}