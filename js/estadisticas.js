/*=========================================================
    CREDICONTROL
    estadisticas.js
=========================================================*/

const Estadisticas = {

    cliente(clienteId){

        let prestamos = DB.prestamos.filter(

            p=>Number(p.clienteId)===Number(clienteId)

        );

        let capitalPrestado = 0;

        let capitalRecuperado = 0;

        let interesesRecuperados = 0;

        let saldo = 0;

        prestamos.forEach(p=>{

            capitalPrestado += Number(p.capital || 0);

            capitalRecuperado += Number(p.capitalRecuperado || 0);

            interesesRecuperados += Number(p.interesRecuperado || 0);

            saldo += Number(p.saldoTotal || 0);

        });

        return{

            prestamos: prestamos.length,

            activos: prestamos.filter(

                p=>p.estado==="ACTIVO"

            ).length,

            capitalPrestado,

            capitalRecuperado,

            interesesRecuperados,

            saldo

        };

    },

    dashboard(){

        let datos={

            clientes:DB.clientes.length,

            prestamos:DB.prestamos.length,

            pagos:DB.pagos.length,

            capitalPrestado:0,

            capitalRecuperado:0,

            intereses:0,

            saldo:0

        };

        DB.prestamos.forEach(p=>{

            datos.capitalPrestado += Number(p.capital || 0);

            datos.capitalRecuperado += Number(p.capitalRecuperado || 0);

            datos.intereses += Number(p.interesRecuperado || 0);

            datos.saldo += Number(p.saldoTotal || 0);

        });

        return datos;

    }

};


