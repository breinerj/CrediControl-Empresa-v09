/*=========================================================
    CREDICONTROL

    MOTOR DE CÁLCULOS FINANCIEROS

=========================================================*/

/*
    Aquí vivirá toda la lógica financiera.

    - Cálculo de cuotas
    - Cronogramas
    - Interés fijo
    - Interés sobre saldo
    - Sistema francés
    - Abonos extraordinarios
    - Reestructuración
    - Mora
*/

/*=========================================================
    CALCULAR CUOTA
=========================================================*/

function calcularCuota(){

    const capital = numero(
        document.getElementById("capital").value
    );

    const interes = numero(
        document.getElementById("interes").value
    );

    const tipoInteres =
        document.getElementById("tipoInteres")?.value || "fijo";

    const meses = numero(
        document.getElementById("meses").value
    );

    const periodicidad =
        document.getElementById("periodicidad").value;

    let cuotas = meses;

    if(periodicidad == "Diario"){

        cuotas = meses * 30;

    }else if(periodicidad == "Quincenal"){

        cuotas = meses * 2;

    }

    let interesTotal = 0;

    if(tipoInteres=="fijo"){

        // Método actual
        interesTotal =
            capital * (interes/100) * meses;

    }else{

        // Interés sobre saldo
        let saldo = capital;
        const capitalCuota = capital / cuotas;

        for(let i=1;i<=cuotas;i++){

            interesTotal += saldo * (interes/100);

            saldo -= capitalCuota;

            if(saldo < 0){
                saldo = 0;
            }

        }

    }

    const total = capital + interesTotal;

    return{

        capital,

        interes,

        tipoInteres,

        meses,

        cuotas,

        interesTotal,

        total,

        valorCuota:
            cuotas==0 ? 0 : total/cuotas

    };

}

/*=========================================================
        CALCULO
=========================================================*/
function calcularPrestamo(){

    let datos = calcularPrestamoCompleto();

    document.getElementById("lblInteres").innerHTML=

        dinero(datos.interesTotal);

    document.getElementById("lblTotal").innerHTML=

        dinero(datos.total);

    document.getElementById("lblCuotas").innerHTML=

        datos.cuotas;

    document.getElementById("lblValorCuota").innerHTML=

        dinero(datos.valorCuota);

    generarVistaCronograma(

        datos.capital,

        datos.interesTotal,

        datos.cuotas,

        datos.valorCuota

    );

}
/*=========================================================
        GENERAR VISTA PREVIA DEL CRONOGRAMA
=========================================================*/

function generarVistaCronograma( 
    capital,
    interesTotal,
    cuotas,
    valorCuota
){ 
    console.log("Entró a generarVistaCronograma");

    const tabla = document.getElementById("cronogramaPreview");

    if(!tabla) return;

    tabla.innerHTML = "";

    let fecha = document.getElementById("primerPago").value;

    if(fecha=="") return;

    let fechaPago = new Date(fecha);

    const tipoInteres =
        document.getElementById("tipoInteres")?.value || "fijo";

    let capitalCuota = capital / cuotas;

    let saldo = capital;

    let periodicidad =
        document.getElementById("periodicidad").value;

    for(let i=1;i<=cuotas;i++){

        console.log("Tipo dentro de vista:", tipoInteres);

        let interesCuota;

        if(tipoInteres=="fijo"){

            interesCuota = interesTotal / cuotas;

        }else{

            interesCuota = saldo * (
                numero(document.getElementById("interes").value) / 100
            );

        }

        const valorCuotaActual =
            capitalCuota + interesCuota;

        saldo -= capitalCuota;

        let fechaTexto =
            fechaPago.toISOString().substring(0,10);

        tabla.innerHTML += `
            <tr>
                <td>${i}</td>
                <td>${fechaTexto}</td>
                <td>${dinero(capitalCuota)}</td>
                <td>${dinero(interesCuota)}</td>
                <td>${dinero(valorCuotaActual)}</td>
                <td>${dinero(Math.max(saldo,0))}</td>
            </tr>
        `;

        if(periodicidad == "Diario"){

            fechaPago.setDate(
                fechaPago.getDate() + 1
            );

        }else if(periodicidad == "Quincenal"){

            fechaPago.setDate(
                fechaPago.getDate() + 15
            );

        }else if(periodicidad == "Mensual"){

            fechaPago.setMonth(
                fechaPago.getMonth() + 1
            );

        }
    }

}

/*=========================================================
        CREAR CRONOGRAMA PARA GUARDAR
=========================================================*/
/*=========================================================
        CREAR CRONOGRAMA PARA GUARDAR
=========================================================*/

