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

    if(periodicidad=="Quincenal"){
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

}

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

    let cuotas = meses;

    let tasaPeriodo = interes;

    if(periodicidad=="Quincenal"){

        cuotas = meses * 2;

        // La tasa mensual se divide entre dos
        tasaPeriodo = interes / 2;

    }

    let capitalCuota = capital / cuotas;

    let saldo = capital;

    let fechaPago = new Date(
        document.getElementById("primerPago").value
    );

    let cronograma = [];

    for(let i=1;i<=cuotas;i++){

        let interesCuota;

        if(tipoInteres=="fijo"){

            interesCuota =
                capital * (tasaPeriodo / 100);

        }else{

            interesCuota =
                saldo * (tasaPeriodo / 100);

        }

        let valorCuota =
            capitalCuota + interesCuota;

        saldo -= capitalCuota;

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
/*=========================================================
        CALCULAR SALDO
=========================================================*/

function recalcularSaldo(prestamo){

    let saldo=0;

    prestamo.cronograma.forEach(c=>{

        if(c.estado!="PAGADA"){

            saldo+=c.valor-c.pagado;

        }

    });

    prestamo.saldoTotal=saldo;

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

    let cuotas = meses;

    if(periodicidad=="Quincenal"){
        cuotas = meses * 2;
    }

    const capitalCuota = capital / cuotas;

    let saldo = capital;

    let interesTotal = 0;

    let cronograma = [];

    let fecha = document.getElementById("primerPago").value;

    if(fecha==""){

        fecha = hoy();

    }

    let fechaPago = new Date(fecha);

    for(let i=1;i<=cuotas;i++){

        let interesCuota = 0;

        if(tipoInteres=="fijo"){

            interesCuota =
                capital * (tasa/100) / (periodicidad=="Mensual" ? 1 : 2);

        }else{

            interesCuota =
                saldo * (tasa/100) / (periodicidad=="Mensual" ? 1 : 2);

        }

        const valorCuota =
            capitalCuota + interesCuota;

        interesTotal += interesCuota;

        saldo -= capitalCuota;

        cronograma.push({

            numero:i,

            fecha:fechaPago.toISOString().substring(0,10),

            capital:capitalCuota,

            interes:interesCuota,

            valor:valorCuota,

            saldo:Math.max(saldo,0)

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

    return{

        capital,

        tasa,

        meses,

        cuotas,

        interesTotal,

        total:capital+interesTotal,

        valorCuota:cronograma.length ? cronograma[0].valor : 0,

        cronograma

    };

}