function construirCronograma(){

    let capital = Number(
        document.getElementById("capital").value
    );

    let interes = Number(
        document.getElementById("interes").value
    );

    let tipoInteres =
        document.getElementById("tipoInteres")?.value || "fijo";

    console.log("Tipo:", tipoInteres);

    let meses = Number(
        document.getElementById("meses").value
    );

    let periodicidad =
        document.getElementById("periodicidad").value;

    /*
    =========================================================
        DETERMINAR NÚMERO DE CUOTAS Y TASA POR PERÍODO
    =========================================================
    */

    let cuotas = meses;
    let tasaPeriodo = interes;

    if(periodicidad == "Quincenal"){

        cuotas = meses * 2;

        // Interés mensual dividido en 2 quincenas
        tasaPeriodo = interes / 2;

    }

    else if(periodicidad == "Semanal"){

        cuotas = meses * 4;

        // Interés mensual dividido en 4 semanas
        tasaPeriodo = interes / 4;

    }

    else if(periodicidad == "Diario"){

        cuotas = meses * 30;

        // Interés mensual dividido en 30 días
        tasaPeriodo = interes / 30;

    }

    /*
    =========================================================
        CAPITAL DE CADA CUOTA
    =========================================================
    */

    let capitalCuota = capital / cuotas;

    let saldo = capital;

    /*
    =========================================================
        FECHA DEL PRIMER PAGO
    =========================================================
    */

    let fechaPago = new Date(
        document.getElementById("primerPago").value + "T00:00:00"
    );

    let cronograma = [];

    /*
    =========================================================
        CONSTRUIR CADA CUOTA
    =========================================================
    */

    for(let i = 1; i <= cuotas; i++){

        let interesCuota;

        /*
        -----------------------------------------------------
            INTERÉS FIJO
        -----------------------------------------------------
        */

        if(tipoInteres == "fijo"){

            interesCuota =
                capital * (tasaPeriodo / 100);

        }

        /*
        -----------------------------------------------------
            INTERÉS SOBRE SALDO
        -----------------------------------------------------
        */

        else{

            interesCuota =
                saldo * (tasaPeriodo / 100);

        }

        /*
        -----------------------------------------------------
            VALOR TOTAL DE LA CUOTA
        -----------------------------------------------------
        */

        let valorCuota =
            capitalCuota + interesCuota;

        /*
        -----------------------------------------------------
            ACTUALIZAR SALDO
        -----------------------------------------------------
        */

        saldo -= capitalCuota;

        /*
        -----------------------------------------------------
            GUARDAR CUOTA
        -----------------------------------------------------
        */

        cronograma.push({

            numero: i,

            fecha:
                fechaPago.toISOString().substring(0,10),

            capital: capitalCuota,

            interes: interesCuota,

            valor: valorCuota,

            saldo: Math.max(saldo,0),

            pagado: 0,

            estado: "PENDIENTE"

        });

        /*
        =====================================================
            CALCULAR SIGUIENTE FECHA
        =====================================================
        */

        if(periodicidad == "Diario"){

            fechaPago.setDate(
                fechaPago.getDate() + 1
            );

        }

        else if(periodicidad == "Semanal"){

            fechaPago.setDate(
                fechaPago.getDate() + 7
            );

        }

        else if(periodicidad == "Quincenal"){

            /*
            -------------------------------------------------
                QUINCENAL
                Alterna entre los días 15 y 30
            -------------------------------------------------
            */

            let diaActual = fechaPago.getDate();

            if(diaActual < 15){

                fechaPago.setDate(15);

            }

            else if(diaActual < 30){

                fechaPago.setDate(30);

            }

            else{

                fechaPago.setMonth(
                    fechaPago.getMonth() + 1
                );

                fechaPago.setDate(15);

            }

        }

        else if(periodicidad == "Mensual"){

            fechaPago.setMonth(
                fechaPago.getMonth() + 1
            );

        }

    }

    return cronograma;

}
/*=========================================================
        VISTA PREVIA DEL CRONOGRAMA
=========================================================*/

function actualizarVistaPreviaCronograma(){

    let tabla = document.getElementById("cronogramaPreview");

    if(!tabla) return;

    let capital = Number(document.getElementById("capital").value);

    let interes = Number(document.getElementById("interes").value);

    let meses = Number(document.getElementById("meses").value);

    let primerPago = document.getElementById("primerPago").value;

    if(capital<=0 || meses<=0 || primerPago==""){

        tabla.innerHTML="";

        return;

    }

    let cronograma = construirCronograma();

    tabla.innerHTML="";

    cronograma.forEach(cuota=>{

        tabla.innerHTML += `

        <tr>

            <td>${cuota.numero}</td>

            <td>${cuota.fecha}</td>

            <td>${dinero(cuota.capital)}</td>

            <td>${dinero(cuota.interes)}</td>

            <td>${dinero(cuota.valor)}</td>

            <td>${dinero(cuota.saldo)}</td>

        </tr>

        `;

    });

}


function recalcularSaldo(prestamo){

    let saldoTotal = 0;

    let capitalRecuperado = 0;

    let interesRecuperado = 0;


    /*
        RECORRER LAS CUOTAS DEL PRÉSTAMO
    */

    prestamo.cronograma.forEach(cuota => {

        const valorCuota =
            Number(cuota.valor || 0);

        const pagado =
            Number(cuota.pagado || 0);

        const pendiente =
            Math.max(
                0,
                valorCuota - pagado
            );


        saldoTotal += pendiente;

    });


    /*
        RECUPERACIÓN FINANCIERA
    */

    (DB.pagos || []).forEach(pago => {

        const mismoPrestamo =
            Number(
                pago.prestamo ||
                pago.prestamoId
            ) ===
            Number(prestamo.id);


        if(!mismoPrestamo){

            return;

        }


        capitalRecuperado +=
            Number(
                pago.capitalPagado || 0
            );


        interesRecuperado +=
            Number(
                pago.interesPagado || 0
            );

    });


    /*
        ACTUALIZAR RESUMEN DEL PRÉSTAMO
    */

    prestamo.capitalRecuperado =
        capitalRecuperado;


    prestamo.interesRecuperado =
        interesRecuperado;


    prestamo.saldoCapital =
        Math.max(
            0,
            Number(prestamo.capital || 0) -
            capitalRecuperado
        );


    prestamo.saldoTotal =
        saldoTotal;


    DB.guardar();

}

/*=========================================================
    NUEVO MOTOR FINANCIERO
=========================================================*/

function calcularPrestamoCompleto(){

    const capital = numero(
        document.getElementById("capital").value
    );

    const tasa = numero(
        document.getElementById("interes").value
    );

    const meses = numero(
        document.getElementById("meses").value
    );

    const periodicidad =
        document.getElementById("periodicidad").value;

    const tipoInteres =
        document.getElementById("tipoInteres")?.value || "fijo";


    /*=====================================================
        DETERMINAR NÚMERO DE CUOTAS
    =====================================================*/

    let cuotas = meses;

    if(periodicidad == "Quincenal"){

        cuotas = meses * 2;

    }
    else if(periodicidad == "Semanal"){

        cuotas = meses * 4;

    }
    else if(periodicidad == "Diario"){

        cuotas = meses * 30;

    }


    /*=====================================================
        CAPITAL POR CUOTA
    =====================================================*/

    const capitalCuota =
        capital / cuotas;

    let saldo = capital;

    let interesTotal = 0;

    let cronograma = [];


    /*=====================================================
        FECHA PRIMER PAGO
    =====================================================*/

    let fecha =
        document.getElementById("primerPago").value;

    if(fecha == ""){

        fecha = hoy();

    }

    let fechaPago =
        new Date(fecha + "T00:00:00");


    /*=====================================================
        DETERMINAR TASA POR PERÍODO
    =====================================================*/

    let divisorInteres = 1;

    if(periodicidad == "Quincenal"){

        divisorInteres = 2;

    }
    else if(periodicidad == "Semanal"){

        divisorInteres = 4;

    }
    else if(periodicidad == "Diario"){

        divisorInteres = 30;

    }


    const tasaPeriodo =
        tasa / divisorInteres;


    /*=====================================================
        GENERAR CRONOGRAMA
    =====================================================*/

    for(let i = 1; i <= cuotas; i++){

        let interesCuota = 0;


        /*-------------------------------------------------
            INTERÉS FIJO
        -------------------------------------------------*/

        if(tipoInteres == "fijo"){

            interesCuota =
                capital * (tasaPeriodo / 100);

        }


        /*-------------------------------------------------
            INTERÉS SOBRE SALDO
        -------------------------------------------------*/

        else{

            interesCuota =
                saldo * (tasaPeriodo / 100);

        }


        /*-------------------------------------------------
            VALOR DE LA CUOTA
        -------------------------------------------------*/

        const valorCuota =
            capitalCuota + interesCuota;


        interesTotal += interesCuota;


        /*-------------------------------------------------
            ACTUALIZAR SALDO
        -------------------------------------------------*/

        saldo -= capitalCuota;


        /*-------------------------------------------------
            GUARDAR CUOTA
        -------------------------------------------------*/

        cronograma.push({

            numero: i,

            fecha:
                fechaPago
                    .toISOString()
                    .substring(0,10),

            capital:
                capitalCuota,

            interes:
                interesCuota,

            valor:
                valorCuota,

            saldo:
                Math.max(saldo,0)

        });


        /*=================================================
            CALCULAR SIGUIENTE FECHA
        =================================================*/

        if(periodicidad == "Diario"){

            fechaPago.setDate(
                fechaPago.getDate() + 1
            );

        }

        else if(periodicidad == "Semanal"){

            fechaPago.setDate(
                fechaPago.getDate() + 7
            );

        }

        else if(periodicidad == "Quincenal"){

            fechaPago.setDate(
                fechaPago.getDate() + 15
            );

        }

        else if(periodicidad == "Mensual"){

            fechaPago.setMonth(
                fechaPago.getMonth() + 1
            );

        }

    }


    /*=====================================================
        RESULTADO FINAL
    =====================================================*/

    return {

        capital,

        tasa,

        meses,

        cuotas,

        interesTotal,

        total:
            capital + interesTotal,

        valorCuota:
            cronograma.length
                ? cronograma[0].valor
                : 0,

        cronograma

    };

}